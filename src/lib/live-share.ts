import "server-only";
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

type SessionRecord = {
  expiresAt: number;
  ownerToken: string;
  position: LiveSharePosition | null;
};

function sessionKey(id: string) {
  return `live-share:${id}`;
}

// The share link (id) is meant to be handed to a viewer — it must not
// also work as the credential for updating/ending the session. Found by
// audit-project review: previously the id was both, so anyone who
// obtained the link could overwrite the walker's position or end the
// session, not just view it. ownerToken never leaves the walker's own
// device/session.
export async function createLiveShareSession(): Promise<{
  id: string;
  ownerToken: string;
  expiresAt: number;
}> {
  const id = crypto.randomUUID();
  const ownerToken = crypto.randomUUID();
  const expiresAt = Date.now() + MAX_SESSION_SECONDS * 1000;
  const record: SessionRecord = { expiresAt, ownerToken, position: null };
  await redis.set(sessionKey(id), JSON.stringify(record), { ex: MAX_SESSION_SECONDS });
  return { id, ownerToken, expiresAt };
}

export async function updateLiveSharePosition(
  id: string,
  ownerToken: string,
  lng: number,
  lat: number
): Promise<boolean> {
  const existing = await redis.get<SessionRecord>(sessionKey(id));
  if (!existing || existing.ownerToken !== ownerToken) return false;

  const position: LiveSharePosition = { lng, lat, updatedAt: Date.now() };
  const remainingTtl = Math.max(1, Math.floor((existing.expiresAt - Date.now()) / 1000));

  const record: SessionRecord = { expiresAt: existing.expiresAt, ownerToken, position };
  await redis.set(sessionKey(id), JSON.stringify(record), {
    ex: Math.min(remainingTtl, POSITION_TTL_SECONDS),
  });
  return true;
}

// Viewer-facing read — deliberately takes only the id, no token. This is
// the one operation the share link itself is meant to authorize; never
// return ownerToken from here.
export async function getLiveShareSession(
  id: string
): Promise<{ expiresAt: number; position: LiveSharePosition | null } | null> {
  const record = await redis.get<SessionRecord>(sessionKey(id));
  if (!record) return null;
  return { expiresAt: record.expiresAt, position: record.position };
}

export async function endLiveShareSession(id: string, ownerToken: string): Promise<boolean> {
  const existing = await redis.get<SessionRecord>(sessionKey(id));
  if (!existing || existing.ownerToken !== ownerToken) return false;
  await redis.del(sessionKey(id));
  return true;
}
