import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_LAUNCH_AREA } from "@/config/launch-area";
import { PLACEHOLDER_MAP_STYLE_URL } from "@/styles/map-style";

// Owns the MapLibre instance's lifecycle only — creation, load state,
// and teardown. Split out of MapView.tsx (audit-project review: that
// component owned map lifecycle, day/night sync, segment fetching,
// click/hover wiring, and routing pick-point logic all in one 233-line
// component with six co-located effects).
export function useMapInstance() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: PLACEHOLDER_MAP_STYLE_URL,
      center: DEFAULT_LAUNCH_AREA.center,
      zoom: DEFAULT_LAUNCH_AREA.defaultZoom,
      // DESIGN_SYSTEM.md: never disable pinch-zoom.
      touchZoomRotate: true,
    });

    instance.on("load", () => setLoading(false));
    setMap(instance);

    return () => instance.remove();
  }, []);

  return { containerRef, map, loading };
}
