import streetIndex from "../data/census-street-index-v1.json" with { type: "json" };

function send(status, body) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function suggestionScore(name, query) {
  const normalized = normalize(name);
  if (normalized.startsWith(query)) return 0;
  if (normalized.split(" ").some((word) => word.startsWith(query))) return 1;
  if (normalized.includes(query)) return 2;
  return null;
}

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return send(405, { error: "Use GET for street suggestions." });
    }

    const url = new URL(request.url);
    const zip = String(url.searchParams.get("zip") || "").trim();
    const query = normalize(url.searchParams.get("q") || "");

    if (!/^\d{5}$/.test(zip) || query.length < 3 || query.length > 80) {
      return send(200, { suggestions: [], county: null });
    }

    const counties = streetIndex.zipToCounties[zip] || [];
    const names = [
      ...new Set(counties.flatMap((county) => streetIndex.counties[county] || [])),
    ];
    const suggestions = names
      .map((name) => ({ name, score: suggestionScore(name, query) }))
      .filter((candidate) => candidate.score !== null)
      .sort(
        (first, second) =>
          first.score - second.score ||
          first.name.length - second.name.length ||
          first.name.localeCompare(second.name)
      )
      .slice(0, 8)
      .map((candidate) => candidate.name);

    return send(200, { suggestions, counties });
  },
};
