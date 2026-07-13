"use client";

import { useEffect, useState, use as usePromise } from "react";
import maplibregl, { type Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PLACEHOLDER_MAP_STYLE_URL } from "@/styles/map-style";
import { DEFAULT_LAUNCH_AREA } from "@/config/launch-area";

const POLL_INTERVAL_MS = 10_000;

// Viewer side of Phase 3 "walk-with-me" — no login, no account, just the
// session link. Shows only the walker's most recent position (never a
// trail) and how long ago it updated, so a stalled/expired share is
// obvious rather than silently showing a stale pin as "current."
export default function ShareViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [status, setStatus] = useState<"loading" | "active" | "ended">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);

  useEffect(() => {
    const el = document.getElementById("share-map");
    if (!el) return;
    const instance = new maplibregl.Map({
      container: el,
      style: PLACEHOLDER_MAP_STYLE_URL,
      center: DEFAULT_LAUNCH_AREA.center,
      zoom: DEFAULT_LAUNCH_AREA.defaultZoom,
    });
    setMap(instance);
    return () => instance.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/live-share/${id}`);
      if (cancelled) return;
      if (!res.ok) {
        setStatus("ended");
        return;
      }
      const data = await res.json();
      if (!data.position) {
        setStatus("active");
        return;
      }
      setStatus("active");
      setUpdatedAt(data.position.updatedAt);

      if (map) {
        const lngLat: [number, number] = [data.position.lng, data.position.lat];
        if (marker) {
          marker.setLngLat(lngLat);
        } else {
          const m = new maplibregl.Marker({ color: "#F5A524" }).setLngLat(lngLat).addTo(map);
          setMarker(m);
        }
        map.easeTo({ center: lngLat });
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map]);

  const secondsAgo = updatedAt ? Math.floor((Date.now() - updatedAt) / 1000) : null;
  const stale = secondsAgo !== null && secondsAgo > 90;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <div id="share-map" style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: "var(--space-2)",
          left: "var(--space-2)",
          right: "var(--space-2)",
          background: "var(--night-800)",
          borderRadius: 12,
          padding: "var(--space-2)",
        }}
      >
        {status === "loading" && <p>Loading…</p>}
        {status === "ended" && (
          <p style={{ color: "var(--mist-100)" }}>
            This share has ended — the walker stopped sharing or the link expired.
          </p>
        )}
        {status === "active" && (
          <p style={{ color: stale ? "var(--caution-500)" : "var(--safe-500)" }}>
            {secondsAgo === null
              ? "Waiting for the walker's location…"
              : stale
                ? `No update in ${secondsAgo}s — connection may have dropped.`
                : `Live — updated ${secondsAgo}s ago.`}
          </p>
        )}
      </div>
    </div>
  );
}
