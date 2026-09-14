import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const gtfsDir = path.join(dataDir, "xpress-gtfs");

function parseLine(line) {
  const result = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      result.push(value);
      value = "";
    } else value += character;
  }
  result.push(value);
  return result;
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = parseLine(lines.shift());
  return lines.map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function haversineMiles(latitude1, longitude1, latitude2, longitude2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const stops = readCsv(path.join(gtfsDir, "stops.txt"));
const trips = readCsv(path.join(gtfsDir, "trips.txt"));
const stopTimes = readCsv(path.join(gtfsDir, "stop_times.txt"));
const routes = readCsv(path.join(gtfsDir, "routes.txt"));
const accessibility = readCsv(path.join(dataDir, "atl-workforce-marta-accessibility.csv"));

const tripRoute = new Map(trips.map((trip) => [trip.trip_id, trip.route_id]));
const routesByStop = new Map();
for (const stopTime of stopTimes) {
  const routeId = tripRoute.get(stopTime.trip_id);
  if (!routeId) continue;
  if (!routesByStop.has(stopTime.stop_id)) routesByStop.set(stopTime.stop_id, new Set());
  routesByStop.get(stopTime.stop_id).add(routeId);
}

const routeNames = new Map(routes.map((route) => [route.route_id, route.route_long_name]));
const parkRides = stops
  .filter((stop) => /park and ride|p&r/i.test(stop.stop_name))
  .map((stop) => ({
    node_code: `XPRESS-${stop.stop_code || stop.stop_id}`,
    stop_id: stop.stop_id,
    stop_code: stop.stop_code,
    node_name: stop.stop_name,
    latitude: Number(stop.stop_lat),
    longitude: Number(stop.stop_lon),
    route_ids: [...(routesByStop.get(stop.stop_id) || [])].sort().join("|"),
    route_names: [...(routesByStop.get(stop.stop_id) || [])].sort().map((routeId) => routeNames.get(routeId)).join("|")
  }))
  .filter((node) => node.route_ids);

const nodeHeaders = Object.keys(parkRides[0]);
fs.writeFileSync(
  path.join(dataDir, "xpress-park-ride-nodes.csv"),
  [nodeHeaders.join(","), ...parkRides.map((row) => nodeHeaders.map((header) => csv(row[header])).join(","))].join("\n")
);

const rows = accessibility.map((row) => {
  const latitude = Number(row.zcta_latitude);
  const longitude = Number(row.zcta_longitude);
  let nearest;
  let distance = Infinity;
  for (const node of parkRides) {
    const candidate = haversineMiles(latitude, longitude, node.latitude, node.longitude);
    if (candidate < distance) {
      distance = candidate;
      nearest = node;
    }
  }
  return {
    ...row,
    nearest_xpress_park_ride: nearest.node_name,
    nearest_xpress_node_code: nearest.node_code,
    nearest_xpress_route_ids: nearest.route_ids,
    distance_to_xpress_miles: distance.toFixed(2),
    outside_marta_10_miles: Number(row.distance_to_marta_miles) > 10,
    xpress_access_within_10_miles: distance <= 10,
    xpress_extension_candidate: Number(row.distance_to_marta_miles) > 10 && distance <= 10
  };
});

const outputHeaders = Object.keys(rows[0]);
fs.writeFileSync(
  path.join(dataDir, "atl-workforce-xpress-accessibility.csv"),
  [outputHeaders.join(","), ...rows.map((row) => outputHeaders.map((header) => csv(row[header])).join(","))].join("\n")
);

function membersWithin(predicate) {
  return rows.filter(predicate).reduce((sum, row) => sum + Number(row.synthetic_members), 0);
}

const summary = {
  model_name: "ATL-Xpress-Accessibility-v1",
  xpress_park_and_ride_nodes: parkRides.length,
  synthetic_members_within_5_miles: membersWithin((row) => Number(row.distance_to_xpress_miles) <= 5),
  synthetic_members_within_10_miles: membersWithin((row) => Number(row.distance_to_xpress_miles) <= 10),
  synthetic_members_within_15_miles: membersWithin((row) => Number(row.distance_to_xpress_miles) <= 15),
  members_outside_marta_10_but_within_xpress_10: membersWithin((row) => row.xpress_extension_candidate),
  important_note: "Xpress routes are weekday commuter services and do not directly serve ATL Airport. These are access candidates for an Xpress-to-MARTA transfer, not confirmed viable itineraries."
};
fs.writeFileSync(path.join(dataDir, "xpress-accessibility-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
