import { useEffect, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";

const LAYER_IDS = ["segments-safe", "segments-caution", "segments-avoid", "segments-unrated"];

// PRD.md Flow A step 3: "Tap a segment -> see tag breakdown..."
//
// Queries rendered features at click/move time rather than binding
// per-layer listeners (map.on('click', layerId, cb)) — those only
// attach successfully if the layer already exists at attach time, but
// SegmentLayer creates the layers asynchronously from the same segments
// data this hook doesn't otherwise depend on. A plain map-level handler
// that queries whichever layers currently exist works regardless of
// load order and only needs [map, active].
export function useSegmentSelection(map: MapLibreMap | null, active: boolean) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;

    const existingLayerIds = () => LAYER_IDS.filter((id) => map.getLayer(id));

    const handleClick = (e: MapMouseEvent) => {
      if (!active) return;
      const layers = existingLayerIds();
      if (layers.length === 0) return;
      const feature = map.queryRenderedFeatures(e.point, { layers })[0];
      const id = feature?.properties?.id;
      if (id) setSelectedSegmentId(id);
    };

    const handleMouseMove = (e: MapMouseEvent) => {
      const layers = existingLayerIds();
      const hovering = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0;
      map.getCanvas().style.cursor = hovering ? "pointer" : "";
    };

    map.on("click", handleClick);
    map.on("mousemove", handleMouseMove);

    return () => {
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
    };
  }, [map, active]);

  return { selectedSegmentId, setSelectedSegmentId };
}
