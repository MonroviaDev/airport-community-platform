import memberCsv from "../../data/synthetic-population-combined-transit-viability.csv?raw";
import vanpoolCsv from "../../data/vanpool-opportunity-clusters.csv?raw";
import geographyCsv from "../../data/atl-workforce-marta-accessibility.csv?raw";
import { martaStations } from "./martaStations";

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
const zctaGeography = parseCsv(geographyCsv);
const geographyByZcta = new Map(
  zctaGeography.map((area) => [area.home_zcta, area])
);

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
  const shift = member?.shift_family?.replace("_", "-") || "airport";

  return {
    id,
    label: `${name} — ${shift} shift · ${member?.airport_destination || "Airport"}`,
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

const airportDestinations = {
  "Domestic Terminal": { latitude: 33.6407, longitude: -84.4463 },
  "International Terminal": { latitude: 33.6401, longitude: -84.4197 },
  "Delta TechOps": { latitude: 33.6489, longitude: -84.4334 },
  "Delta G.O.": { latitude: 33.6563, longitude: -84.4214 },
  "North Cargo Area": { latitude: 33.6559, longitude: -84.4518 },
  "South Cargo Area": { latitude: 33.6262, longitude: -84.4384 },
  "Rental Car Center": { latitude: 33.6522, longitude: -84.4638 },
  "Other Airport Area": { latitude: 33.6407, longitude: -84.4277 },
};

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMiles(first, second) {
  if (!first || !second) return null;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const latitude1 = radians(first.latitude);
  const latitude2 = radians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function syntheticOrigin(member) {
  const geography = geographyByZcta.get(member.home_zcta);
  if (!geography) return null;

  const center = {
    latitude: Number(geography.zcta_latitude),
    longitude: Number(geography.zcta_longitude),
  };
  const number = syntheticNumber(member);
  const angle = radians((number * 137.508) % 360);
  const radiusMiles = 0.35 + ((number * 47) % 260) / 100;
  const latitudeOffset = (Math.sin(angle) * radiusMiles) / 69;
  const longitudeOffset =
    (Math.cos(angle) * radiusMiles) /
    (69 * Math.cos(radians(center.latitude)));

  return {
    latitude: center.latitude + latitudeOffset,
    longitude: center.longitude + longitudeOffset,
  };
}

function viewerOrigin(criteria, member) {
  const latitude = Number(criteria?.originZone?.latitude);
  const longitude = Number(criteria?.originZone?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }
  return syntheticOrigin(member);
}

function proximityScore(distance) {
  if (distance <= 1) return 30;
  if (distance <= 2) return 25;
  if (distance <= 4) return 19;
  if (distance <= 7) return 12;
  if (distance <= 12) return 6;
  return 1;
}

function pickupDetourMinutes(candidateOrigin, requestedOrigin, destination) {
  const directMiles = haversineMiles(candidateOrigin, destination);
  const pickupMiles = haversineMiles(candidateOrigin, requestedOrigin);
  const onwardMiles = haversineMiles(requestedOrigin, destination);
  if ([directMiles, pickupMiles, onwardMiles].some((value) => value === null)) {
    return null;
  }
  const addedRoadMiles = Math.max(0, (pickupMiles + onwardMiles - directMiles) * 1.18);
  return Math.max(2, Math.round(addedRoadMiles * 2.25));
}

function routeOrientation(viewerRole, candidateRole, requestedOrigin, candidateOrigin, destination) {
  const viewerDrives =
    viewerRole === "driver" ||
    (viewerRole === "either" && candidateRole === "rider");
  const candidateDrives =
    viewerRole === "rider" ||
    (viewerRole === "either" && candidateRole === "driver");

  if (viewerDrives) {
    return {
      driverOrigin: requestedOrigin,
      pickupOrigin: candidateOrigin,
      driverType: "viewer",
      modeledDetourMinutes: pickupDetourMinutes(
        requestedOrigin,
        candidateOrigin,
        destination
      ),
    };
  }

  if (candidateDrives) {
    return {
      driverOrigin: candidateOrigin,
      pickupOrigin: requestedOrigin,
      driverType: "match",
      modeledDetourMinutes: pickupDetourMinutes(
        candidateOrigin,
        requestedOrigin,
        destination
      ),
    };
  }

  const viewerDetour = pickupDetourMinutes(
    requestedOrigin,
    candidateOrigin,
    destination
  );
  const candidateDetour = pickupDetourMinutes(
    candidateOrigin,
    requestedOrigin,
    destination
  );
  const useViewer = viewerDetour !== null &&
    (candidateDetour === null || viewerDetour <= candidateDetour);

  return useViewer
    ? {
        driverOrigin: requestedOrigin,
        pickupOrigin: candidateOrigin,
        driverType: "viewer",
        modeledDetourMinutes: viewerDetour,
      }
    : {
        driverOrigin: candidateOrigin,
        pickupOrigin: requestedOrigin,
        driverType: "match",
        modeledDetourMinutes: candidateDetour,
      };
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

function stationAccessBand(distance) {
  if (distance <= 2.5) {
    return { key: "strong", label: "Strong station fit", score: 18 };
  }
  if (distance <= 5) {
    return { key: "standard", label: "Reasonable station fit", score: 13 };
  }
  if (distance <= 8) {
    return { key: "park-and-ride", label: "Park-and-ride fit", score: 8 };
  }
  return null;
}

function nearestSyntheticStation(member) {
  const origin = syntheticOrigin(member);
  if (!origin) return null;

  const nearest = martaStations
    .map((station) => ({
      station,
      distance: haversineMiles(origin, station),
    }))
    .sort((first, second) => first.distance - second.distance)[0];
  const band = nearest ? stationAccessBand(nearest.distance) : null;

  if (!nearest || !band) return null;
  return {
    station: nearest.station,
    distanceMiles: Number(nearest.distance.toFixed(1)),
    band,
    origin,
  };
}

const eastWestStationCodes = new Set([
  "MARTA-ASHBY",
  "MARTA-AVONDALE",
  "MARTA-BANKHEAD",
  "MARTA-DECATUR",
  "MARTA-DOME-GWCC-PHILIPS-ARENA-CNN",
  "MARTA-EAST-LAKE",
  "MARTA-EDGEWOOD-CANDLER-PARK",
  "MARTA-FIVE-POINTS",
  "MARTA-GEORGIA-STATE",
  "MARTA-HAMILTON-E-HOLMES",
  "MARTA-INDIAN-CREEK",
  "MARTA-INMAN-PARK-REYNOLDSTOWN",
  "MARTA-KENSINGTON",
  "MARTA-KING-MEMORIAL",
  "MARTA-VINE-CITY",
  "MARTA-WEST-LAKE",
]);

function modeledStationArrival(member, station) {
  const airport = airportDestinations["Domestic Terminal"];
  const railMiles = haversineMiles(airport, station) || 0;
  const transferMinutes = eastWestStationCodes.has(station.nodeCode) ? 8 : 0;
  const railMinutes = Math.max(4, Math.round(3 + railMiles * 1.7 + transferMinutes));
  const platformWait = 6 + (syntheticNumber(member) % 9);
  const total = (minutes(member.shift_end_time) + platformWait + railMinutes) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function bearingDegrees(from, to) {
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingDifference(first, second) {
  const difference = Math.abs(first - second);
  return Math.min(difference, 360 - difference);
}

function directionLabel(bearing) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round(bearing / 45) % directions.length];
}

function stationDropoffDetour(station, passengerHome, driverHome) {
  const directMiles = haversineMiles(station, driverHome);
  const passengerMiles = haversineMiles(station, passengerHome);
  const onwardMiles = haversineMiles(passengerHome, driverHome);
  if ([directMiles, passengerMiles, onwardMiles].some((value) => value === null)) {
    return null;
  }
  return Math.max(1, Math.round(Math.max(0, passengerMiles + onwardMiles - directMiles) * 2.25));
}

function stationRouteOrientation(
  request,
  candidateRole,
  candidateOrigin,
  connectionType
) {
  const station = request.station;
  const viewerOrigin = request.originZone;

  if (connectionType === "rideshare_split") {
    const viewerFirstDetour = stationDropoffDetour(
      station,
      viewerOrigin,
      candidateOrigin
    );
    const candidateFirstDetour = stationDropoffDetour(
      station,
      candidateOrigin,
      viewerOrigin
    );
    const viewerFirst = viewerFirstDetour !== null &&
      (candidateFirstDetour === null || viewerFirstDetour <= candidateFirstDetour);
    return viewerFirst
      ? {
          routeStation: station,
          routeDropoffOrigin: viewerOrigin,
          routeDriverHome: candidateOrigin,
          routeDriverType: "rideshare",
          modeledDetourMinutes: viewerFirstDetour,
        }
      : {
          routeStation: station,
          routeDropoffOrigin: candidateOrigin,
          routeDriverHome: viewerOrigin,
          routeDriverType: "rideshare",
          modeledDetourMinutes: candidateFirstDetour,
        };
  }

  const viewerDrives =
    request.rideRole === "driver" ||
    (request.rideRole === "either" && candidateRole === "rider");
  const candidateDrives =
    request.rideRole === "rider" ||
    (request.rideRole === "either" && candidateRole === "driver");

  if (viewerDrives) {
    return {
      routeStation: station,
      routeDropoffOrigin: candidateOrigin,
      routeDriverHome: viewerOrigin,
      routeDriverType: "viewer",
      modeledDetourMinutes: stationDropoffDetour(
        station,
        candidateOrigin,
        viewerOrigin
      ),
    };
  }

  if (candidateDrives) {
    return {
      routeStation: station,
      routeDropoffOrigin: viewerOrigin,
      routeDriverHome: candidateOrigin,
      routeDriverType: "match",
      modeledDetourMinutes: stationDropoffDetour(
        station,
        viewerOrigin,
        candidateOrigin
      ),
    };
  }

  const viewerDetour = stationDropoffDetour(
    station,
    candidateOrigin,
    viewerOrigin
  );
  const candidateDetour = stationDropoffDetour(
    station,
    viewerOrigin,
    candidateOrigin
  );
  const useViewer = viewerDetour !== null &&
    (candidateDetour === null || viewerDetour <= candidateDetour);

  return useViewer
    ? {
        routeStation: station,
        routeDropoffOrigin: candidateOrigin,
        routeDriverHome: viewerOrigin,
        routeDriverType: "viewer",
        modeledDetourMinutes: viewerDetour,
      }
    : {
        routeStation: station,
        routeDropoffOrigin: viewerOrigin,
        routeDriverHome: candidateOrigin,
        routeDriverType: "match",
        modeledDetourMinutes: candidateDetour,
      };
}

export function findStationRideMatches(request, limit = 18) {
  if (!request?.station?.nodeCode || !request?.originZone || !request?.workDays) {
    return [];
  }

  const requestedDays = new Set(request.workDays);
  const viewerBearing = bearingDegrees(request.station, request.originZone);
  const maximumArrivalDifference =
    Number(request.arrivalFlexMinutes || 15) + Number(request.maxWaitMinutes || 15);

  return commuteMembers
    .map((candidate) => {
      const assignment = nearestSyntheticStation(candidate);
      if (!assignment || assignment.station.nodeCode !== request.station.nodeCode) {
        return null;
      }

      const commonDays = candidate.work_days
        .split("|")
        .filter((day) => requestedDays.has(day));
      if (commonDays.length < 2) return null;

      const candidateArrivalTime = modeledStationArrival(
        candidate,
        assignment.station
      );
      const arrivalDifferenceMinutes = timeDistance(
        candidateArrivalTime,
        request.stationArrivalTime
      );
      if (arrivalDifferenceMinutes > maximumArrivalDifference) return null;

      const candidateRole = syntheticRole(candidate);
      const coworkerCompatible = rolesAreCompatible(
        request.rideRole,
        candidateRole
      );
      const connectionType =
        request.lastMileMode === "rideshare_split" ||
        (request.lastMileMode === "either" && !coworkerCompatible)
          ? "rideshare_split"
          : "coworker_ride";
      if (
        request.lastMileMode === "coworker_ride" &&
        !coworkerCompatible
      ) {
        return null;
      }

      const homeDistance = haversineMiles(
        request.originZone,
        assignment.origin
      );
      if (homeDistance === null || homeDistance > 12) return null;

      const candidateBearing = bearingDegrees(
        assignment.station,
        assignment.origin
      );
      const directionDifference = bearingDifference(
        viewerBearing,
        candidateBearing
      );
      if (directionDifference > 105) return null;

      const route = stationRouteOrientation(
        request,
        candidateRole,
        assignment.origin,
        connectionType
      );
      const directionScore =
        directionDifference <= 30
          ? 16
          : directionDifference <= 60
            ? 11
            : 5;
      const arrivalScore =
        arrivalDifferenceMinutes <= 5
          ? 22
          : arrivalDifferenceMinutes <= 15
            ? 17
            : arrivalDifferenceMinutes <= 30
              ? 11
              : 5;
      const homeScore =
        homeDistance <= 2.5 ? 12 : homeDistance <= 5 ? 9 : homeDistance <= 8 ? 5 : 2;
      const score = Math.min(
        99,
        12 +
          assignment.band.score +
          arrivalScore +
          directionScore +
          homeScore +
          Math.min(commonDays.length * 3, 15) +
          (syntheticNumber(candidate) % 3)
      );
      const identity = syntheticIdentity(candidate);

      return {
        id: candidate.synthetic_id,
        ...identity,
        role: candidateRole,
        connectionType,
        score,
        commonDays,
        station: assignment.station,
        stationAccessMiles: assignment.distanceMiles,
        stationAccessBand: assignment.band.key,
        stationAccessLabel: assignment.band.label,
        stationArrivalTime: candidateArrivalTime,
        arrivalDifferenceMinutes,
        homeDistanceMiles: Number(homeDistance.toFixed(1)),
        homeDirection: directionLabel(candidateBearing),
        directionDifference: Math.round(directionDifference),
        seatsAvailable: candidateRole === "rider" ? null : 1 + (syntheticNumber(candidate) % 4),
        shiftEnd: candidate.shift_end_time,
        modeledDetourMinutes: route.modeledDetourMinutes,
        ...route,
      };
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.arrivalDifferenceMinutes - second.arrivalDifferenceMinutes ||
        first.id.localeCompare(second.id)
    )
    .slice(0, limit);
}

export function findSyntheticMatches(criteria, viewerRole = "either", limit = 18) {
  if (!criteria?.homeZip || !criteria?.destination) return [];

  const modeledViewer = findMember(criteria);
  if (!modeledViewer) return [];

  const requestedDays = new Set(criteria.days || []);
  const requestedOrigin = viewerOrigin(criteria, modeledViewer);
  const destination = airportDestinations[criteria.destination];

  return commuteMembers
    .filter((candidate) => candidate.synthetic_id !== modeledViewer.synthetic_id)
    .map((candidate) => {
      const candidateRole = syntheticRole(candidate);
      const commonDays = candidate.work_days
        .split("|")
        .filter((day) => requestedDays.has(day));
      const startDistance = timeDistance(candidate.shift_start_time, criteria.shiftStart);
      const endDistance = timeDistance(candidate.shift_end_time, criteria.shiftEnd);
      const sameDestination = candidate.airport_destination === criteria.destination;
      const candidateOrigin = syntheticOrigin(candidate);
      const originDistance = haversineMiles(requestedOrigin, candidateOrigin);
      const route = routeOrientation(
        viewerRole,
        candidateRole,
        requestedOrigin,
        candidateOrigin,
        destination
      );
      const detourMinutes = route.modeledDetourMinutes;

      if (!rolesAreCompatible(viewerRole, candidateRole)) return null;
      if (!sameDestination || commonDays.length < 2) return null;
      if (startDistance > 90 || endDistance > 90) return null;
      if (originDistance === null || originDistance > 18) return null;

      const geographyScore = proximityScore(originDistance);
      const routeScore =
        detourMinutes !== null && detourMinutes <= 5
          ? 10
          : detourMinutes !== null && detourMinutes <= 10
            ? 7
            : detourMinutes !== null && detourMinutes <= 15
              ? 4
              : 0;
      const score = Math.min(
        99,
        20 +
          geographyScore +
          routeScore +
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
        originDistanceMiles: Number(originDistance.toFixed(1)),
        pickupDetourMinutes: detourMinutes,
        routeDriverOrigin: route.driverOrigin,
        routePickupOrigin: route.pickupOrigin,
        routeDestination: destination,
        routeDriverType: route.driverType,
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
