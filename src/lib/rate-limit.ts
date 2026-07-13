import "server-only";
import { redis } from "./redis";

// ARCHITECTURE.md §3: "max 10 tags per rolling hour per device. This is
// the first line of defense referenced in DO_NOT.md's concern about
// bad-faith tagging bursts; the corroboration/stability-window logic in
// DATA_MODEL.md is the second line, not the only one." Flagging needs
// the same defense — audit-project review found it had none.
const WINDOW_SECONDS = 60 * 60;
const MAX_TAGS_PER_HOUR = 10;
const MAX_FLAGS_PER_HOUR = 20;

async function checkAndIncrementRateLimit(
  namespace: string,
  deviceId: string,
  max: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${namespace}:${deviceId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
  };
}

export function checkAndIncrementTagRateLimit(deviceId: string) {
  return checkAndIncrementRateLimit("tag", deviceId, MAX_TAGS_PER_HOUR);
}

export function checkAndIncrementFlagRateLimit(deviceId: string) {
  return checkAndIncrementRateLimit("flag", deviceId, MAX_FLAGS_PER_HOUR);
}
