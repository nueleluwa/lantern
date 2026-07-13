"use client";

import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { ROUTE_DISCLAIMER } from "@/lib/route-disclaimer";

type LngLat = [number, number];

// DO_NOT.md: "even [in Phase 2+, routing gets] a persistent disclaimer
// in the routing UI itself, not just in a terms-of-service page nobody
// reads." The banner below has no dismiss control and renders whenever
// this panel is open — it is not a one-time modal.
export function RouteSuggestion({
  from,
  to,
  timeOfDay,
  onPickFrom,
  onPickTo,
  onResult,
}: {
  from: LngLat | null;
  to: LngLat | null;
  timeOfDay: "day" | "night";
  onPickFrom: () => void;
  onPickTo: () => void;
  onResult: (geometry: GeoJSON.LineString | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/route?from=${from.join(",")}&to=${to.join(",")}&time_of_day=${timeOfDay}`
      );
      if (!res.ok) {
        setError("No route found between those points.");
        onResult(null);
        return;
      }
      const data = await res.json();
      onResult(data.geometry);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "var(--space-2)",
        left: "var(--space-2)",
        right: "var(--space-2)",
        background: "var(--night-800)",
        borderRadius: 16,
        padding: "var(--space-2)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "flex-start",
          background: "var(--night-950)",
          borderRadius: 8,
          padding: "var(--space-1)",
        }}
      >
        <ExclamationTriangleIcon width={18} height={18} color="var(--lamp-500)" />
        <p style={{ fontSize: "var(--text-label)", color: "var(--mist-100)" }}>
          {ROUTE_DISCLAIMER}
        </p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-1)" }}>
        <button
          type="button"
          onClick={onPickFrom}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 8,
            border: "none",
            background: from ? "var(--safe-500)" : "var(--night-950)",
            color: from ? "var(--night-950)" : "var(--mist-100)",
          }}
        >
          {from ? "Start set" : "Tap map: set start"}
        </button>
        <button
          type="button"
          onClick={onPickTo}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 8,
            border: "none",
            background: to ? "var(--safe-500)" : "var(--night-950)",
            color: to ? "var(--night-950)" : "var(--mist-100)",
          }}
        >
          {to ? "End set" : "Tap map: set end"}
        </button>
      </div>

      <button
        type="button"
        disabled={!from || !to || loading}
        onClick={suggest}
        style={{
          height: "var(--button-height-primary)",
          borderRadius: "var(--radius-button)",
          border: "none",
          background: "var(--lamp-500)",
          color: "var(--night-950)",
          fontSize: "var(--text-body-lg)",
          fontWeight: 500,
          opacity: from && to && !loading ? 1 : 0.4,
        }}
      >
        {loading ? "Finding route…" : "Suggest a route"}
      </button>

      {error && <p style={{ color: "var(--mist-400)", fontSize: "var(--text-label)" }}>{error}</p>}
    </div>
  );
}
