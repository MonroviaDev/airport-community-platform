import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const gtfsDir = path.join(dataDir, "marta-gtfs");

function parseCsvLine(line) {
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
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])));
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function addDays(date, count) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

const model = JSON.parse(fs.readFileSync(path.join(dataDir, "marta-viability-model-v1.json"), "utf8"));
const members = readCsv(path.join(dataDir, "synthetic-population-v2.csv"));
const accessibility = readCsv(path.join(dataDir, "atl-workforce-marta-accessibility.csv"));
const routes = readCsv(path.join(gtfsDir, "routes.txt"));
const trips = readCsv(path.join(gtfsDir, "trips.txt"));
const calendar = readCsv(path.join(gtfsDir, "calendar.txt"));
const exceptionsPath = path.join(gtfsDir, "calendar_dates.txt");
const exceptions = fs.existsSync(exceptionsPath) ? readCsv(exceptionsPath) : [];

const railRouteIds = new Set(routes.filter((route) => route.route_type === "1").map((route) => route.route_id));
const airportStopIds = new Set(
  readCsv(path.join(dataDir, "marta-rail-nodes.csv"))
    .find((node) => node.node_code === "MARTA-AIRPORT")
    .gtfs_stop_ids.split("|")
);

const weekStart = new Date(`${model.service_week_start}T00:00:00Z`);
const dates = Array.from({ length: 9 }, (_, index) => addDays(weekStart, index));
const weekdayFields = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function activeServices(date) {
  const key = dateKey(date);
  const dayField = weekdayFields[date.getUTCDay()];
  const active = new Set(
    calendar
      .filter((row) => row.start_date <= key && row.end_date >= key && row[dayField] === "1")
      .map((row) => row.service_id)
  );
  for (const exception of exceptions.filter((row) => row.date === key)) {
    if (exception.exception_type === "1") active.add(exception.service_id);
    if (exception.exception_type === "2") active.delete(exception.service_id);
  }
  return active;
}

const activeByDate = dates.map(activeServices);
const tripDates = new Map();
for (const trip of trips) {
  if (!railRouteIds.has(trip.route_id)) continue;
  const activeIndexes = activeByDate
    .map((services, index) => (services.has(trip.service_id) ? index : -1))
    .filter((index) => index >= 0);
  if (activeIndexes.length) tripDates.set(trip.trip_id, activeIndexes);
}

const arrivals = [];
const departures = [];
const stream = fs.createReadStream(path.join(gtfsDir, "stop_times.txt"));
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
let headers;
for await (const line of lines) {
  if (!headers) {
    headers = parseCsvLine(line);
    continue;
  }
  const values = parseCsvLine(line);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  if (!airportStopIds.has(row.stop_id) || !tripDates.has(row.trip_id)) continue;
  for (const dayIndex of tripDates.get(row.trip_id)) {
    arrivals.push(dayIndex * 1440 + timeToMinutes(row.arrival_time));
    departures.push(dayIndex * 1440 + timeToMinutes(row.departure_time));
  }
}
arrivals.sort((a, b) => a - b);
departures.sort((a, b) => a - b);

const accessByZctaCounty = new Map(
  accessibility.map((row) => [`${row.home_zcta}|${row.home_county}`, row])
);
const dayIndex = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function hasEventBetween(events, minimum, maximum) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (events[middle] < minimum) low = middle + 1;
    else high = middle;
  }
  return low < events.length && events[low] <= maximum;
}

const output = members.map((member) => {
  const access = accessByZctaCounty.get(`${member.home_zcta}|${member.home_county}`);
  if (!access) throw new Error(`Missing access row for ${member.synthetic_id}`);
  const distance = Number(access.distance_to_marta_miles);
  const transfer = model.destination_transfer_minutes[member.airport_destination];
  const start = timeToMinutes(member.shift_start_time);
  const end = start + Number(member.shift_hours) * 60;
  const workDays = member.work_days.split("|");
  let supported = 0;
  let inboundSupported = 0;
  let outboundSupported = 0;
  for (const day of workDays) {
    const offset = dayIndex[day] * 1440;
    const shiftStart = offset + start;
    const shiftEnd = offset + end;
    const inboundDeadline = shiftStart - transfer;
    const outboundReady = shiftEnd + transfer;
    const inbound = hasEventBetween(arrivals, inboundDeadline - model.maximum_early_arrival_minutes, inboundDeadline);
    const outbound = hasEventBetween(departures, outboundReady, outboundReady + model.maximum_post_shift_wait_minutes);
    if (inbound) inboundSupported++;
    if (outbound) outboundSupported++;
    if (inbound && outbound) supported++;
  }
  const scheduleShare = supported / workDays.length;
  const accessTier = distance <= 2 ? "near_station" : distance <= 5 ? "short_drive" : distance <= 10 ? "park_and_ride" : "outside_rail_catchment";
  const finalMileRequired = model.destinations_requiring_final_mile_validation.includes(member.airport_destination);
  return {
    ...member,
    nearest_marta_station: access.nearest_marta_station,
    distance_to_marta_miles: distance.toFixed(2),
    marta_access_tier: accessTier,
    marta_inbound_days_supported: inboundSupported,
    marta_outbound_days_supported: outboundSupported,
    marta_round_trip_days_supported: supported,
    marta_schedule_support_percent: (scheduleShare * 100).toFixed(1),
    marta_schedule_status: scheduleShare === 1 ? "full" : scheduleShare > 0 ? "partial" : "none",
    final_mile_validation_required: finalMileRequired,
    marta_candidate: distance <= model.station_access_threshold_miles && scheduleShare === 1
  };
});

const headersOut = Object.keys(output[0]);
fs.writeFileSync(
  path.join(dataDir, "synthetic-population-marta-viability.csv"),
  [headersOut.join(","), ...output.map((row) => headersOut.map((header) => csv(row[header])).join(","))].join("\n")
);

const count = (predicate) => output.filter(predicate).length;
const summary = {
  model_name: model.model_name,
  synthetic_members: output.length,
  station_access_within_10_miles: count((row) => Number(row.distance_to_marta_miles) <= 10),
  full_schedule_support: count((row) => row.marta_schedule_status === "full"),
  partial_schedule_support: count((row) => row.marta_schedule_status === "partial"),
  no_schedule_support: count((row) => row.marta_schedule_status === "none"),
  full_marta_candidates_within_10_miles: count((row) => row.marta_candidate),
  candidates_requiring_final_mile_validation: count((row) => row.marta_candidate && row.final_mile_validation_required),
  by_shift_family: Object.fromEntries(
    [...new Set(output.map((row) => row.shift_family))].map((family) => [family, {
      members: count((row) => row.shift_family === family),
      full_schedule_support: count((row) => row.shift_family === family && row.marta_schedule_status === "full"),
      full_candidates_within_10_miles: count((row) => row.shift_family === family && row.marta_candidate)
    }])
  )
};
fs.writeFileSync(path.join(dataDir, "marta-schedule-viability-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
