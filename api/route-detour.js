const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

function send(status, body, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, max-age=3600",
      ...extraHeaders,
    },
  });
}

function validPoint(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 30 || latitude > 36 || longitude < -86 || longitude > -80) {
    return null;
  }
  return {
    latitude: Number(latitude.toFixed(3)),
    longitude: Number(longitude.toFixed(3)),
  };
}

function coordinate(point) {
  return `${point.longitude},${point.latitude}`;
}

async function fetchRoute(points) {
  const coordinates = points.map(coordinate).join(";");
  const query = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });
  const response = await fetch(`${OSRM_BASE_URL}/${coordinates}?${query}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AirportCommunityRoutePreview/1.0",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Routing provider unavailable");

  const result = await response.json();
  const route = result?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("No road route found");
  }
  return route;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return send(405, { error: "Use POST for route comparison." }, { Allow: "POST" });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return send(400, { error: "Enter a valid route request." });
    }

    const driverOrigin = validPoint(body?.driverOrigin);
    const pickupOrigin = validPoint(body?.pickupOrigin);
    const destination = validPoint(body?.destination);
    if (!driverOrigin || !pickupOrigin || !destination) {
      return send(400, {
        error: "Route points must be anonymous locations in the modeled service area.",
      });
    }

    try {
      const [direct, viaPickup] = await Promise.all([
        fetchRoute([driverOrigin, destination]),
        fetchRoute([driverOrigin, pickupOrigin, destination]),
      ]);
      const directMinutes = Math.round(direct.duration / 60);
      const pickupMinutes = Math.round(viaPickup.duration / 60);
      const addedMeters = Math.max(0, viaPickup.distance - direct.distance);

      return send(200, {
        direct: {
          minutes: directMinutes,
          miles: Number((direct.distance / 1609.344).toFixed(1)),
          geometry: direct.geometry,
        },
        viaPickup: {
          minutes: pickupMinutes,
          miles: Number((viaPickup.distance / 1609.344).toFixed(1)),
          geometry: viaPickup.geometry,
        },
        detour: {
          minutes: Math.max(0, pickupMinutes - directMinutes),
          miles: Number((addedMeters / 1609.344).toFixed(1)),
        },
        provider: "OpenStreetMap road network via OSRM demo routing",
        trafficIncluded: false,
      });
    } catch {
      return send(502, {
        error: "A road route could not be calculated right now. Try again shortly.",
      });
    }
  },
};
