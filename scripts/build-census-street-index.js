import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import process from "node:process";

const TIGER_YEAR = "2025";
const outputPath = new URL(
  "../data/census-street-index-v1.json",
  import.meta.url
);
const populationPath = new URL(
  "../data/synthetic-population-combined-transit-viability.csv",
  import.meta.url
);
const distributionPath = new URL(
  "../data/atl-workforce-distribution.csv",
  import.meta.url
);

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function readCsv(url) {
  const lines = readFileSync(url, "utf8").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function readDbf(buffer) {
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];
  let descriptorOffset = 32;
  let recordOffset = 1;

  while (
    descriptorOffset < headerLength - 1 &&
    buffer[descriptorOffset] !== 0x0d
  ) {
    const name = buffer
      .subarray(descriptorOffset, descriptorOffset + 11)
      .toString("ascii")
      .replace(/\0.*$/, "")
      .trim();
    const length = buffer[descriptorOffset + 16];
    fields.push({ name, length, offset: recordOffset });
    recordOffset += length;
    descriptorOffset += 32;
  }

  const fullName = fields.find((field) => field.name === "FULLNAME");
  const featureClass = fields.find((field) => field.name === "MTFCC");
  const names = new Set();

  for (let index = 0; index < recordCount; index += 1) {
    const offset = headerLength + index * recordLength;
    if (buffer[offset] === 0x2a) continue;

    const name = buffer
      .subarray(offset + fullName.offset, offset + fullName.offset + fullName.length)
      .toString("utf8")
      .trim()
      .replace(/\s+/g, " ");
    const mtfcc = featureClass
      ? buffer
          .subarray(
            offset + featureClass.offset,
            offset + featureClass.offset + featureClass.length
          )
          .toString("ascii")
          .trim()
      : "";

    if (name && (!mtfcc || mtfcc.startsWith("S"))) names.add(name);
  }

  return [...names].sort((first, second) => first.localeCompare(second));
}

function download(url, destination) {
  execFileSync("curl", [
    "-L",
    "-sS",
    "--retry",
    "2",
    "--max-time",
    "120",
    url,
    "-o",
    destination,
  ]);
}

function countyCodes() {
  const text = execFileSync(
    "curl",
    [
      "-L",
      "-sS",
      "--max-time",
      "60",
      "https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt",
    ],
    { encoding: "utf8" }
  );

  return new Map(
    text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split("|"))
      .filter(([state]) => state === "GA")
      .map(([, stateFips, countyFips, , countyName]) => [
        countyName,
        `${stateFips}${countyFips}`,
      ])
  );
}

function relatedCountiesByZip(wantedZips, modeledCounties) {
  const text = execFileSync(
    "curl",
    [
      "-L",
      "-sS",
      "--max-time",
      "120",
      "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
    ],
    { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 }
  );
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].replace(/^\ufeff/, "").split("|");
  const zipIndex = headers.indexOf("GEOID_ZCTA5_20");
  const countyFipsIndex = headers.indexOf("GEOID_COUNTY_20");
  const countyNameIndex = headers.indexOf("NAMELSAD_COUNTY_20");
  const byZip = new Map([...wantedZips].map((zip) => [zip, new Set()]));

  for (const line of lines.slice(1)) {
    const values = line.split("|");
    const zip = values[zipIndex];
    const county = values[countyNameIndex];
    if (
      byZip.has(zip) &&
      values[countyFipsIndex]?.startsWith("13") &&
      modeledCounties.has(county)
    ) {
      byZip.get(zip).add(county);
    }
  }

  return Object.fromEntries(
    [...byZip].map(([zip, counties]) => [zip, [...counties].sort()])
  );
}

function buildIndex() {
  const population = readCsv(populationPath);
  const distribution = readCsv(distributionPath);
  const modeledCounties = [
    ...new Set(population.map((member) => member.home_county.replace(", GA", ""))),
  ].sort();
  const wantedZips = new Set(
    distribution.filter((area) => area.home_zcta).map((area) => area.home_zcta)
  );
  const zipToCounties = relatedCountiesByZip(
    wantedZips,
    new Set(modeledCounties)
  );
  const codes = countyCodes();
  const sourceDirectory = process.argv[2] || mkdtempSync(join(tmpdir(), "tiger-streets-"));
  const removeSourceDirectory = !process.argv[2];
  const counties = {};

  try {
    for (const [index, county] of modeledCounties.entries()) {
      const fips = codes.get(county);
      if (!fips) throw new Error(`No Georgia county FIPS found for ${county}.`);

      const zipPath = join(sourceDirectory, `${fips}.zip`);
      if (removeSourceDirectory) {
        download(
          `https://www2.census.gov/geo/tiger/TIGER${TIGER_YEAR}/FEATNAMES/tl_${TIGER_YEAR}_${fips}_featnames.zip`,
          zipPath
        );
      }

      const archiveNames = execFileSync("unzip", ["-Z1", zipPath], {
        encoding: "utf8",
      })
        .trim()
        .split(/\r?\n/);
      const dbfName = archiveNames.find((name) => name.endsWith(".dbf"));
      const dbf = execFileSync("unzip", ["-p", zipPath, dbfName], {
        maxBuffer: 250 * 1024 * 1024,
      });
      counties[county] = readDbf(dbf);

      if ((index + 1) % 10 === 0) {
        console.log(`Processed ${index + 1}/${modeledCounties.length} counties.`);
      }
    }

    const streetCount = new Set(Object.values(counties).flat()).size;
    writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          metadata: {
            source: "U.S. Census Bureau TIGER/Line Feature Names",
            tigerYear: Number(TIGER_YEAR),
            modeledCountyCount: modeledCounties.length,
            modeledZipCount: Object.keys(zipToCounties).length,
            uniqueStreetNameCount: streetCount,
          },
          zipToCounties,
          counties,
        },
        null,
        0
      )}\n`
    );
    console.log(`Wrote ${basename(outputPath.pathname)} with ${streetCount} street names.`);
  } finally {
    if (removeSourceDirectory) {
      rmSync(sourceDirectory, { recursive: true, force: true });
    }
  }
}

buildIndex();
