import { useEffect, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";

type PickTarget = "from" | "to" | null;

// Phase 3 routing mode: a plain map click (not tied to a segment layer)
// sets the picked start/end point. Split out of MapView.tsx.
export function useRoutePicking(map: MapLibreMap | null) {
  const [picking, setPicking] = useState<PickTarget>(null);
  const [routeFrom, setRouteFrom] = useState<[number, number] | null>(null);
  const [routeTo, setRouteTo] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!map || !picking) return;

    const handleMapClick = (e: MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (picking === "from") setRouteFrom(point);
      else setRouteTo(point);
      setPicking(null);
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, picking]);

  return {
    routeFrom,
    routeTo,
    pickFrom: () => setPicking("from"),
    pickTo: () => setPicking("to"),
    // Cancels an in-progress pick without discarding already-picked
    // points — matches the original mode-toggle behavior (switching out
    // of routing mode and back preserves from/to, only cancels a
    // pending "tap the map" prompt).
    cancelPicking: () => setPicking(null),
  };
}
