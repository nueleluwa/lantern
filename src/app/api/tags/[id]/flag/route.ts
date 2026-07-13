import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { tags, moderationFlags } from "@/db/schema";

const bodySchema = z.object({
  reason: z.enum(["inaccurate", "spam", "hate_or_profiling", "duplicate"]),
  flaggedBy: z.string().uuid().nullable().optional(),
});

// Flow D (PRD.md): "Any tag can be flagged by other users." Flagging
// itself never changes a tag's public status in Phase 1 — DO_NOT.md:
// "do not let a single unverified tag flip a segment's public status."
// A moderator resolves it via POST /api/moderation/flags/:id/resolve.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tagId } = await params;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [tag] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, tagId));
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const [flag] = await db
    .insert(moderationFlags)
    .values({
      tagId,
      flaggedBy: parsed.data.flaggedBy ?? null,
      reason: parsed.data.reason,
    })
    .returning();

  await db
    .update(tags)
    .set({ flaggedCount: sql`${tags.flaggedCount} + 1` })
    .where(eq(tags.id, tagId));

  return NextResponse.json({ flag }, { status: 201 });
}
