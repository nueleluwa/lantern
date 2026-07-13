// DESIGN_SYSTEM.md "Map style" is explicit: don't recolor default OSM
// raster tiles at runtime — self-host vector tiles (OpenMapTiles schema)
// and author a real dark style in Maputnik (or reskin an existing open
// dark base style), then render with MapLibre GL JS.
//
// TODO before launch: replace this with the authored style — either a
// self-hosted OpenMapTiles style reskinned in Maputnik, or an existing
// open dark base style (e.g. a Stadia/MapTiler dark variant) with its
// roads/land/water layers remapped to the night-950/night-800/mist-400
// tokens in tokens.css. This placeholder is MapLibre's public demo style,
// unstyled, so local dev has something to render against — it is not the
// product's visual design and must not ship.
export const PLACEHOLDER_MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://demotiles.maplibre.org/style.json";
