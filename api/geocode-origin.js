const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

function send(status, body, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return send(405, { error: "Use POST for private origin lookup." }, {
        Allow: "POST",
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return send(400, { error: "Enter a valid starting point." });
    }

    const address = String(body?.address || "").trim();
    if (address.length < 8 || address.length > 200) {
      return send(400, {
        error: "Enter a complete street address or nearby public place.",
      });
    }

    const query = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      format: "json",
    });

    try {
      const censusResponse = await fetch(`${CENSUS_GEOCODER_URL}?${query}`, {
        headers: { Accept: "application/json" },
      });

      if (!censusResponse.ok) {
        return send(502, {
          error: "The address service is temporarily unavailable. Try again shortly.",
        });
      }

      const result = await censusResponse.json();
      const match = result?.result?.addressMatches?.[0];
      const latitude = Number(match?.coordinates?.y);
      const longitude = Number(match?.coordinates?.x);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return send(422, {
          error: "We could not locate that starting point. Include city, state and ZIP.",
        });
      }

      const zoneLatitude = Number(latitude.toFixed(2));
      const zoneLongitude = Number(longitude.toFixed(2));
      const matchedZip = String(match?.addressComponents?.zip || "").slice(0, 5);

      return send(200, {
        originZone: {
          latitude: zoneLatitude,
          longitude: zoneLongitude,
          label: `${matchedZip || "ATL"} private commute zone`,
          precisionMiles: 0.7,
          source: "census-geocoder-rounded",
        },
        matchedZip: /^\d{5}$/.test(matchedZip) ? matchedZip : null,
      });
    } catch {
      return send(502, {
        error: "The address service could not be reached. Try again shortly.",
      });
    }
  },
};
