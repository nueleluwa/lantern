import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { segments } from "@/db/schema";
import {
  redis,
  segmentsCacheKey,
  recordSegmentInCacheKey,
  SEGMENT_CACHE_TTL_SECONDS,
} from "@/lib/redis";

// ~0.01deg ~= 1.1km at this latitude — coarse enough that nearby pans at
// the same zoom collapse onto the same cache key, fine enough that a
// single grid cell isn't so large the cached response bloats.
const CACHE_GRID_DEGREES = 0.01;

function snapBboxToGrid(bbox: [number, number, number, number]): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    Math.floor(minLng / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES,
    Math.floor(minLat / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES,
    Math.ceil(maxLng / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES,
    Math.ceil(maxLat / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES,
  ];
}

const querySchema = z.object({
  bbox: z
    .string()
    .transform((v) => v.split(",").map(Number))
    .refine((v): v is [number, number, number, number] => v.length === 4 && v.every((n) => !Number.isNaN(n)), {
      message: "bbox must be minLng,minLat,maxLng,maxLat",
    }),
  time_of_day: z.enum(["day", "night"]),
  zoom: z.coerce.number().optional().default(0),
});

// ARCHITECTURE.md §2 read path: cache check -> spatial query on miss ->
// write-through with a short TTL. This route only reads the already-stored
// day_score/night_score bands — computing/recomputing those bands is the
// scoring-engine work that comes after this checkpoint.
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { bbox, time_of_day, zoom } = parsed.data;
  // Snap to a coarse grid (outward, so the queried area always fully
  // covers what the client asked for) before building the cache key —
  // audit-project review found that using the raw, full-precision
  // client bbox meant nearly every map pan produced a distinct cache
  // key, giving the Redis cache (built specifically to absorb repeated
  // pans per ARCHITECTURE.md §2) a near-zero real-world hit rate.
  const [minLng, minLat, maxLng, maxLat] = snapBboxToGrid(bbox);

  const cacheKey = segmentsCacheKey({
    bbox: [minLng, minLat, maxLng, maxLat].join(","),
    zoom,
    timeOfDay: time_of_day,
  });
  const cached = await redis.get<GeoJSON.FeatureCollection>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const scoreColumn = time_of_day === "day" ? segments.dayScore : segments.nightScore;

  const rows = await db
    .select({
      id: segments.id,
      name: segments.name,
      band: scoreColumn,
      tagCount: segments.tagCount,
      lastTaggedAt: segments.lastTaggedAt,
      geojson: sql<string>`ST_AsGeoJSON(${segments.geometry})`,
    })
    .from(segments)
    .where(
      sql`ST_Intersects(${segments.geometry}, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`
    );

  const featureCollection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: JSON.parse(row.geojson),
      properties: {
        id: row.id,
        name: row.name,
        band: row.band,
        tagCount: row.tagCount,
        lastTaggedAt: row.lastTaggedAt,
      },
    })),
  };

  // Cache write-through and the reverse-index bookkeeping have no
  // bearing on the response body — deferred to after() so they don't
  // sit on the hot path (audit-project review: this was previously
  // awaited before responding, blocking on 2N Redis round trips for N
  // segments in the viewport).
  after(async () => {
    await redis.set(cacheKey, featureCollection, { ex: SEGMENT_CACHE_TTL_SECONDS });
    await Promise.all(rows.map((row) => recordSegmentInCacheKey(row.id, cacheKey)));
  });

  return NextResponse.json(featureCollection);
}
