import { redis } from "./redis";

// Phase 3 (MVP_SCOPE.md): "Live share / walk-with-me companion mode."
// DO_NOT.md: "do not retain raw GPS trip trails past the point of
// aggregating them into segment tags." A live-share session is not a
// trip trail — it's an ephemeral, opt-in, session-scoped position
// exchange with a chosen contact. Enforced by design: Redis-only (never
// written to Postgres), only the single latest position is ever stored
// (overwritten, never appended), and the whole session hard-expires.
const MAX_SESSION_SECONDS = 4 * 60 * 60; // 4h ceiling on any single walk
const POSITION_TTL_SECONDS = 3 * 60; // if the walker's device goes quiet, viewers see "no recent update", not a stale pin forever

type LiveSharePosition = {
  lng: number;
  lat: number;
  updatedAt: number;
};

function sessionKey(id: string) {
  return `live-share:${id}`;
}

export async function createLiveShareSession(): Promise<{ id: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + MAX_SESSION_SECONDS * 1000;
  await redis.set(sessionKey(id), JSON.stringify({ expiresAt }), { ex: MAX_SESSION_SECONDS });
  return { id, expiresAt };
}

export async function updateLiveSharePosition(id: string, lng: number, lat: number): Promise<boolean> {
  const existing = await redis.get<{ expiresAt: number }>(sessionKey(id));
  if (!existing) return false;

  const position: LiveSharePosition = { lng, lat, updatedAt: Date.now() };
  const remainingTtl = Math.max(1, Math.floor((existing.expiresAt - Date.now()) / 1000));

  await redis.set(
    sessionKey(id),
    JSON.stringify({ expiresAt: existing.expiresAt, position }),
    { ex: Math.min(remainingTtl, POSITION_TTL_SECONDS) }
  );
  return true;
}

export async function getLiveShareSession(
  id: string
): Promise<{ expiresAt: number; position: LiveSharePosition | null } | null> {
  return redis.get(sessionKey(id));
}

export async function endLiveShareSession(id: string): Promise<void> {
  await redis.del(sessionKey(id));
}
