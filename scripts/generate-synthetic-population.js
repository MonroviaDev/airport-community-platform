import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFORCE_TOTAL = 65211;
const SYNTHETIC_TARGET = 6521;
const GENERATION_VERSION = "v2.3-destinations";
const RANDOM_SEED = "airport-community-platform-2026";

const dataDir = path.join(__dirname, "..", "data");

const workforcePath = path.join(dataDir, "atl-workforce-distribution.csv");
const scheduleModelPath = path.join(dataDir, "schedule-model-v1.json");
const destinationModelPath = path.join(dataDir, "destination-model-v1.json");
const outputPath = path.join(dataDir, "synthetic-population-v2.csv");

// ---------------------------------------------------------
// CSV utilities
// ---------------------------------------------------------

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function escapeCSV(value) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

// ---------------------------------------------------------
// Deterministic random utilities
// ---------------------------------------------------------

function stableRandom(key) {
  const hash = crypto
    .createHash("sha256")
    .update(`${RANDOM_SEED}:${key}`)
    .digest();

  return hash.readUInt32BE(0) / 0xffffffff;
}

function weightedChoice(items, key, weightField = "weight") {
  const random = stableRandom(key);

  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item[weightField]),
    0
  );

  let cursor = random * totalWeight;

  for (const item of items) {
    cursor -= Number(item[weightField]);

    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function integerBetween(min, max, key) {
  const random = stableRandom(key);

  return Math.floor(random * (max - min + 1)) + min;
}

// ---------------------------------------------------------
// Time utilities
// ---------------------------------------------------------

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function generateStartTime(startWindow, incrementMinutes, key) {
  const start = timeToMinutes(startWindow[0]);
  const end = timeToMinutes(startWindow[1]);

  const slots = Math.floor((end - start) / incrementMinutes) + 1;

  const slot = integerBetween(
    0,
    Math.max(slots - 1, 0),
    key
  );

  return minutesToTime(start + slot * incrementMinutes);
}

// ---------------------------------------------------------
// Load source files
// ---------------------------------------------------------

const workforceRaw = fs.readFileSync(workforcePath, "utf8").trim();

const lines = workforceRaw.split(/\r?\n/);
const headers = parseCSVLine(lines[0]);

const workforceRows = lines.slice(1).map((line) => {
  const values = parseCSVLine(line);
  const row = {};

  headers.forEach((header, index) => {
    row[header] = values[index];
  });

  row.atl_workers = Number(row.atl_workers);

  return row;
});

const scheduleModel = JSON.parse(
  fs.readFileSync(scheduleModelPath, "utf8")
);

const destinationModel = JSON.parse(
  fs.readFileSync(destinationModelPath, "utf8")
);

// ---------------------------------------------------------
// Validate source data
// ---------------------------------------------------------

const sourceTotal = workforceRows.reduce(
  (sum, row) => sum + row.atl_workers,
  0
);

if (sourceTotal !== WORKFORCE_TOTAL) {
  throw new Error(
    `Expected ${WORKFORCE_TOTAL} workers, found ${sourceTotal}.`
  );
}

const destinationShareTotal = Object.values(
  destinationModel.destinations
).reduce((sum, destination) => sum + Number(destination.share), 0);

if (Math.abs(destinationShareTotal - 1) > 0.000001) {
  throw new Error(
    `Destination shares must equal 1. Current total: ${destinationShareTotal}`
  );
}

// ---------------------------------------------------------
// Geographic allocation
// ---------------------------------------------------------

const allocations = workforceRows.map((row) => {
  const exact =
    (row.atl_workers / WORKFORCE_TOTAL) * SYNTHETIC_TARGET;

  const floor = Math.floor(exact);

  return {
    ...row,
    allocated: floor,
    remainder: exact - floor,
  };
});

const initiallyAllocated = allocations.reduce(
  (sum, row) => sum + row.allocated,
  0
);

const remaining = SYNTHETIC_TARGET - initiallyAllocated;

allocations.sort((a, b) => {
  if (b.remainder !== a.remainder) {
    return b.remainder - a.remainder;
  }

  return `${a.home_zcta}:${a.home_county}`.localeCompare(
    `${b.home_zcta}:${b.home_county}`
  );
});

for (let i = 0; i < remaining; i++) {
  allocations[i].allocated++;
}

allocations.sort((a, b) => {
  if (b.atl_workers !== a.atl_workers) {
    return b.atl_workers - a.atl_workers;
  }

  return `${a.home_zcta}:${a.home_county}`.localeCompare(
    `${b.home_zcta}:${b.home_county}`
  );
});

// ---------------------------------------------------------
// Build synthetic population
// ---------------------------------------------------------

const members = [];
let memberNumber = 1;

for (const area of allocations) {
  for (let i = 0; i < area.allocated; i++) {
    const syntheticId =
      `SYN-${String(memberNumber).padStart(5, "0")}`;

    members.push({
      synthetic_id: syntheticId,
      home_zcta: area.home_zcta,
      home_county: area.home_county,
      source_atl_workers: area.atl_workers,
      adoption_random: stableRandom(`${syntheticId}:adoption`),
      synthetic_generation_version: GENERATION_VERSION,
    });

    memberNumber++;
  }
}

// ---------------------------------------------------------
// Stable nested adoption ranking
// ---------------------------------------------------------

const ranked = [...members].sort((a, b) => {
  if (a.adoption_random !== b.adoption_random) {
    return a.adoption_random - b.adoption_random;
  }

  return a.synthetic_id.localeCompare(b.synthetic_id);
});

ranked.forEach((member, index) => {
  member.adoption_percentile =
    ((index + 1) / SYNTHETIC_TARGET) * 10;
});

// ---------------------------------------------------------
// Prepare schedule models
// ---------------------------------------------------------

const scheduleTypes = Object.entries(
  scheduleModel.schedule_types
).map(([name, config]) => ({
  name,
  ...config,
  weight: config.share,
}));

const shiftFamilies = Object.entries(
  scheduleModel.shift_families
).map(([name, config]) => ({
  name,
  ...config,
  weight: config.share,
}));

// ---------------------------------------------------------
// Prepare destination model
// ---------------------------------------------------------

const destinations = Object.entries(
  destinationModel.destinations
).map(([name, config]) => ({
  name,
  ...config,
  weight: config.share,
}));

// ---------------------------------------------------------
// Assign schedules and destinations
// ---------------------------------------------------------

for (const member of members) {
  const id = member.synthetic_id;

  // Schedule type
  const scheduleType = weightedChoice(
    scheduleTypes,
    `${id}:schedule-type`
  );

  // Shift family
  const shiftFamily = weightedChoice(
    shiftFamilies,
    `${id}:shift-family`
  );

  member.schedule_type = scheduleType.name;
  member.shift_family = shiftFamily.name;

  // Workdays
  let workDays;

  if (
    scheduleType.name === "standard" ||
    scheduleType.name === "compressed"
  ) {
    const patterns =
      scheduleModel.workday_patterns[scheduleType.name];

    workDays = weightedChoice(
      patterns,
      `${id}:workdays`
    ).days;
  } else {
    const allDays = [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ];

    const numberOfDays = integerBetween(
      scheduleType.min_work_days,
      scheduleType.max_work_days,
      `${id}:part-time-days`
    );

    const rankedDays = allDays
      .map((day) => ({
        day,
        random: stableRandom(
          `${id}:part-time-day:${day}`
        ),
      }))
      .sort((a, b) => a.random - b.random);

    workDays = rankedDays
      .slice(0, numberOfDays)
      .map((item) => item.day);
  }

  member.work_days = workDays.join("|");

  // Shift length
  let shiftHours;

  if (scheduleType.name === "part_time") {
    shiftHours = integerBetween(
      scheduleType.min_shift_hours,
      scheduleType.max_shift_hours,
      `${id}:shift-hours`
    );
  } else {
    shiftHours = scheduleType.typical_shift_hours;
  }

  member.shift_hours = shiftHours;

  // Shift start/end
  const startTime = generateStartTime(
    shiftFamily.start_window,
    scheduleModel.start_time_increment_minutes,
    `${id}:start-time`
  );

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + shiftHours * 60;

  member.shift_start_time = startTime;
  member.shift_end_time = minutesToTime(endMinutes);

  member.crosses_midnight =
    endMinutes >= 1440 ? "true" : "false";

  member.schedule_model_version =
    scheduleModel.model_name;

  // -------------------------------------------------------
  // Airport work destination
  // Uses an independent deterministic key
  // -------------------------------------------------------

  const destination = weightedChoice(
    destinations,
    `${id}:airport-destination`
  );

  member.airport_destination = destination.name;
  member.destination_model_version =
    destinationModel.model_name;
}

// ---------------------------------------------------------
// Validation
// ---------------------------------------------------------

if (members.length !== SYNTHETIC_TARGET) {
  throw new Error(
    `Expected ${SYNTHETIC_TARGET} synthetic members, generated ${members.length}.`
  );
}

const uniqueIds = new Set(
  members.map((member) => member.synthetic_id)
);

if (uniqueIds.size !== SYNTHETIC_TARGET) {
  throw new Error("Duplicate synthetic IDs detected.");
}

// ---------------------------------------------------------
// Output CSV
// ---------------------------------------------------------

const outputHeaders = [
  "synthetic_id",
  "home_zcta",
  "home_county",
  "source_atl_workers",
  "adoption_percentile",
  "synthetic_generation_version",
  "schedule_model_version",
  "destination_model_version",
  "schedule_type",
  "shift_family",
  "work_days",
  "shift_hours",
  "shift_start_time",
  "shift_end_time",
  "crosses_midnight",
  "airport_destination",
];

const outputLines = [
  outputHeaders.join(","),

  ...members.map((member) =>
    outputHeaders
      .map((header) => {
        if (header === "adoption_percentile") {
          return member[header].toFixed(3);
        }

        return escapeCSV(member[header]);
      })
      .join(",")
  ),
];

fs.writeFileSync(
  outputPath,
  outputLines.join("\n"),
  "utf8"
);

// ---------------------------------------------------------
// Diagnostic reporting
// ---------------------------------------------------------

function countBy(field) {
  const counts = {};

  for (const member of members) {
    const value = member[field];

    counts[value] = (counts[value] || 0) + 1;
  }

  return counts;
}

function printDistribution(title, field) {
  console.log("");
  console.log(title);
  console.log("----------------------------------");

  const counts = countBy(field);

  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const percent = (count / members.length) * 100;

      console.log(
        `${name.padEnd(24)} ${String(count).padStart(
          5
        )}  ${percent.toFixed(1)}%`
      );
    });
}

console.log("");
console.log("ATL Synthetic Population Generator");
console.log("----------------------------------");
console.log(
  `Source workforce:       ${sourceTotal.toLocaleString()}`
);
console.log(
  `Synthetic population:   ${members.length.toLocaleString()}`
);
console.log(`Generation version:     ${GENERATION_VERSION}`);
console.log(`Schedule model:         ${scheduleModel.model_name}`);
console.log(
  `Destination model:      ${destinationModel.model_name}`
);

printDistribution("Schedule Types", "schedule_type");
printDistribution("Shift Families", "shift_family");
printDistribution(
  "Airport Destinations",
  "airport_destination"
);

const weekendWorkers = members.filter((member) => {
  const days = member.work_days.split("|");

  return days.includes("sat") || days.includes("sun");
}).length;

const midnightWorkers = members.filter(
  (member) => member.crosses_midnight === "true"
).length;

console.log("");
console.log("Schedule Diagnostics");
console.log("----------------------------------");

console.log(
  `Weekend workers:        ${weekendWorkers.toLocaleString()} (${(
    (weekendWorkers / members.length) *
    100
  ).toFixed(1)}%)`
);

console.log(
  `Cross-midnight shifts:  ${midnightWorkers.toLocaleString()} (${(
    (midnightWorkers / members.length) *
    100
  ).toFixed(1)}%)`
);

console.log("");
console.log(`Created: ${outputPath}`);
console.log("");