import railNodesCsv from "../../data/marta-rail-nodes.csv?raw";

function titleCase(value) {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, separator, letter) =>
      `${separator}${letter.toUpperCase()}`
    )
    .replace("Ft Mcpherson", "Ft McPherson")
    .replace("Gwcc", "GWCC")
    .replace("Cnn", "CNN");
}

const [headerLine, ...rows] = railNodesCsv.trim().split(/\r?\n/);
const headers = headerLine.split(",");

export const martaStations = rows
  .map((row) => {
    const values = row.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  })
  .filter(
    (station) =>
      station.active === "true" && station.node_code !== "MARTA-AIRPORT"
  )
  .map((station) => ({
    nodeCode: station.node_code,
    name: titleCase(station.node_name),
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
  }))
  .sort((first, second) => first.name.localeCompare(second.name));

export function findMartaStation(nodeCode) {
  return martaStations.find((station) => station.nodeCode === nodeCode) || null;
}
