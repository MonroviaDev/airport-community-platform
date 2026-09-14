import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..");
const gtfsDir = path.join(projectRoot, "data", "marta-gtfs");

const outputPath = path.join(
  projectRoot,
  "data",
  "marta-rail-nodes.csv"
);

// ---------------------------------------------------------
// CSV utilities
// ---------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(field);

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows[0];

  return rows.slice(1).map((values) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record;
  });
}

function readGTFS(filename) {
  return parseCSV(
    fs.readFileSync(
      path.join(gtfsDir, filename),
      "utf8"
    )
  );
}

function escapeCSV(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

// ---------------------------------------------------------
// Station-name normalization
// ---------------------------------------------------------

function normalizeStationName(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function nodeCodeFromName(name) {
  return (
    "MARTA-" +
    name
      .replace(/\bSTATION\b/gi, "")
      .trim()
      .replace(/[^A-Z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase()
  );
}

// ---------------------------------------------------------
// Load GTFS
// ---------------------------------------------------------

console.log("");
console.log("MARTA Rail Node Extractor");
console.log("----------------------------------");

const routes = readGTFS("routes.txt");
const trips = readGTFS("trips.txt");
const stopTimes = readGTFS("stop_times.txt");
const stops = readGTFS("stops.txt");

console.log(`Routes loaded:       ${routes.length}`);
console.log(`Trips loaded:        ${trips.length}`);
console.log(`Stop times loaded:   ${stopTimes.length}`);
console.log(`Stops loaded:        ${stops.length}`);

// ---------------------------------------------------------
// Identify rail routes
// GTFS route_type 1 = subway / metro
// ---------------------------------------------------------

const railRoutes = routes.filter(
  (route) => String(route.route_type) === "1"
);

const railRouteIds = new Set(
  railRoutes.map((route) => route.route_id)
);

console.log("");
console.log(`Rail routes found:   ${railRoutes.length}`);

railRoutes.forEach((route) => {
  console.log(
    `  ${route.route_id} - ${
      route.route_long_name ||
      route.route_short_name ||
      "Unnamed"
    }`
  );
});

// ---------------------------------------------------------
// Rail trips
// ---------------------------------------------------------

const railTripIds = new Set(
  trips
    .filter((trip) =>
      railRouteIds.has(trip.route_id)
    )
    .map((trip) => trip.trip_id)
);

console.log(
  `Rail trips found:    ${railTripIds.size}`
);

// ---------------------------------------------------------
// Rail stop IDs
// ---------------------------------------------------------

const railStopIds = new Set();

for (const stopTime of stopTimes) {
  if (railTripIds.has(stopTime.trip_id)) {
    railStopIds.add(stopTime.stop_id);
  }
}

console.log(
  `Rail stop IDs used:  ${railStopIds.size}`
);

// ---------------------------------------------------------
// Select rail stops
// ---------------------------------------------------------

const railStops = stops.filter((stop) =>
  railStopIds.has(stop.stop_id)
);

// ---------------------------------------------------------
// Consolidate platform records by normalized station name
// ---------------------------------------------------------

const stationGroups = new Map();

for (const stop of railStops) {
  const normalizedName =
    normalizeStationName(stop.stop_name);

  const latitude = Number(stop.stop_lat);
  const longitude = Number(stop.stop_lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      `Invalid coordinates for stop ${stop.stop_id}`
    );
  }

  if (!stationGroups.has(normalizedName)) {
    stationGroups.set(normalizedName, {
      node_name: normalizedName,
      latitudes: [],
      longitudes: [],
      gtfs_stop_ids: [],
    });
  }

  const group = stationGroups.get(normalizedName);

  group.latitudes.push(latitude);
  group.longitudes.push(longitude);
  group.gtfs_stop_ids.push(stop.stop_id);
}

// ---------------------------------------------------------
// Convert each station group into one node
// ---------------------------------------------------------

const stations = [];

for (const group of stationGroups.values()) {
  const latitude =
    group.latitudes.reduce(
      (sum, value) => sum + value,
      0
    ) / group.latitudes.length;

  const longitude =
    group.longitudes.reduce(
      (sum, value) => sum + value,
      0
    ) / group.longitudes.length;

  const isAirport =
    group.node_name === "AIRPORT STATION";

  stations.push({
    node_code: nodeCodeFromName(
      group.node_name
    ),
    node_name: group.node_name,
    node_type: "marta_rail",
    operator_name: "MARTA",
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    gtfs_stop_ids:
      group.gtfs_stop_ids
        .sort()
        .join("|"),
    platform_count:
      group.gtfs_stop_ids.length,
    connects_to_airport:
      isAirport ? "true" : "false",
    direct_airport_connection:
      isAirport ? "true" : "false",
    active: "true",
  });
}

// ---------------------------------------------------------
// Sort alphabetically
// ---------------------------------------------------------

stations.sort((a, b) =>
  a.node_name.localeCompare(b.node_name)
);

// ---------------------------------------------------------
// Validation
// ---------------------------------------------------------

const nodeCodes = new Set(
  stations.map((station) => station.node_code)
);

if (nodeCodes.size !== stations.length) {
  throw new Error(
    "Duplicate MARTA node codes detected."
  );
}

const airportStations = stations.filter(
  (station) =>
    station.node_name === "AIRPORT STATION"
);

if (airportStations.length !== 1) {
  throw new Error(
    `Expected exactly one Airport Station node, found ${airportStations.length}.`
  );
}

// MARTA's current heavy-rail network should resolve
// to 38 station-level nodes.
if (stations.length !== 38) {
  console.warn("");
  console.warn(
    `WARNING: Expected 38 station-level nodes but found ${stations.length}.`
  );
  console.warn(
    "Do not import into Supabase until this difference is reviewed."
  );
}

// ---------------------------------------------------------
// Output
// ---------------------------------------------------------

const outputHeaders = [
  "node_code",
  "node_name",
  "node_type",
  "operator_name",
  "latitude",
  "longitude",
  "gtfs_stop_ids",
  "platform_count",
  "connects_to_airport",
  "direct_airport_connection",
  "active",
];

const outputLines = [
  outputHeaders.join(","),

  ...stations.map((station) =>
    outputHeaders
      .map((header) =>
        escapeCSV(station[header])
      )
      .join(",")
  ),
];

fs.writeFileSync(
  outputPath,
  outputLines.join("\n"),
  "utf8"
);

// ---------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------

console.log("");
console.log("Station-Level Nodes");
console.log("----------------------------------");
console.log(
  `Unique rail stations: ${stations.length}`
);

console.log("");

for (const station of stations) {
  console.log(
    `${station.node_name.padEnd(36)} ` +
    `${station.latitude}, ${station.longitude}  ` +
    `platforms:${station.platform_count}`
  );
}

const airport = airportStations[0];

console.log("");
console.log("Airport Station Validation");
console.log("----------------------------------");
console.log(
  `Node code:            ${airport.node_code}`
);
console.log(
  `Platform records:     ${airport.platform_count}`
);
console.log(
  `GTFS stop IDs:        ${airport.gtfs_stop_ids}`
);
console.log(
  `Station coordinate:   ${airport.latitude}, ${airport.longitude}`
);

console.log("");
console.log(`Created: ${outputPath}`);
console.log("");