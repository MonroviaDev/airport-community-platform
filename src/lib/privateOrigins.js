export async function createPrivateOriginZone(address) {
  const response = await fetch("/api/geocode-origin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "We could not create a private commute zone.");
  }

  return result;
}
