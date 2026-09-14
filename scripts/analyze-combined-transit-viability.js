import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const martaDir = path.join(dataDir, "marta-gtfs");
const xpressDir = path.join(dataDir, "xpress-gtfs");

function parseLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else value += character;
  }
  values.push(value);
  return values;
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = parseLine(lines.shift());
  return lines.map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function readSelectedStopTimes(filePath, selectedTripIds) {
  const byTrip = new Map();
  const lines = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers;
  for await (const line of lines) {
    if (!headers) {
      headers = parseLine(line);
      continue;
    }
    const values = parseLine(line);
    const tripId = values[headers.indexOf("trip_id")];
    if (!selectedTripIds.has(tripId)) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    if (!byTrip.has(tripId)) byTrip.set(tripId, []);
    byTrip.get(tripId).push(row);
  }
  for (const rows of byTrip.values()) rows.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  return byTrip;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function minutes(value) {
  const [hours, minute] = value.split(":").map(Number);
  return hours * 60 + minute;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function addDays(date, count) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function activeServices(feedDir, dates) {
  const calendar = readCsv(path.join(feedDir, "calendar.txt"));
  const exceptionPath = path.join(feedDir, "calendar_dates.txt");
  const exceptions = fs.existsSync(exceptionPath) ? readCsv(exceptionPath) : [];
  const fields = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return dates.map((date) => {
    const key = dateKey(date);
    const active = new Set(calendar
      .filter((row) => row.start_date <= key && row.end_date >= key && row[fields[date.getUTCDay()]] === "1")
      .map((row) => row.service_id));
    for (const exception of exceptions.filter((row) => row.date === key)) {
      if (exception.exception_type === "1") active.add(exception.service_id);
      if (exception.exception_type === "2") active.delete(exception.service_id);
    }
    return active;
  });
}

function lowerBound(rows, value, field) {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle][field] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function findFirstAfter(rows, value, field = "depart") {
  const index = lowerBound(rows, value, field);
  return index < rows.length ? rows[index] : null;
}

function findLastArrivingBefore(rows, value) {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle].arrive <= value) low = middle + 1;
    else high = middle;
  }
  return low > 0 ? rows[low - 1] : null;
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

const model = JSON.parse(fs.readFileSync(path.join(dataDir, "combined-transit-model-v1.json"), "utf8"));
const destinationModel = JSON.parse(fs.readFileSync(path.join(dataDir, "marta-viability-model-v1.json"), "utf8"));
const members = readCsv(path.join(dataDir, "synthetic-population-v2.csv"));
const martaAccess = readCsv(path.join(dataDir, "atl-workforce-marta-accessibility.csv"));
const xpressAccess = readCsv(path.join(dataDir, "atl-workforce-xpress-accessibility.csv"));
const martaNodes = readCsv(path.join(dataDir, "marta-rail-nodes.csv"));
const xpressNodes = readCsv(path.join(dataDir, "xpress-park-ride-nodes.csv"));

const startDate = new Date(`${model.service_week_start}T00:00:00Z`);
const dates = Array.from({ length: 9 }, (_, index) => addDays(startDate, index));
const dayIndexes = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

const stopToStation = new Map();
for (const node of martaNodes) {
  for (const stopId of node.gtfs_stop_ids.split("|")) stopToStation.set(stopId, node.node_name);
}

const martaRoutes = readCsv(path.join(martaDir, "routes.txt"));
const railRouteIds = new Set(martaRoutes.filter((route) => route.route_type === "1").map((route) => route.route_id));
const railRouteLabels = new Map(martaRoutes.map((route) => [
  route.route_id,
  route.route_short_name || route.route_long_name || route.route_id
]));
const martaTrips = readCsv(path.join(martaDir, "trips.txt")).filter((trip) => railRouteIds.has(trip.route_id));
const martaActive = activeServices(martaDir, dates);
const activeRailTrips = new Set(martaTrips.filter((trip) => martaActive.some((services) => services.has(trip.service_id))).map((trip) => trip.trip_id));
const railStopTimes = await readSelectedStopTimes(path.join(martaDir, "stop_times.txt"), activeRailTrips);
const railTripMeta = new Map(martaTrips.map((trip) => [trip.trip_id, trip]));

const AIRPORT = "AIRPORT STATION";
const hubs = ["FIVE POINTS STATION", "LINDBERGH CENTER STATION"];
const directInbound = new Map();
const directOutbound = new Map();
const toHub = new Map();
const fromHub = new Map();

function add(map, key, ride) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(ride);
}

for (const [tripId, rawStops] of railStopTimes) {
  const trip = railTripMeta.get(tripId);
  const stationStops = rawStops
    .map((stop) => ({ ...stop, station: stopToStation.get(stop.stop_id) }))
    .filter((stop) => stop.station);
  const activeDays = martaActive.map((services, index) => services.has(trip.service_id) ? index : -1).filter((index) => index >= 0);
  for (const day of activeDays) {
    const offset = day * 1440;
    for (let index = 0; index < stationStops.length; index++) {
      const origin = stationStops[index];
      for (const targetName of [AIRPORT, ...hubs]) {
        const targetIndex = stationStops.findIndex((stop, candidate) => candidate > index && stop.station === targetName);
        if (targetIndex < 0) continue;
        const target = stationStops[targetIndex];
        const ride = {
          from: origin.station,
          to: target.station,
          depart: offset + minutes(origin.departure_time),
          arrive: offset + minutes(target.arrival_time),
          routes: railRouteLabels.get(trip.route_id),
          transfers: 0
        };
        if (target.station === AIRPORT) add(directInbound, origin.station, ride);
        else add(toHub, `${origin.station}|${target.station}`, ride);
      }
      if (![AIRPORT, ...hubs].includes(origin.station)) continue;
      for (let targetIndex = index + 1; targetIndex < stationStops.length; targetIndex++) {
        const target = stationStops[targetIndex];
        const ride = {
          from: origin.station,
          to: target.station,
          depart: offset + minutes(origin.departure_time),
          arrive: offset + minutes(target.arrival_time),
          routes: railRouteLabels.get(trip.route_id),
          transfers: 0
        };
        if (origin.station === AIRPORT) add(directOutbound, target.station, ride);
        else add(fromHub, `${origin.station}|${target.station}`, ride);
      }
    }
  }
}

for (const collection of [directInbound, directOutbound, toHub, fromHub]) {
  for (const rides of collection.values()) rides.sort((a, b) => a.depart - b.depart);
}

const railInbound = new Map(directInbound);
const railOutbound = new Map(directOutbound);
for (const station of martaNodes.map((node) => node.node_name)) {
  for (const hub of hubs) {
    const firstLegs = toHub.get(`${station}|${hub}`) || [];
    const secondLegs = directInbound.get(hub) || [];
    for (const first of firstLegs) {
      const second = findFirstAfter(secondLegs, first.arrive + model.rail_transfer_minutes);
      if (second && first.routes !== second.routes) add(railInbound, station, {
        from: station, to: AIRPORT, depart: first.depart, arrive: second.arrive,
        routes: `${first.routes}|${second.routes}`, transfers: 1
      });
    }
    const airportLegs = directOutbound.get(hub) || [];
    const secondLegsOut = fromHub.get(`${hub}|${station}`) || [];
    for (const first of airportLegs) {
      const second = findFirstAfter(secondLegsOut, first.arrive + model.rail_transfer_minutes);
      if (second && first.routes !== second.routes) add(railOutbound, station, {
        from: AIRPORT, to: station, depart: first.depart, arrive: second.arrive,
        routes: `${first.routes}|${second.routes}`, transfers: 1
      });
    }
  }
}
for (const collection of [railInbound, railOutbound]) {
  for (const [key, rides] of collection) {
    const unique = [...new Map(rides.map((ride) => [`${ride.depart}|${ride.arrive}`, ride])).values()];
    unique.sort((a, b) => a.depart - b.depart);
    collection.set(key, unique);
  }
}

const xpressStops = readCsv(path.join(xpressDir, "stops.txt"));
const martaCoordinates = martaNodes.map((node) => ({
  name: node.node_name,
  latitude: Number(node.latitude),
  longitude: Number(node.longitude)
}));
const xpressTransferStation = new Map();
for (const stop of xpressStops) {
  let nearest;
  let distance = Infinity;
  for (const station of martaCoordinates) {
    const candidate = haversineMiles(Number(stop.stop_lat), Number(stop.stop_lon), station.latitude, station.longitude);
    if (candidate < distance) {
      distance = candidate;
      nearest = station;
    }
  }
  if (distance <= 0.6) xpressTransferStation.set(stop.stop_id, nearest.name);
}

const xpressTrips = readCsv(path.join(xpressDir, "trips.txt"));
const xpressActive = activeServices(xpressDir, dates);
const activeXpressTrips = new Set(xpressTrips.filter((trip) => xpressActive.some((services) => services.has(trip.service_id))).map((trip) => trip.trip_id));
const xpressStopTimes = await readSelectedStopTimes(path.join(xpressDir, "stop_times.txt"), activeXpressTrips);
const xpressTripMeta = new Map(xpressTrips.map((trip) => [trip.trip_id, trip]));
const parkRideByStop = new Map(xpressNodes.map((node) => [node.stop_id, node]));
const xpressInbound = new Map();
const xpressOutbound = new Map();

for (const [tripId, stops] of xpressStopTimes) {
  const trip = xpressTripMeta.get(tripId);
  const activeDays = xpressActive.map((services, index) => services.has(trip.service_id) ? index : -1).filter((index) => index >= 0);
  for (let parkIndex = 0; parkIndex < stops.length; parkIndex++) {
    const parkNode = parkRideByStop.get(stops[parkIndex].stop_id);
    if (!parkNode) continue;
    for (let transferIndex = 0; transferIndex < stops.length; transferIndex++) {
      const station = xpressTransferStation.get(stops[transferIndex].stop_id);
      if (!station || transferIndex === parkIndex) continue;
      for (const day of activeDays) {
        const offset = day * 1440;
        if (parkIndex < transferIndex) {
          const busDepart = offset + minutes(stops[parkIndex].departure_time);
          const busArrive = offset + minutes(stops[transferIndex].arrival_time);
          const rail = findFirstAfter(railInbound.get(station) || [], busArrive + model.xpress_to_rail_transfer_minutes);
          if (rail) add(xpressInbound, parkNode.node_code, {
            from: parkNode.node_code, to: AIRPORT, depart: busDepart, arrive: rail.arrive,
            routes: `Xpress ${trip.route_id}|MARTA ${rail.routes}`, transfers: 1 + rail.transfers
          });
        } else {
          const busDepart = offset + minutes(stops[transferIndex].departure_time);
          const busArrive = offset + minutes(stops[parkIndex].arrival_time);
          const railOptions = [...(railOutbound.get(station) || [])].sort((a, b) => a.arrive - b.arrive);
          const rail = findLastArrivingBefore(railOptions, busDepart - model.xpress_to_rail_transfer_minutes);
          if (rail) add(xpressOutbound, parkNode.node_code, {
            from: AIRPORT, to: parkNode.node_code, depart: rail.depart, arrive: busArrive,
            routes: `MARTA ${rail.routes}|Xpress ${trip.route_id}`, transfers: 1 + rail.transfers
          });
        }
      }
    }
  }
}
for (const collection of [xpressInbound, xpressOutbound]) {
  for (const [key, rides] of collection) {
    const unique = [...new Map(rides.map((ride) => [`${ride.depart}|${ride.arrive}`, ride])).values()];
    unique.sort((a, b) => a.depart - b.depart);
    collection.set(key, unique);
  }
}

const accessKey = (row) => `${row.home_zcta}|${row.home_county}`;
const martaByHome = new Map(martaAccess.map((row) => [accessKey(row), row]));
const xpressByHome = new Map(xpressAccess.map((row) => [accessKey(row), row]));

function usableMartaOrigin(access) {
  if (access.nearest_marta_station !== AIRPORT) {
    return {
      station: access.nearest_marta_station,
      distance: Number(access.distance_to_marta_miles)
    };
  }
  let nearest;
  let distance = Infinity;
  for (const station of martaCoordinates.filter((candidate) => candidate.name !== AIRPORT)) {
    const candidateDistance = haversineMiles(
      Number(access.zcta_latitude),
      Number(access.zcta_longitude),
      station.latitude,
      station.longitude
    );
    if (candidateDistance < distance) {
      distance = candidateDistance;
      nearest = station;
    }
  }
  return { station: nearest.name, distance };
}

function bestInbound(rides, earliest, deadline) {
  return rides.filter((ride) => ride.arrive >= earliest && ride.arrive <= deadline)
    .sort((a, b) => b.depart - a.depart)[0] || null;
}

function bestOutbound(rides, ready, latestDeparture) {
  return rides.filter((ride) => ride.depart >= ready && ride.depart <= latestDeparture)
    .sort((a, b) => a.arrive - b.arrive)[0] || null;
}

function displayTime(value) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon+1", "Tue+1"];
  const day = Math.floor(value / 1440);
  const time = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(time / 60);
  const minute = time % 60;
  return `${dayNames[day] || `Day${day + 1}`} ${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function evaluateMode(member, inboundRides, outboundRides) {
  const transfer = destinationModel.destination_transfer_minutes[member.airport_destination];
  const start = minutes(member.shift_start_time);
  const end = start + Number(member.shift_hours) * 60;
  const days = member.work_days.split("|");
  let inboundDays = 0;
  let outboundDays = 0;
  let roundTrips = 0;
  let sampleInbound = null;
  let sampleOutbound = null;
  for (const day of days) {
    const offset = dayIndexes[day] * 1440;
    const inboundDeadline = offset + start - transfer;
    const outboundReady = offset + end + transfer;
    const inbound = bestInbound(inboundRides, inboundDeadline - model.maximum_early_arrival_minutes, inboundDeadline);
    const outbound = bestOutbound(outboundRides, outboundReady, outboundReady + model.maximum_post_shift_wait_minutes);
    if (inbound) inboundDays++;
    if (outbound) outboundDays++;
    if (inbound && outbound) {
      roundTrips++;
      if (!sampleInbound) {
        sampleInbound = inbound;
        sampleOutbound = outbound;
      }
    }
  }
  return {
    days: days.length,
    inboundDays,
    outboundDays,
    roundTrips,
    full: roundTrips === days.length,
    partial: roundTrips > 0,
    sampleInbound,
    sampleOutbound
  };
}

const results = members.map((member) => {
  const key = accessKey(member);
  const marta = martaByHome.get(key);
  const xpress = xpressByHome.get(key);
  const martaOrigin = usableMartaOrigin(marta);
  const martaResult = evaluateMode(
    member,
    railInbound.get(martaOrigin.station) || [],
    railOutbound.get(martaOrigin.station) || []
  );
  const xpressResult = evaluateMode(
    member,
    xpressInbound.get(xpress.nearest_xpress_node_code) || [],
    xpressOutbound.get(xpress.nearest_xpress_node_code) || []
  );
  const martaEligible = martaOrigin.distance <= model.marta_station_access_miles && martaResult.full;
  const xpressEligible = Number(xpress.distance_to_xpress_miles) <= model.xpress_park_ride_access_miles && xpressResult.full;
  const recommendation = martaEligible
    ? "marta"
    : xpressEligible
      ? "xpress_marta"
      : (martaResult.partial || xpressResult.partial)
        ? "partial_transit_then_carpool_vanpool"
        : "carpool_vanpool";
  return {
    ...member,
    nearest_marta_station: martaOrigin.station,
    distance_to_marta_miles: martaOrigin.distance.toFixed(2),
    marta_round_trip_days: martaResult.roundTrips,
    marta_full_schedule: martaEligible,
    marta_sample_inbound: martaResult.sampleInbound
      ? `${displayTime(martaResult.sampleInbound.depart)}-${displayTime(martaResult.sampleInbound.arrive)}; ${martaResult.sampleInbound.routes}; ${martaResult.sampleInbound.transfers} transfer(s)`
      : "",
    marta_sample_outbound: martaResult.sampleOutbound
      ? `${displayTime(martaResult.sampleOutbound.depart)}-${displayTime(martaResult.sampleOutbound.arrive)}; ${martaResult.sampleOutbound.routes}; ${martaResult.sampleOutbound.transfers} transfer(s)`
      : "",
    nearest_xpress_park_ride: xpress.nearest_xpress_park_ride,
    nearest_xpress_route_ids: xpress.nearest_xpress_route_ids,
    distance_to_xpress_miles: xpress.distance_to_xpress_miles,
    xpress_marta_round_trip_days: xpressResult.roundTrips,
    xpress_marta_full_schedule: xpressEligible,
    xpress_marta_sample_inbound: xpressResult.sampleInbound
      ? `${displayTime(xpressResult.sampleInbound.depart)}-${displayTime(xpressResult.sampleInbound.arrive)}; ${xpressResult.sampleInbound.routes}; ${xpressResult.sampleInbound.transfers} transfer(s)`
      : "",
    xpress_marta_sample_outbound: xpressResult.sampleOutbound
      ? `${displayTime(xpressResult.sampleOutbound.depart)}-${displayTime(xpressResult.sampleOutbound.arrive)}; ${xpressResult.sampleOutbound.routes}; ${xpressResult.sampleOutbound.transfers} transfer(s)`
      : "",
    transportation_recommendation: recommendation
  };
});

const outputHeaders = Object.keys(results[0]);
fs.writeFileSync(
  path.join(dataDir, "synthetic-population-combined-transit-viability.csv"),
  [outputHeaders.join(","), ...results.map((row) => outputHeaders.map((header) => csv(row[header])).join(","))].join("\n")
);

const count = (predicate) => results.filter(predicate).length;
const summary = {
  model_name: model.model_name,
  synthetic_members: results.length,
  marta_full_round_trip: count((row) => row.transportation_recommendation === "marta"),
  xpress_marta_full_round_trip: count((row) => row.transportation_recommendation === "xpress_marta"),
  partial_transit: count((row) => row.transportation_recommendation === "partial_transit_then_carpool_vanpool"),
  carpool_vanpool_priority: count((row) => row.transportation_recommendation === "carpool_vanpool"),
  by_shift_family: Object.fromEntries([...new Set(results.map((row) => row.shift_family))].map((family) => [family, {
    members: count((row) => row.shift_family === family),
    marta: count((row) => row.shift_family === family && row.transportation_recommendation === "marta"),
    xpress_marta: count((row) => row.shift_family === family && row.transportation_recommendation === "xpress_marta"),
    partial_transit: count((row) => row.shift_family === family && row.transportation_recommendation === "partial_transit_then_carpool_vanpool"),
    carpool_vanpool: count((row) => row.shift_family === family && row.transportation_recommendation === "carpool_vanpool")
  }]))
};
fs.writeFileSync(path.join(dataDir, "combined-transit-viability-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
