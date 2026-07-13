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
