import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { isLockedOut, recordAuthFailure, getClientIp } from "./rate-limit";

// PRD.md "Open questions" leaves moderator identity unresolved ("Lantern
// staff, or a delegated community lead?"). This is a placeholder shared-
// secret gate — the simplest thing that satisfies "moderator-only" for
// the Phase 1 "simple admin table, not a polished screen yet"
// (MVP_SCOPE.md). Swap for real moderator accounts/roles once that
// open question is answered — tracked in ROADMAP.md.
//
// audit-project review: previously a plain `===` comparison (timing
// side-channel) with no rate limiting at all, so the secret was
// brute-forceable over the network with no backoff. Now constant-time
// (comparing SHA-256 digests, which normalizes length so
// timingSafeEqual's own length-mismatch fast-path can't leak anything
// either) and locked out after repeated failures per caller IP.
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export async function isAuthorizedAdmin(request: NextRequest): Promise<boolean> {
  if (!process.env.ADMIN_SECRET) return false;

  const ip = getClientIp(request);
  if (await isLockedOut("admin", ip)) return false;

  const secret = request.headers.get("x-admin-secret") ?? "";
  const authorized = constantTimeEquals(secret, process.env.ADMIN_SECRET);
  if (!authorized) {
    await recordAuthFailure("admin", ip);
  }
  return authorized;
}
