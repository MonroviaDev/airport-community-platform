import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

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

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const model = JSON.parse(fs.readFileSync(path.join(dataDir, "vanpool-opportunity-model-v1.json"), "utf8"));
const members = readCsv(path.join(dataDir, "synthetic-population-combined-transit-viability.csv"));
const geography = readCsv(path.join(dataDir, "atl-workforce-marta-accessibility.csv"));
const geographyByHome = new Map(geography.map((row) => [`${row.home_zcta}|${row.home_county}`, row]));

const candidates = members.filter((member) => !["marta", "xpress_marta"].includes(member.transportation_recommendation));
const clusters = new Map();

for (const member of candidates) {
  const geo = geographyByHome.get(`${member.home_zcta}|${member.home_county}`);
  if (!geo) throw new Error(`Missing geography for ${member.synthetic_id}`);
  const latitude = Math.round(Number(geo.zcta_latitude) / model.geographic_grid_degrees) * model.geographic_grid_degrees;
  const longitude = Math.round(Number(geo.zcta_longitude) / model.geographic_grid_degrees) * model.geographic_grid_degrees;
  const startHour = Number(member.shift_start_time.slice(0, 2));
  const bucketStart = Math.floor(startHour / model.shift_start_bucket_hours) * model.shift_start_bucket_hours;
  const key = [latitude.toFixed(1), longitude.toFixed(1), member.airport_destination, member.shift_family, bucketStart].join("|");
  if (!clusters.has(key)) clusters.set(key, { latitude, longitude, bucketStart, members: [] });
  clusters.get(key).members.push(member);
}

const opportunities = [...clusters.values()]
  .filter((cluster) => cluster.members.length >= model.minimum_cluster_members)
  .map((cluster) => {
    const first = cluster.members[0];
    const scheduleCounts = new Map();
    for (const member of cluster.members) {
      const scheduleKey = `${member.work_days}~${member.shift_start_time}~${member.shift_end_time}`;
      scheduleCounts.set(scheduleKey, (scheduleCounts.get(scheduleKey) || 0) + 1);
    }
    const [dominantSchedule, dominantCount] = [...scheduleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const [dominantDays, dominantStart, dominantEnd] = dominantSchedule.split("~");
    const noTransit = cluster.members.filter((member) => member.transportation_recommendation === "carpool_vanpool").length;
    const partialTransit = cluster.members.length - noTransit;
    const counties = [...new Set(cluster.members.map((member) => member.home_county))].sort();
    const zctas = [...new Set(cluster.members.map((member) => member.home_zcta))].sort();
    const status = dominantCount >= model.minimum_exact_schedule_subgroup
      ? "ready_for_opt_in_recruitment"
      : cluster.members.length >= 10
        ? "promising_needs_schedule_refinement"
        : "exploratory";
    return {
      cluster_id: "",
      grid_center_latitude: cluster.latitude.toFixed(3),
      grid_center_longitude: cluster.longitude.toFixed(3),
      home_counties: counties.join("|"),
      home_zctas: zctas.join("|"),
      airport_destination: first.airport_destination,
      shift_family: first.shift_family,
      start_window: `${String(cluster.bucketStart).padStart(2, "0")}:00-${String((cluster.bucketStart + model.shift_start_bucket_hours) % 24).padStart(2, "0")}:00`,
      synthetic_candidate_members: cluster.members.length,
      estimated_workforce_equivalents: cluster.members.length * model.synthetic_to_workforce_scale,
      no_transit_priority_members: noTransit,
      partial_transit_members: partialTransit,
      dominant_work_days: dominantDays,
      dominant_shift_start: dominantStart,
      dominant_shift_end: dominantEnd,
      largest_exact_schedule_subgroup: dominantCount,
      potential_five_rider_vanpools: Math.floor(dominantCount / 5),
      opportunity_status: status
    };
  })
  .sort((a, b) => b.no_transit_priority_members - a.no_transit_priority_members || b.synthetic_candidate_members - a.synthetic_candidate_members)
  .map((row, index) => ({ ...row, cluster_id: `VAN-${String(index + 1).padStart(3, "0")}` }));

const headers = Object.keys(opportunities[0]);
fs.writeFileSync(
  path.join(dataDir, "vanpool-opportunity-clusters.csv"),
  [headers.join(","), ...opportunities.map((row) => headers.map((header) => csv(row[header])).join(","))].join("\n")
);

const summary = {
  model_name: model.model_name,
  transit_gap_members: candidates.length,
  opportunity_clusters: opportunities.length,
  members_in_opportunity_clusters: opportunities.reduce((sum, row) => sum + row.synthetic_candidate_members, 0),
  ready_for_opt_in_recruitment: opportunities.filter((row) => row.opportunity_status === "ready_for_opt_in_recruitment").length,
  promising_needs_schedule_refinement: opportunities.filter((row) => row.opportunity_status === "promising_needs_schedule_refinement").length,
  exploratory: opportunities.filter((row) => row.opportunity_status === "exploratory").length,
  modeled_exact_schedule_five_rider_capacity: opportunities.reduce((sum, row) => sum + row.potential_five_rider_vanpools, 0),
  top_clusters: opportunities.slice(0, 15)
};
fs.writeFileSync(path.join(dataDir, "vanpool-opportunity-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
