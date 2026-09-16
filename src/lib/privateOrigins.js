export async function loadStreetSuggestions(zip, query, signal) {
  if (!/^\d{5}$/.test(zip) || query.trim().length < 3) return [];

  const parameters = new URLSearchParams({ zip, q: query.trim() });
  const response = await fetch(`/api/street-suggestions?${parameters}`, {
    signal,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Street suggestions are temporarily unavailable.");
  }

  return result.suggestions || [];
}

export async function createPrivateOriginZone(address) {
  const response = await fetch("/api/geocode-origin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "We could not create a private commute zone.");
  }

  return result;
}
