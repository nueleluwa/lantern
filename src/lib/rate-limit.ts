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
const MAX_LIVE_SHARE_SESSIONS_PER_HOUR = 5;
const MAX_CONTRIBUTOR_ACCOUNTS_PER_HOUR = 5;

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

export function checkAndIncrementLiveShareRateLimit(deviceId: string) {
  return checkAndIncrementRateLimit("live-share", deviceId, MAX_LIVE_SHARE_SESSIONS_PER_HOUR);
}

export function checkAndIncrementContributorRateLimit(deviceId: string) {
  return checkAndIncrementRateLimit("contributor", deviceId, MAX_CONTRIBUTOR_ACCOUNTS_PER_HOUR);
}

// Failure-based lockout for shared-secret auth (admin secret, partner
// API keys) — audit-project review found neither had any protection
// against network brute-forcing, only the comparison itself. Keyed by
// caller IP, not device id, since these endpoints don't require one.
const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const MAX_AUTH_FAILURES = 10;

function lockoutKey(namespace: string, identifier: string) {
  return `lockout:${namespace}:${identifier}`;
}

export async function isLockedOut(namespace: string, identifier: string): Promise<boolean> {
  const count = (await redis.get<number>(lockoutKey(namespace, identifier))) ?? 0;
  return count >= MAX_AUTH_FAILURES;
}

export async function recordAuthFailure(namespace: string, identifier: string): Promise<void> {
  const key = lockoutKey(namespace, identifier);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
