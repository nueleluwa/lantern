import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { ROUTE_DISCLAIMER } from "./route-disclaimer";

export { ROUTE_DISCLAIMER };

// Phase 3 (MVP_SCOPE.md): "Route suggestion that prefers higher-scored
// segments (explicitly not a strict 'safest route' router — see
// DO_NOT.md on liability language)". This is a preference, not a
// guarantee: it nudges pgr_dijkstra's cost function toward better-rated
// segments, it does not refuse to route through a caution/avoid segment
// if that's the only way through — DO_NOT.md forbids implying a
// stronger guarantee than the tag data supports, and a router that
// silently fails or strands the user would do exactly that.
const BAND_COST_MULTIPLIER: Record<string, number> = {
  lit_safe: 1,
  caution: 2,
  avoid: 5,
  unrated: 1.5,
};

// SQL column name, never user input — timeOfDay is validated against
// this literal union before reaching any query string.
const SCORE_COLUMN: Record<"day" | "night", "day_score" | "night_score"> = {
  day: "day_score",
  night: "night_score",
};

export type RouteResult = {
  geometry: GeoJSON.LineString;
  segmentIds: string[];
  totalCost: number;
  disclaimer: string;
};

// Routing graph lives in segments_noded (scripts/002_enable_pgrouting_topology.sql),
// not the raw segments table — see that script's 2026-07-13 correction
// note for why: OSM ways pass through unsplit intersections, so a plain
// source/target pair on un-split geometry misses most real connections.
// segments_noded.old_id joins back to segments.routing_id to look up
// each sub-edge's band (for cost) and original segment uuid (for output).

async function nearestNodeId(lng: number, lat: number): Promise<number | null> {
  const result = await db.execute<{ id: number }>(sql`
    select id
    from segments_noded_vertices_pgr
    order by the_geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    limit 1
  `);
  return result[0]?.id ?? null;
}

export async function findSuggestedRoute(
  from: [number, number],
  to: [number, number],
  timeOfDay: "day" | "night"
): Promise<RouteResult | null> {
  const scoreColumn = SCORE_COLUMN[timeOfDay];

  const startId = await nearestNodeId(from[0], from[1]);
  const endId = await nearestNodeId(to[0], to[1]);
  if (startId === null || endId === null || startId === endId) return null;

  // Cost = this sub-edge's own length (not the whole original street's
  // length, since pgr_nodeNetwork may have split it) * band multiplier
  // looked up from the original segment it belongs to.
  const edgeSql = `
    select
      n.id as id,
      n.source,
      n.target,
      ST_Length(n.geometry) * (
        case s.${scoreColumn}
          when 'lit_safe' then ${BAND_COST_MULTIPLIER.lit_safe}
          when 'caution' then ${BAND_COST_MULTIPLIER.caution}
          when 'avoid' then ${BAND_COST_MULTIPLIER.avoid}
          else ${BAND_COST_MULTIPLIER.unrated}
        end
      ) as cost
    from segments_noded n
    join segments s on s.routing_id = n.old_id
    where n.source is not null and n.target is not null
  `;

  const pathRows = await db.execute<{
    seq: number;
    node: number;
    edge: number;
    cost: number;
    agg_cost: number;
  }>(sql`
    select * from pgr_dijkstra(${edgeSql}::text, ${startId}::bigint, ${endId}::bigint, directed => false)
  `);

  if (pathRows.length === 0) return null;

  // pgr_dijkstra's bigint columns (node/edge/agg_cost) come back as
  // strings from the driver, not numbers, to avoid precision loss for
  // values beyond JS's safe integer range — comparing/filtering against
  // a numeric literal silently never matches unless explicitly coerced.
  const edgeIds = pathRows.map((r) => Number(r.edge)).filter((e) => e !== -1);
  if (edgeIds.length === 0) return null;

  const subEdgeRows = await db.execute<{ id: number; segment_id: string; geojson: string }>(sql`
    select n.id, s.id as segment_id, ST_AsGeoJSON(n.geometry) as geojson
    from segments_noded n
    join segments s on s.routing_id = n.old_id
    where n.id = any(array[${sql.join(edgeIds.map((id) => sql`${id}::bigint`), sql`, `)}])
  `);

  // Preserve pgr_dijkstra's traversal order, not the arbitrary SQL
  // return order.
  const byNodedId = new Map(subEdgeRows.map((r) => [Number(r.id), r]));
  const orderedCoordinates: [number, number][] = [];
  const orderedSegmentIds: string[] = [];

  for (const edgeId of edgeIds) {
    const row = byNodedId.get(edgeId);
    if (!row) continue;
    // A single tagged street may be split into several sub-edges — only
    // record its id once, in order of first traversal.
    if (orderedSegmentIds[orderedSegmentIds.length - 1] !== row.segment_id) {
      orderedSegmentIds.push(row.segment_id);
    }
    const geom = JSON.parse(row.geojson) as GeoJSON.LineString;
    orderedCoordinates.push(...(geom.coordinates as [number, number][]));
  }

  const totalCost = pathRows[pathRows.length - 1]?.agg_cost ?? 0;

  return {
    geometry: { type: "LineString", coordinates: orderedCoordinates },
    segmentIds: orderedSegmentIds,
    totalCost,
    disclaimer: ROUTE_DISCLAIMER,
  };
}
