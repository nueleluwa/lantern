"use client";

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

const SOURCE_ID = "segments";

// DESIGN_SYSTEM.md: color is never the only signal for a segment band —
// every line also carries a second, non-color encoding (weight for
// caution, dash pattern for avoid), so the map stays legible for
// red-green color-vision deficiency and is unaffected by day/night mode.
export function SegmentLayer({
  map,
  data,
}: {
  map: MapLibreMap | null;
  data: GeoJSON.FeatureCollection | null;
}) {
  useEffect(() => {
    if (!map || !data) return;

    const applyLayers = () => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }

      map.addSource(SOURCE_ID, { type: "geojson", data });

      map.addLayer({
        id: "segments-safe",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "band"], "lit_safe"],
        paint: {
          "line-color": "#4ADE80", // safe-500
          "line-width": 2,
        },
      });

      map.addLayer({
        id: "segments-caution",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "band"], "caution"],
        paint: {
          "line-color": "#E8590C", // caution-500
          "line-width": 3.5, // +1.5px over standard weight
        },
      });

      map.addLayer({
        id: "segments-avoid",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "band"], "avoid"],
        paint: {
          "line-color": "#E11D48", // avoid-500
          "line-width": 2,
          "line-dasharray": [2, 1.5],
        },
      });

      map.addLayer({
        id: "segments-unrated",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "band"], "unrated"],
        paint: {
          "line-color": "#9AA0C4", // mist-400
          "line-width": 1.5,
          "line-opacity": 0.5,
        },
      });

      // TODO (Phase 1, tagging-flow checkpoint): the "lit & safe" radial
      // glow signature moment (DESIGN_SYSTEM.md "Motion") — a static
      // pre-composited gradient sprite with opacity-only animation, not
      // box-shadow/filter:blur() — belongs here once real segment data
      // exists to glow.
    };

    if (map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.once("load", applyLayers);
    }
  }, [map, data]);

  return null;
}
