import type { StyleSpecification } from "maplibre-gl";

// DESIGN_SYSTEM.md "Map style" requires a self-hosted vector tile style
// authored in Maputnik (or a reskinned open dark base) before launch —
// that's real design work, tracked in ROADMAP.md, not done here.
//
// MapLibre's public demo style (demotiles.maplibre.org) was used as an
// interim placeholder, but it only has sparse token vector coverage —
// it rendered nothing but a flat fill color for Port Harcourt, since
// there's no real data behind it at this location. Swapped for the
// standard public OpenStreetMap raster tile servers instead, which have
// full global coverage, so local dev actually shows a real map. This is
// still explicitly not the final style — DESIGN_SYSTEM.md's dark vector
// requirement is unmet either way; this just replaces "blank" with
// "real but unstyled," which is a step forward, not the destination.
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
    },
  ],
};

export const PLACEHOLDER_MAP_STYLE_URL: string | StyleSpecification =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? OSM_RASTER_STYLE;
