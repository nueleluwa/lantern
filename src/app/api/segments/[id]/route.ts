import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { segments, tags } from "@/db/schema";
import { apiError } from "@/lib/api-error";

// DATA_MODEL.md API sketch: "GET /segments/:id -> full detail incl.
// recent tags, breakdown". Backs the segment detail bottom sheet
// (PRD.md Flow A step 3, DESIGN_SYSTEM.md "Bottom sheet (segment
// detail)").
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // audit-project review: an unvalidated malformed id caused an
  // unhandled Postgres exception (invalid input syntax for type uuid)
  // instead of a clean 400.
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("bad_request", "id must be a valid UUID");
  }

  const [segment] = await db.select().from(segments).where(eq(segments.id, id));
  if (!segment) {
    return apiError("not_found", "Segment not found");
  }

  const recentTags = await db
    .select({
      id: tags.id,
      createdAt: tags.createdAt,
      timeOfDay: tags.timeOfDay,
      lighting: tags.lighting,
      safetyFeeling: tags.safetyFeeling,
      category: tags.category,
      note: tags.note,
      kind: tags.kind,
    })
    .from(tags)
    .where(and(eq(tags.segmentId, id), ne(tags.status, "removed")))
    .orderBy(desc(tags.createdAt))
    .limit(20);

  const breakdown = {
    safe: recentTags.filter((t) => t.safetyFeeling === "safe").length,
    caution: recentTags.filter((t) => t.safetyFeeling === "caution").length,
    avoid: recentTags.filter((t) => t.safetyFeeling === "avoid").length,
  };

  return NextResponse.json({
    segment: {
      id: segment.id,
      name: segment.name,
      neighborhood: segment.neighborhood,
      dayScore: segment.dayScore,
      nightScore: segment.nightScore,
      tagCount: segment.tagCount,
      lastTaggedAt: segment.lastTaggedAt,
    },
    breakdown,
    recentTags,
  });
}
