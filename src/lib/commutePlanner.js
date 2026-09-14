import memberCsv from "../../data/synthetic-population-combined-transit-viability.csv?raw";
import vanpoolCsv from "../../data/vanpool-opportunity-clusters.csv?raw";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] || ""]))
  );
}

export const commuteMembers = parseCsv(memberCsv);
export const vanpoolClusters = parseCsv(vanpoolCsv);

export const demoProfiles = [
  {
    id: "SYN-00012",
    label: "Early-morning employee from South Fulton",
    detail: "Domestic Terminal · 5:00 AM to 1:00 PM",
  },
  {
    id: "SYN-00198",
    label: "Day-shift employee from Newnan",
    detail: "Domestic Terminal · 7:30 AM to 3:30 PM",
  },
  {
    id: "SYN-00002",
    label: "Evening employee near College Park",
    detail: "Domestic Terminal · 4:30 PM to 12:30 AM",
  },
  {
    id: "SYN-00003",
    label: "Overnight employee in South Fulton",
    detail: "South Cargo · 7:30 PM to 3:30 AM",
  },
];

function minutes(time) {
  if (!time) return 0;
  const [hours, minute] = time.split(":").map(Number);
  return hours * 60 + minute;
}

function timeDistance(first, second) {
  const distance = Math.abs(minutes(first) - minutes(second));
  return Math.min(distance, 1440 - distance);
}

export function findMember(criteria) {
  if (criteria.syntheticId) {
    return commuteMembers.find(
      (member) => member.synthetic_id === criteria.syntheticId
    );
  }

  const candidates = commuteMembers.filter(
    (member) =>
      member.home_zcta === criteria.homeZip &&
      member.airport_destination === criteria.destination
  );

  const fallback = commuteMembers.filter(
    (member) => member.home_zcta === criteria.homeZip
  );
  const pool = candidates.length ? candidates : fallback;
  if (!pool.length) return null;

  const requestedDays = new Set(criteria.days || []);

  return [...pool].sort((first, second) => {
    const firstDayMatches = first.work_days
      .split("|")
      .filter((day) => requestedDays.has(day)).length;
    const secondDayMatches = second.work_days
      .split("|")
      .filter((day) => requestedDays.has(day)).length;
    const firstScore =
      timeDistance(first.shift_start_time, criteria.shiftStart) +
      timeDistance(first.shift_end_time, criteria.shiftEnd) -
      firstDayMatches * 15;
    const secondScore =
      timeDistance(second.shift_start_time, criteria.shiftStart) +
      timeDistance(second.shift_end_time, criteria.shiftEnd) -
      secondDayMatches * 15;
    return firstScore - secondScore;
  })[0];
}

export function findVanpoolCluster(member) {
  const exact = vanpoolClusters.find(
    (cluster) =>
      cluster.home_zctas.split("|").includes(member.home_zcta) &&
      cluster.airport_destination === member.airport_destination &&
      cluster.shift_family === member.shift_family
  );

  return (
    exact ||
    vanpoolClusters.find(
      (cluster) =>
        cluster.home_zctas.split("|").includes(member.home_zcta) &&
        cluster.shift_family === member.shift_family
    ) ||
    null
  );
}

export function displayDays(days) {
  return days
    .split("|")
    .map((day) => day.charAt(0).toUpperCase() + day.slice(1, 3))
    .join(" · ");
}

export function displayTime(time) {
  if (!time) return "—";
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export function parseTripSummary(summary) {
  if (!summary) return null;
  const [timing, modes = ""] = summary.split("; ");
  return {
    timing,
    modes: modes.replaceAll("|", " → "),
  };
}
