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

// The main overpass-api.de endpoint was intermittently returning 406s
// (public shared resource, no SLA) when this was first run — configurable
// so a different mirror can be swapped in without editing code.
// Known mirrors: https://overpass-api.de/api/interpreter,
// https://overpass.kumi.systems/api/interpreter,
// https://overpass.openstreetmap.fr/api/interpreter
const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass.openstreetmap.fr/api/interpreter";

// Pedestrian-relevant way types — excludes motorway/motorway_link (no
// pedestrian access at all) and service roads (driveways/parking lots,
// not through-routes). Originally excluded primary/trunk too, but
// testing against real Port Harcourt OSM data showed that leaves out
// the actual arterial connector roads between neighborhoods — without
// them the routing graph fragments into hundreds of disconnected
// islands of ~10-30 nodes each instead of one connected network. People
// also just do walk along/cross these roads in practice, so including
// them is correct for a walking-safety map, not just a routing fix.
const WALKABLE_HIGHWAY_VALUES = [
  "residential",
  "living_street",
  "pedestrian",
  "footway",
  "path",
  "unclassified",
  "tertiary",
  "tertiary_link",
  "secondary",
  "secondary_link",
  "primary",
  "primary_link",
  "trunk",
  "trunk_link",
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

  // OSM's Overpass usage policy asks for a descriptive User-Agent
  // identifying the application/contact — some mirrors (observed:
  // overpass.openstreetmap.fr) reject Node's default fetch UA with a 403
  // even though the same query works fine via curl.
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "User-Agent": "Lantern/0.1 (safe-route mapper, Port Harcourt)" },
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
