import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { segments } from "@/db/schema";
import { verifyPartnerApiKey } from "@/lib/partner-auth";
import { getClientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

// Phase 3 (MVP_SCOPE.md): "B2B/B2G data export for partners (aggregated,
// de-identified only)". Deliberately excludes: individual tags, notes
// (free text can be identifying), contributor ids/handles, device ids,
// and exact timestamps (last_tagged_at is truncated to the day) — only
// segment-level, already-public aggregate bands leave this endpoint.
//
// Versioned (/api/v1/...) — audit-project review: this is the one route
// explicitly serving external partners, so a future breaking change to
// the exported shape needs a migration path they can rely on, unlike
// the rest of the (currently unversioned, internal-only) API.
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const authorized = await verifyPartnerApiKey(apiKey, getClientIp(request));
  if (!authorized) {
    return apiError("unauthorized", "Unauthorized");
  }

  const rows = await db
    .select({
      id: segments.id,
      neighborhood: segments.neighborhood,
      dayScore: segments.dayScore,
      nightScore: segments.nightScore,
      tagCount: segments.tagCount,
      lastTaggedDate: sql<string>`date_trunc('day', ${segments.lastTaggedAt})`,
    })
    .from(segments);

  return NextResponse.json({ segments: rows, exportedAt: new Date().toISOString() });
}
