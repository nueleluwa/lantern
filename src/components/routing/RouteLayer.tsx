"use client";

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

const SOURCE_ID = "suggested-route";

// Deliberately visually distinct from the segment safe/caution/avoid
// encoding (DESIGN_SYSTEM.md reserves those hues for segment/tag states
// only) — the route uses the amber wayfinding accent instead, since a
// suggested path is closer to a CTA/guidance element than a safety
// rating.
export function RouteLayer({
  map,
  geometry,
}: {
  map: MapLibreMap | null;
  geometry: GeoJSON.LineString | null;
}) {
  useEffect(() => {
    if (!map) return;

    const apply = () => {
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: geometry ?? { type: "LineString", coordinates: [] },
      };

      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }

      map.addSource(SOURCE_ID, { type: "geojson", data });
      map.addLayer({
        id: "suggested-route-line",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#FFD08A", // lamp-300
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [map, geometry]);

  return null;
}
