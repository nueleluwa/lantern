import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { moderationFlags, tags, segments } from "@/db/schema";
import { isAuthorizedAdmin } from "@/lib/admin-auth";

// DATA_MODEL.md API sketch: "GET /moderation/queue -> pending flags
// (moderator-only)". MVP_SCOPE.md Phase 1: "moderator review UI can be a
// simple admin table, not a polished screen yet" — this is the data
// source for that table (see /moderation page).
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    })
    .from(moderationFlags)
    .innerJoin(tags, eq(moderationFlags.tagId, tags.id))
    .innerJoin(segments, eq(tags.segmentId, segments.id))
    .where(eq(moderationFlags.resolution, "pending"));

  return NextResponse.json({ flags: rows });
}
