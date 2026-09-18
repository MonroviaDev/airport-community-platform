import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

function circleFeature(point, type) {
  const coordinates = [];
  const latitudeRadians = (point.latitude * Math.PI) / 180;
  for (let index = 0; index <= 64; index += 1) {
    const angle = (index / 64) * Math.PI * 2;
    const latitudeOffset = (Math.sin(angle) * 0.7) / 69;
    const longitudeOffset =
      (Math.cos(angle) * 0.7) / (69 * Math.cos(latitudeRadians));
    coordinates.push([
      point.longitude + longitudeOffset,
      point.latitude + latitudeOffset,
    ]);
  }
  return {
    type: "Feature",
    properties: { type },
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

function pointKey(point) {
  return `${Number(point.latitude).toFixed(3)},${Number(point.longitude).toFixed(3)}`;
}

function cacheKey(match) {
  return `station-route:${pointKey(match.routeStation)}:${pointKey(
    match.routeDropoffOrigin
  )}:${pointKey(match.routeDriverHome)}`;
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
    // The route can still display when browser storage is unavailable.
  }
}

function markerElement(symbol, className, title) {
  const element = document.createElement("div");
  element.className = `route-map-marker ${className}`;
  element.textContent = symbol;
  element.title = title;
  element.setAttribute("aria-label", title);
  return element;
}

export default function StationRideMap({ match }) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const key = useMemo(() => cacheKey(match), [match]);
  const initialRoute = useMemo(() => readCachedRoute(key), [key]);
  const [route, setRoute] = useState(initialRoute);
  const [status, setStatus] = useState(initialRoute ? "ready" : "loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const driverLabel =
    match.routeDriverType === "rideshare"
      ? "Shared rideshare route"
      : match.routeDriverType === "viewer"
      ? "You are modeled as the driver"
      : `${match.name} is modeled as the driver`;

  useEffect(() => {
    const cached = readCachedRoute(key);
    if (cached) return undefined;

    const controller = new AbortController();
    fetch("/api/route-detour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverOrigin: match.routeStation,
        pickupOrigin: match.routeDropoffOrigin,
        destination: match.routeDriverHome,
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
  }, [attempt, key, match.routeDriverHome, match.routeDropoffOrigin, match.routeStation]);

  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  useEffect(() => {
    const resizeFrame = requestAnimationFrame(() => mapInstance.current?.resize());
    return () => cancelAnimationFrame(resizeFrame);
  }, [expanded]);

  useEffect(() => {
    if (!mapContainer.current) return undefined;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [match.routeStation.longitude, match.routeStation.latitude],
      zoom: 10,
      attributionControl: true,
    });
    mapInstance.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    const markers = [
      new maplibregl.Marker({
        element: markerElement("🚆", "station-marker", match.station.name),
      })
        .setLngLat([match.routeStation.longitude, match.routeStation.latitude])
        .addTo(map),
      new maplibregl.Marker({
        element: markerElement("1", "pickup-marker", "First anonymous home area"),
      })
        .setLngLat([
          match.routeDropoffOrigin.longitude,
          match.routeDropoffOrigin.latitude,
        ])
        .addTo(map),
      new maplibregl.Marker({
        element: markerElement("2", "driver-marker", "Driver anonymous home area"),
      })
        .setLngLat([
          match.routeDriverHome.longitude,
          match.routeDriverHome.latitude,
        ])
        .addTo(map),
    ];

    map.on("load", () => {
      map.addSource("station-private-zones", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            circleFeature(match.routeDropoffOrigin, "dropoff"),
            circleFeature(match.routeDriverHome, "driver-home"),
          ],
        },
      });
      map.addLayer({
        id: "station-private-zone-fill",
        type: "fill",
        source: "station-private-zones",
        paint: {
          "fill-color": [
            "match",
            ["get", "type"],
            "dropoff",
            "#ef7d2d",
            "#1769e0",
          ],
          "fill-opacity": 0.17,
        },
      });
      map.addLayer({
        id: "station-private-zone-outline",
        type: "line",
        source: "station-private-zones",
        paint: {
          "line-color": [
            "match",
            ["get", "type"],
            "dropoff",
            "#d75b0b",
            "#1769e0",
          ],
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      if (route) {
        map.addSource("station-direct-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.direct.geometry },
        });
        map.addLayer({
          id: "station-direct-route-line",
          type: "line",
          source: "station-direct-route",
          paint: {
            "line-color": "#6f7f91",
            "line-width": 3,
            "line-opacity": 0.72,
            "line-dasharray": [2, 2],
          },
        });
        map.addSource("station-shared-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.viaPickup.geometry },
        });
        map.addLayer({
          id: "station-shared-route-casing",
          type: "line",
          source: "station-shared-route",
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "station-shared-route-line",
          type: "line",
          source: "station-shared-route",
          paint: { "line-color": "#1769e0", "line-width": 6, "line-opacity": 0.94 },
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      const coordinates = route?.viaPickup?.geometry?.coordinates || [
        [match.routeStation.longitude, match.routeStation.latitude],
        [match.routeDropoffOrigin.longitude, match.routeDropoffOrigin.latitude],
        [match.routeDriverHome.longitude, match.routeDriverHome.latitude],
      ];
      coordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 52, maxZoom: 13, duration: 0 });
    });

    return () => {
      mapInstance.current = null;
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [match, route]);

  function retryRoute() {
    setStatus("loading");
    setError("");
    setAttempt((current) => current + 1);
  }

  return (
    <section className="route-preview-card" aria-label="Station ride route preview">
      <div className="route-preview-heading">
        <div>
          <span className="eyebrow">STATION-TO-HOME ROUTE</span>
          <h2>See the shared ride from {match.station.name}</h2>
        </div>
        <span className="route-no-traffic">Live traffic not included</span>
      </div>

      <div className={`route-map-wrap${expanded ? " expanded" : ""}`}>
        <div ref={mapContainer} className="route-map" />
        <button
          type="button"
          className="route-expand-button"
          aria-pressed={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span aria-hidden="true">{expanded ? "×" : "⛶"}</span>
          {expanded ? "Close map" : "Expand map"}
        </button>
        <div className="route-driver-callout">
          <span aria-hidden="true">🚗</span>
          <strong>{driverLabel}</strong>
        </div>
        <div className="route-map-legend station-route-legend">
          <span><i className="legend-station" />MARTA station</span>
          <span>
            <i className="legend-normal-route" />
            {match.routeDriverType === "rideshare" ? "Final rider direct" : "Driver alone"}
          </span>
          <span><i className="legend-route" />Shared ride home</span>
        </div>
      </div>

      {status === "loading" && (
        <div className="route-status" role="status">
          Calculating the anonymous station-to-home route…
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
            <small>
              {match.routeDriverType === "rideshare" ? "FINAL RIDER DIRECT" : "DRIVER ALONE"}
            </small>
            <strong>{route.direct.minutes} min · {route.direct.miles} mi</strong>
          </div>
          <div>
            <small>SHARED RIDE</small>
            <strong>{route.viaPickup.minutes} min · {route.viaPickup.miles} mi</strong>
          </div>
          <div className="route-detour-result">
            <small>
              {match.routeDriverType === "rideshare" ? "ESTIMATED EXTRA STOP" : "ESTIMATED DROPOFF DETOUR"}
            </small>
            <strong>+{route.detour.minutes} min · +{route.detour.miles} mi</strong>
          </div>
        </div>
      )}

      <p className="route-method-note">
        The route begins at the public MARTA station. Both home markers are
        rounded 0.7-mile areas—not addresses—and current traffic is not included.
      </p>
    </section>
  );
}
