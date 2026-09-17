import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

function circleFeature(point, radiusMiles, properties) {
  const coordinates = [];
  const latitudeRadians = (point.latitude * Math.PI) / 180;
  for (let index = 0; index <= 64; index += 1) {
    const angle = (index / 64) * Math.PI * 2;
    const latitudeOffset = (Math.sin(angle) * radiusMiles) / 69;
    const longitudeOffset =
      (Math.cos(angle) * radiusMiles) / (69 * Math.cos(latitudeRadians));
    coordinates.push([
      point.longitude + longitudeOffset,
      point.latitude + latitudeOffset,
    ]);
  }
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

function cacheKey(match) {
  const pointKey = (point) =>
    `${Number(point.latitude).toFixed(3)},${Number(point.longitude).toFixed(3)}`;
  return `airport-route:${pointKey(match.routeDriverOrigin)}:${pointKey(
    match.routePickupOrigin
  )}:${pointKey(match.routeDestination)}`;
}

function readCachedRoute(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (!cached?.savedAt || Date.now() - cached.savedAt > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return cached.route;
  } catch {
    return null;
  }
}

function saveCachedRoute(key, route) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), route }));
  } catch {
    // A route preview should still work when browser storage is unavailable.
  }
}

function mapPointElement(letter, className, title) {
  const element = document.createElement("div");
  element.className = `route-map-marker ${className}`;
  element.textContent = letter;
  element.title = title;
  element.setAttribute("aria-label", title);
  return element;
}

export default function CommuteRouteMap({ match }) {
  const mapContainer = useRef(null);
  const key = useMemo(() => cacheKey(match), [match]);
  const initialRoute = useMemo(() => readCachedRoute(key), [key]);
  const [route, setRoute] = useState(initialRoute);
  const [status, setStatus] = useState(initialRoute ? "ready" : "loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const cached = readCachedRoute(key);
    if (cached) return undefined;

    const controller = new AbortController();
    fetch("/api/route-detour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverOrigin: match.routeDriverOrigin,
        pickupOrigin: match.routePickupOrigin,
        destination: match.routeDestination,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Route unavailable");
        return result;
      })
      .then((result) => {
        saveCachedRoute(key, result);
        setRoute(result);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setError(requestError.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [
    attempt,
    key,
    match.routeDestination,
    match.routeDriverOrigin,
    match.routePickupOrigin,
  ]);

  function retryRoute() {
    setStatus("loading");
    setError("");
    setAttempt((current) => current + 1);
  }

  useEffect(() => {
    if (!mapContainer.current) return undefined;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [match.routeDestination.longitude, match.routeDestination.latitude],
      zoom: 9,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const markers = [
      new maplibregl.Marker({
        element: mapPointElement("D", "driver-marker", "Approximate driver area"),
      })
        .setLngLat([
          match.routeDriverOrigin.longitude,
          match.routeDriverOrigin.latitude,
        ])
        .addTo(map),
      new maplibregl.Marker({
        element: mapPointElement("P", "pickup-marker", "Approximate pickup area"),
      })
        .setLngLat([
          match.routePickupOrigin.longitude,
          match.routePickupOrigin.latitude,
        ])
        .addTo(map),
      new maplibregl.Marker({
        element: mapPointElement("A", "airport-marker", "Airport work area"),
      })
        .setLngLat([
          match.routeDestination.longitude,
          match.routeDestination.latitude,
        ])
        .addTo(map),
    ];

    map.on("load", () => {
      map.addSource("private-zones", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            circleFeature(match.routeDriverOrigin, 0.7, { type: "driver" }),
            circleFeature(match.routePickupOrigin, 0.7, { type: "pickup" }),
          ],
        },
      });
      map.addLayer({
        id: "private-zone-fill",
        type: "fill",
        source: "private-zones",
        paint: {
          "fill-color": [
            "match",
            ["get", "type"],
            "driver",
            "#1769e0",
            "#ef7d2d",
          ],
          "fill-opacity": 0.16,
        },
      });
      map.addLayer({
        id: "private-zone-outline",
        type: "line",
        source: "private-zones",
        paint: {
          "line-color": [
            "match",
            ["get", "type"],
            "driver",
            "#1769e0",
            "#d75b0b",
          ],
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      if (route) {
        map.addSource("direct-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.direct.geometry },
        });
        map.addLayer({
          id: "direct-route-line",
          type: "line",
          source: "direct-route",
          paint: {
            "line-color": "#6f7f91",
            "line-width": 5,
            "line-opacity": 0.55,
            "line-dasharray": [2, 2],
          },
        });
        map.addSource("pickup-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.viaPickup.geometry },
        });
        map.addLayer({
          id: "pickup-route-line",
          type: "line",
          source: "pickup-route",
          paint: {
            "line-color": "#1769e0",
            "line-width": 5,
            "line-opacity": 0.88,
          },
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      const coordinates = route?.viaPickup?.geometry?.coordinates || [
        [match.routeDriverOrigin.longitude, match.routeDriverOrigin.latitude],
        [match.routePickupOrigin.longitude, match.routePickupOrigin.latitude],
        [match.routeDestination.longitude, match.routeDestination.latitude],
      ];
      coordinates.forEach((coordinateValue) => bounds.extend(coordinateValue));
      map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 });
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [match, route]);

  return (
    <section className="route-preview-card" aria-label="Anonymous route comparison">
      <div className="route-preview-heading">
        <div>
          <span className="eyebrow">ROAD ROUTE PREVIEW</span>
          <h2>See how the pickup changes the commute</h2>
        </div>
        <span className="route-no-traffic">Live traffic not included</span>
      </div>

      <div className="route-map-wrap">
        <div ref={mapContainer} className="route-map" />
        <div className="route-map-legend" aria-label="Map legend">
          <span><i className="legend-driver" />Driver area</span>
          <span><i className="legend-pickup" />Pickup area</span>
          <span><i className="legend-route" />Route via pickup</span>
        </div>
      </div>

      {status === "loading" && (
        <div className="route-status" role="status">
          Calculating two road routes using anonymous commute zones…
        </div>
      )}

      {status === "error" && (
        <div className="route-status route-error" role="alert">
          <strong>Road route temporarily unavailable.</strong> {error}{" "}
          <button type="button" className="route-retry-button" onClick={retryRoute}>
            Try again
          </button>
        </div>
      )}

      {route && (
        <div className="route-comparison-grid">
          <div>
            <small>NORMAL ROUTE</small>
            <strong>{route.direct.minutes} min · {route.direct.miles} mi</strong>
          </div>
          <div>
            <small>WITH PICKUP</small>
            <strong>{route.viaPickup.minutes} min · {route.viaPickup.miles} mi</strong>
          </div>
          <div className="route-detour-result">
            <small>MODELED ROAD DETOUR</small>
            <strong>+{route.detour.minutes} min · +{route.detour.miles} mi</strong>
          </div>
        </div>
      )}

      <p className="route-method-note">
        Routes start from rounded 0.7-mile commute areas. Exact home addresses
        are not sent to the map or routing service. Times use the road network
        and do not include current traffic.
      </p>
    </section>
  );
}
