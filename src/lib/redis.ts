import "server-only";
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// ARCHITECTURE.md §2: short TTL — long enough to absorb repeated map-pan
// requests, short enough that a new tag shows up quickly.
export const SEGMENT_CACHE_TTL_SECONDS = 120;

export function segmentsCacheKey(params: {
  bbox: string;
  zoom: number;
  timeOfDay: "day" | "night";
}) {
  return `segments:${params.bbox}:${params.zoom}:${params.timeOfDay}`;
}

// ARCHITECTURE.md §2 write path: "invalidates the Redis cache entries for
// that segment's bbox (targeted invalidation, not a full cache flush)".
// Cache keys are viewport-shaped (client bbox+zoom+time_of_day), not
// segment-shaped, so we keep a reverse index: which cache keys currently
// contain a given segment. Populated on cache write, consumed on tag
// write to invalidate exactly the affected keys.
function segmentCacheIndexKey(segmentId: string) {
  return `segment-cache-index:${segmentId}`;
}

export async function recordSegmentInCacheKey(segmentId: string, cacheKey: string) {
  const indexKey = segmentCacheIndexKey(segmentId);
  await redis.sadd(indexKey, cacheKey);
  await redis.expire(indexKey, SEGMENT_CACHE_TTL_SECONDS);
}

export async function invalidateSegmentCache(segmentId: string) {
  const indexKey = segmentCacheIndexKey(segmentId);
  const cacheKeys = await redis.smembers(indexKey);
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
  }
  await redis.del(indexKey);
}
