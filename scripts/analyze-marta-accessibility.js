import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const dataDir = path.join(projectRoot, "data");

const workforcePath = path.join(
  dataDir,
  "atl-workforce-distribution.csv"
);

const syntheticPath = path.join(
  dataDir,
  "synthetic-population-v2.csv"
);

const martaPath = path.join(
  dataDir,
  "marta-rail-nodes.csv"
);

const zctaPath = path.join(
  dataDir,
  "census-zcta",
  "2023_Gaz_zcta_national.txt"
);

const outputPath = path.join(
  dataDir,
  "atl-workforce-marta-accessibility.csv"
);

const DISTANCE_THRESHOLDS = [2, 5, 10, 15, 20];

// ---------------------------------------------------------
// CSV parser
// ---------------------------------------------------------

function parseDelimited(text, delimiter = ",") {
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
    } else if (char === delimiter && !insideQuotes) {
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

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) =>
    String(header).trim()
  );

  return rows.slice(1).map((values) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] =
        values[index] !== undefined
          ? String(values[index]).trim()
          : "";
    });

    return record;
  });
}

function readCSV(filePath) {
  return parseDelimited(
    fs.readFileSync(filePath, "utf8"),
    ","
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
// Census Gazetteer parser
//
// Gazetteer files are tab-delimited.
// ---------------------------------------------------------

function readGazetteer(filePath) {
  const text = fs.readFileSync(filePath, "utf8");

  return parseDelimited(text, "\t");
}

// ---------------------------------------------------------
// Geography utilities
// ---------------------------------------------------------

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMiles(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadiusMiles = 3958.7613;

  const lat1 = degreesToRadians(latitude1);
  const lat2 = degreesToRadians(latitude2);

  const deltaLat = degreesToRadians(
    latitude2 - latitude1
  );

  const deltaLon = degreesToRadians(
    longitude2 - longitude1
  );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusMiles * c;
}

// ---------------------------------------------------------
// Load datasets
// ---------------------------------------------------------

console.log("");
console.log("ATL MARTA Accessibility Analyzer");
console.log("----------------------------------");

const workforceRows = readCSV(workforcePath);
const syntheticRows = readCSV(syntheticPath);
const martaStations = readCSV(martaPath);
const zctaRows = readGazetteer(zctaPath);

console.log(
  `Workforce rows:       ${workforceRows.length}`
);
console.log(
  `Synthetic members:    ${syntheticRows.length}`
);
console.log(
  `MARTA stations:       ${martaStations.length}`
);
console.log(
  `Census ZCTAs:         ${zctaRows.length}`
);

// ---------------------------------------------------------
// Identify Census Gazetteer columns
//
// Expected 2023 fields include:
// GEOID, INTPTLAT, INTPTLONG
// ---------------------------------------------------------

const sampleZcta = zctaRows[0] || {};

const geoidField = Object.keys(sampleZcta).find(
  (key) => key.toUpperCase() === "GEOID"
);

const latitudeField = Object.keys(sampleZcta).find(
  (key) => key.toUpperCase() === "INTPTLAT"
);

const longitudeField = Object.keys(sampleZcta).find(
  (key) => key.toUpperCase() === "INTPTLONG"
);

if (
  !geoidField ||
  !latitudeField ||
  !longitudeField
) {
  console.log("");
  console.log(
    "Gazetteer columns found:"
  );
  console.log(Object.keys(sampleZcta));

  throw new Error(
    "Could not identify GEOID, INTPTLAT and INTPTLONG in Census Gazetteer file."
  );
}

// ---------------------------------------------------------
// Build ZCTA coordinate lookup
// ---------------------------------------------------------

const zctaLookup = new Map();

for (const row of zctaRows) {
  const zcta = String(row[geoidField]).padStart(
    5,
    "0"
  );

  const latitude = Number(row[latitudeField]);
  const longitude = Number(row[longitudeField]);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    zctaLookup.set(zcta, {
      latitude,
      longitude,
    });
  }
}

// ---------------------------------------------------------
// Validate MARTA coordinates
// ---------------------------------------------------------

const stations = martaStations.map((station) => {
  const latitude = Number(station.latitude);
  const longitude = Number(station.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      `Invalid MARTA coordinates for ${station.node_name}`
    );
  }

  return {
    ...station,
    latitude,
    longitude,
  };
});

if (stations.length !== 38) {
  throw new Error(
    `Expected 38 MARTA stations, found ${stations.length}.`
  );
}

// ---------------------------------------------------------
// Synthetic population count by ZCTA
// ---------------------------------------------------------

const syntheticByZcta = new Map();

for (const member of syntheticRows) {
  const zcta = String(member.home_zcta).padStart(
    5,
    "0"
  );

  syntheticByZcta.set(
    zcta,
    (syntheticByZcta.get(zcta) || 0) + 1
  );
}

// ---------------------------------------------------------
// Nearest MARTA station for each workforce row
// ---------------------------------------------------------

const results = [];
const missingZctas = new Set();

for (const row of workforceRows) {
  const zcta = String(row.home_zcta).padStart(
    5,
    "0"
  );

  const coordinates = zctaLookup.get(zcta);

  if (!coordinates) {
    missingZctas.add(zcta);
    continue;
  }

  let nearestStation = null;
  let nearestDistance = Infinity;

  for (const station of stations) {
    const distance = haversineMiles(
      coordinates.latitude,
      coordinates.longitude,
      station.latitude,
      station.longitude
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStation = station;
    }
  }

  results.push({
    home_zcta: zcta,
    home_county: row.home_county,
    atl_workers: Number(row.atl_workers),
    synthetic_members: syntheticRows.filter(
  (member) =>
    String(member.home_zcta).padStart(5, "0") === zcta &&
    String(member.home_county).trim() === String(row.home_county).trim()
).length,
    zcta_latitude:
      coordinates.latitude.toFixed(6),
    zcta_longitude:
      coordinates.longitude.toFixed(6),
    nearest_marta_station:
      nearestStation.node_name,
    nearest_marta_node_code:
      nearestStation.node_code,
    distance_to_marta_miles:
      nearestDistance.toFixed(2),
  });
}

// ---------------------------------------------------------
// Write detailed output
// ---------------------------------------------------------

const outputHeaders = [
  "home_zcta",
  "home_county",
  "atl_workers",
  "synthetic_members",
  "zcta_latitude",
  "zcta_longitude",
  "nearest_marta_station",
  "nearest_marta_node_code",
  "distance_to_marta_miles",
];

const outputLines = [
  outputHeaders.join(","),

  ...results.map((row) =>
    outputHeaders
      .map((header) =>
        escapeCSV(row[header])
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
// Accessibility summaries
// ---------------------------------------------------------

const modeledWorkerTotal = results.reduce(
  (sum, row) => sum + row.atl_workers,
  0
);

const syntheticTotal = syntheticRows.length;

console.log("");
console.log("Workforce Accessibility");
console.log("----------------------------------");

for (const threshold of DISTANCE_THRESHOLDS) {
  const workers = results
    .filter(
      (row) =>
        Number(row.distance_to_marta_miles) <=
        threshold
    )
    .reduce(
      (sum, row) => sum + row.atl_workers,
      0
    );

  const percent =
    modeledWorkerTotal > 0
      ? (workers / modeledWorkerTotal) * 100
      : 0;

  console.log(
    `Within ${String(threshold).padStart(
      2
    )} mi: ${workers
      .toLocaleString()
      .padStart(7)} workers  ${percent
      .toFixed(1)
      .padStart(5)}%`
  );
}

console.log("");
console.log("Synthetic Population Accessibility");
console.log("----------------------------------");

for (const threshold of DISTANCE_THRESHOLDS) {
  const members = results
    .filter(
      (row) =>
        Number(row.distance_to_marta_miles) <=
        threshold
    )
    .reduce(
      (sum, row) =>
        sum + row.synthetic_members,
      0
    );

  const percent =
    syntheticTotal > 0
      ? (members / syntheticTotal) * 100
      : 0;

  console.log(
    `Within ${String(threshold).padStart(
      2
    )} mi: ${members
      .toLocaleString()
      .padStart(6)} members  ${percent
      .toFixed(1)
      .padStart(5)}%`
  );
}

// ---------------------------------------------------------
// Highest-volume ZCTAs without close MARTA access
// ---------------------------------------------------------

const underserved = [...results]
  .filter(
    (row) =>
      Number(row.distance_to_marta_miles) > 10
  )
  .sort(
    (a, b) => b.atl_workers - a.atl_workers
  )
  .slice(0, 15);

console.log("");
console.log(
  "Largest Workforce Areas >10 Miles From MARTA"
);
console.log("----------------------------------");

for (const row of underserved) {
  console.log(
    `${row.home_zcta}  ` +
    `${String(row.home_county).padEnd(12)} ` +
    `${row.atl_workers
      .toLocaleString()
      .padStart(6)} workers  ` +
    `${String(row.distance_to_marta_miles).padStart(
      6
    )} mi  ` +
    `${row.nearest_marta_station}`
  );
}

// ---------------------------------------------------------
// Missing geography
// ---------------------------------------------------------

console.log("");
console.log("Geography Validation");
console.log("----------------------------------");
console.log(
  `Workforce rows analyzed: ${results.length}`
);
console.log(
  `Missing ZCTAs:            ${missingZctas.size}`
);

if (missingZctas.size > 0) {
  console.log(
    `Missing: ${[...missingZctas]
      .sort()
      .join(", ")}`
  );
}

console.log("");
console.log(`Created: ${outputPath}`);
console.log("");