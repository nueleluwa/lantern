import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

type TimeOfDay = "day" | "night";

// Fetches segments for the current viewport on move, re-fetching when
// timeOfDay changes. Split out of MapView.tsx's data-fetching effect.
export function useSegments(map: MapLibreMap | null, timeOfDay: TimeOfDay) {
  const [segments, setSegments] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!map) return;

    // Aborts the previous in-flight request on each new call — audit-
    // project review found rapid pan/zoom could let an older, slower
    // response's setSegments() run after a newer one, showing a stale
    // viewport's segments.
    let controller: AbortController | null = null;

    const fetchForCurrentView = async () => {
      controller?.abort();
      controller = new AbortController();

      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      try {
        const res = await fetch(
          `/api/segments?bbox=${bbox}&time_of_day=${timeOfDay}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        setSegments(await res.json());
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    };

    fetchForCurrentView();
    map.on("moveend", fetchForCurrentView);
    return () => {
      controller?.abort();
      map.off("moveend", fetchForCurrentView);
    };
  }, [map, timeOfDay]);

  return segments;
}
