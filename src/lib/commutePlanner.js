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

const testPersonaSpecs = [
  ["SYN-00012", "Amina B."],
  ["SYN-00198", "Carlos D."],
  ["SYN-00510", "Denise G."],
  ["SYN-00812", "Elijah H."],
  ["SYN-01104", "Fatima J."],
  ["SYN-01428", "Grace K."],
  ["SYN-01760", "Hector M."],
  ["SYN-02082", "Imani N."],
  ["SYN-02408", "Jamal P."],
  ["SYN-02732", "Keisha R."],
  ["SYN-03054", "Luis S."],
  ["SYN-03372", "Maya T."],
  ["SYN-03702", "Noah V."],
  ["SYN-04028", "Priya W."],
  ["SYN-04358", "Quentin A."],
  ["SYN-04682", "Rosa C."],
  ["SYN-05010", "Samuel F."],
  ["SYN-05334", "Tiana L."],
  ["SYN-05792", "Victor Q."],
  ["SYN-06312", "Zoe Y."],
];

export const demoProfiles = testPersonaSpecs.map(([id, name]) => {
  const member = commuteMembers.find((candidate) => candidate.synthetic_id === id);
  const county = member?.home_county?.replace(" County, GA", "") || "ATL region";
  const shift = member?.shift_family?.replace("_", "-") || "airport";

  return {
    id,
    label: `${name} — ${county} · ${shift} shift`,
    detail: `${member?.airport_destination || "Airport"} · ${member?.shift_start_time || "—"} to ${member?.shift_end_time || "—"}`,
  };
});

function minutes(time) {
  if (!time) return 0;
  const [hours, minute] = time.split(":").map(Number);
  return hours * 60 + minute;
}

function timeDistance(first, second) {
  const distance = Math.abs(minutes(first) - minutes(second));
  return Math.min(distance, 1440 - distance);
}

const syntheticFirstNames = [
  "Aaliyah", "Amina", "Andre", "Carlos", "Chandra", "Darius", "Denise",
  "Elijah", "Fatima", "Grace", "Hector", "Imani", "Jamal", "Keisha",
  "Luis", "Maya", "Noah", "Priya", "Quentin", "Rosa", "Samuel", "Tiana",
  "Victor", "Yasmin", "Zoe", "Angela", "Brandon", "Carmen", "Devon",
  "Erica", "Franklin", "Giselle", "Isaiah", "Jordan", "Kim", "Marcus",
];

const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function syntheticNumber(member) {
  return Number(member.synthetic_id.replace(/\D/g, "")) || 0;
}

function syntheticIdentity(member) {
  const number = syntheticNumber(member);
  const firstName = syntheticFirstNames[(number * 17) % syntheticFirstNames.length];
  const lastInitial = lastInitials[(number * 11) % lastInitials.length];
  return {
    name: `${firstName} ${lastInitial}.`,
    initials: `${firstName.charAt(0)}${lastInitial}`,
  };
}

function syntheticRole(member) {
  const roles = ["driver", "rider", "either", "driver", "rider"];
  return roles[syntheticNumber(member) % roles.length];
}

function rolesAreCompatible(viewerRole, candidateRole) {
  if (!viewerRole || viewerRole === "either") return true;
  if (viewerRole === "rider") return candidateRole !== "rider";
  if (viewerRole === "driver") return candidateRole !== "driver";
  return true;
}

function timeScore(distance, maximum) {
  if (distance <= 15) return maximum;
  if (distance <= 30) return Math.round(maximum * 0.82);
  if (distance <= 60) return Math.round(maximum * 0.58);
  if (distance <= 90) return Math.round(maximum * 0.3);
  return 0;
}

function commuteLabel(member) {
  if (member.transportation_recommendation === "marta") return "Usually uses MARTA";
  if (member.transportation_recommendation === "xpress_marta") {
    return "Uses Xpress + MARTA when schedules align";
  }
  if (member.transportation_recommendation.includes("partial")) {
    return "Uses transit for part of the commute";
  }
  return "Usually drives or gets a ride";
}

export function findSyntheticMatches(criteria, viewerRole = "either", limit = 18) {
  if (!criteria?.homeZip || !criteria?.destination) return [];

  const modeledViewer = findMember(criteria);
  if (!modeledViewer) return [];

  const requestedDays = new Set(criteria.days || []);

  return commuteMembers
    .filter((candidate) => candidate.synthetic_id !== modeledViewer.synthetic_id)
    .map((candidate) => {
      const candidateRole = syntheticRole(candidate);
      const commonDays = candidate.work_days
        .split("|")
        .filter((day) => requestedDays.has(day));
      const startDistance = timeDistance(candidate.shift_start_time, criteria.shiftStart);
      const endDistance = timeDistance(candidate.shift_end_time, criteria.shiftEnd);
      const sameZip = candidate.home_zcta === criteria.homeZip;
      const sameCounty = candidate.home_county === modeledViewer.home_county;
      const sameDestination = candidate.airport_destination === criteria.destination;

      if (!rolesAreCompatible(viewerRole, candidateRole)) return null;
      if (!sameDestination || commonDays.length < 2) return null;
      if (startDistance > 90 || endDistance > 90) return null;

      const geographyScore = sameZip ? 25 : sameCounty ? 14 : 4;
      const score = Math.min(
        99,
        20 +
          geographyScore +
          timeScore(startDistance, 18) +
          timeScore(endDistance, 14) +
          Math.min(commonDays.length * 4, 18) +
          (candidate.shift_family === modeledViewer.shift_family ? 4 : 0) +
          (syntheticNumber(candidate) % 4)
      );
      const identity = syntheticIdentity(candidate);

      return {
        id: candidate.synthetic_id,
        ...identity,
        role: candidateRole,
        score,
        commonDays,
        sameZip,
        sameCounty,
        homeZip: candidate.home_zcta,
        homeCounty: candidate.home_county,
        airportDestination: candidate.airport_destination,
        shiftStart: candidate.shift_start_time,
        shiftEnd: candidate.shift_end_time,
        currentCommute: commuteLabel(candidate),
      };
    })
    .filter(Boolean)
    .sort((first, second) => second.score - first.score || first.id.localeCompare(second.id))
    .slice(0, limit);
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
  const normalizedDays = Array.isArray(days) ? days : (days || "").split("|");

  return normalizedDays
    .filter(Boolean)
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
