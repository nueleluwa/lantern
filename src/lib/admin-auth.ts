import { NextRequest } from "next/server";

// PRD.md "Open questions" leaves moderator identity unresolved ("Lantern
// staff, or a delegated community lead?"). This is a placeholder shared-
// secret gate — the simplest thing that satisfies "moderator-only" for
// the Phase 1 "simple admin table, not a polished screen yet"
// (MVP_SCOPE.md). Swap for real moderator accounts/roles once that
// open question is answered — tracked in ROADMAP.md.
export function isAuthorizedAdmin(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(process.env.ADMIN_SECRET) && secret === process.env.ADMIN_SECRET;
}
