import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { moderationFlags, tags, segments, contributors } from "@/db/schema";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// DATA_MODEL.md API sketch: "GET /moderation/queue -> pending flags
// (moderator-only)". Also accepts ?resolution=upheld|dismissed for the
// Phase 2 admin UI's resolved-history view (MVP_SCOPE.md Phase 2:
// "Moderator admin UI (proper, not the Phase-1 table)"), and
// ?limit=&offset= — audit-project review found this had no pagination
// at all, which will degrade as flag volume grows.
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdmin(request))) {
    return apiError("unauthorized", "Unauthorized");
  }

  const resolutionFilter = request.nextUrl.searchParams.get("resolution") ?? "pending";
  const resolution = ["pending", "upheld", "dismissed"].includes(resolutionFilter)
    ? (resolutionFilter as "pending" | "upheld" | "dismissed")
    : "pending";

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);

  const rows = await db
    .select({
      flagId: moderationFlags.id,
      reason: moderationFlags.reason,
      createdAt: moderationFlags.createdAt,
      resolution: moderationFlags.resolution,
      tagId: tags.id,
      tagNote: tags.note,
      tagCategory: tags.category,
      tagSafetyFeeling: tags.safetyFeeling,
      tagFlaggedCount: tags.flaggedCount,
      segmentId: segments.id,
      segmentName: segments.name,
      contributorHandle: contributors.displayHandle,
      contributorTrustScore: contributors.trustScore,
    })
    .from(moderationFlags)
    .innerJoin(tags, eq(moderationFlags.tagId, tags.id))
    .innerJoin(segments, eq(tags.segmentId, segments.id))
    .leftJoin(contributors, eq(tags.contributorId, contributors.id))
    .where(eq(moderationFlags.resolution, resolution))
    .orderBy(desc(moderationFlags.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ flags: rows, limit, offset });
}
