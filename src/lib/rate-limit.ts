import { redis } from "./redis";

// ARCHITECTURE.md §3: "max 10 tags per rolling hour per device. This is
// the first line of defense referenced in DO_NOT.md's concern about
// bad-faith tagging bursts; the corroboration/stability-window logic in
// DATA_MODEL.md is the second line, not the only one."
const MAX_TAGS_PER_HOUR = 10;
const WINDOW_SECONDS = 60 * 60;

export async function checkAndIncrementTagRateLimit(
  deviceId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:tag:${deviceId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return {
    allowed: count <= MAX_TAGS_PER_HOUR,
    remaining: Math.max(0, MAX_TAGS_PER_HOUR - count),
  };
}
