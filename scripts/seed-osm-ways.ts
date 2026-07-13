// MVP_SCOPE.md Phase 1, step 2: "Segment model + PostGIS storage, seeded
// from OSM ways in the launch bbox." Pulls walkable ways (highway=*) for
// the configured launch bbox from the public Overpass API and inserts one
// Segment row per way. Re-run per new launch area (Phase 3 expansion
// playbook) by adding an entry to src/config/launch-area.ts.
//
// Usage: npm run seed:osm-ways

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { DEFAULT_LAUNCH_AREA } from "../src/config/launch-area";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Pedestrian-relevant way types only — this is a walking-safety map, not a
// general road map.
const WALKABLE_HIGHWAY_VALUES = [
  "residential",
  "living_street",
  "pedestrian",
  "footway",
  "path",
  "unclassified",
  "tertiary",
  "secondary",
];

type OverpassElement = {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry: { lat: number; lon: number }[];
};

async function fetchWaysInBbox(bbox: [number, number, number, number]) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const highwayFilter = WALKABLE_HIGHWAY_VALUES.join("|");

  const query = `
    [out:json][timeout:60];
    way["highway"~"^(${highwayFilter})$"](${minLat},${minLng},${maxLat},${maxLng});
    out geom;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) {
    throw new Error(`Overpass API request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { elements: OverpassElement[] };
  return json.elements;
}

function wayToLineStringWkt(way: OverpassElement) {
  const points = way.geometry.map((p) => `${p.lon} ${p.lat}`).join(", ");
  return `SRID=4326;LINESTRING(${points})`;
}

async function main() {
  const area = DEFAULT_LAUNCH_AREA;
  console.log(`Fetching OSM ways for "${area.label}" (${area.bbox.join(", ")})...`);

  const ways = await fetchWaysInBbox(area.bbox);
  console.log(`Fetched ${ways.length} ways from Overpass.`);

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  let inserted = 0;
  for (const way of ways) {
    if (way.geometry.length < 2) continue; // needs at least 2 points for a LineString

    await db.insert(schema.segments).values({
      osmWayId: String(way.id),
      geometry: wayToLineStringWkt(way),
      name: way.tags?.name ?? null,
      neighborhood: area.label,
    });
    inserted++;
  }

  console.log(`Inserted ${inserted} segments.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
