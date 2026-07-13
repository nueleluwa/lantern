import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { moderationFlags, tags, contributors } from "@/db/schema";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { recalculateSegment } from "@/lib/scoring";
import { invalidateSegmentCache } from "@/lib/redis";

const bodySchema = z.object({
  resolution: z.enum(["upheld", "dismissed"]),
});

// DATA_MODEL.md API sketch: "POST /moderation/flags/:id/resolve ->
// uphold/dismiss (moderator-only)". Upholding a flag removes the tag
// (status: removed) and triggers rescoring — DATA_MODEL.md: "trust_score
// ... falls with removed [tags]".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: flagId } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [flag] = await db
    .select({ id: moderationFlags.id, tagId: moderationFlags.tagId })
    .from(moderationFlags)
    .where(eq(moderationFlags.id, flagId));
  if (!flag) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }

  await db
    .update(moderationFlags)
    .set({ resolution: parsed.data.resolution })
    .where(eq(moderationFlags.id, flagId));

  if (parsed.data.resolution === "upheld") {
    const [tag] = await db
      .select({ id: tags.id, segmentId: tags.segmentId, contributorId: tags.contributorId })
      .from(tags)
      .where(eq(tags.id, flag.tagId));

    if (tag) {
      await db.update(tags).set({ status: "removed" }).where(eq(tags.id, tag.id));

      if (tag.contributorId) {
        await db
          .update(contributors)
          .set({ trustScore: sql`${contributors.trustScore} - 1` })
          .where(eq(contributors.id, tag.contributorId));
      }

      after(async () => {
        await recalculateSegment(tag.segmentId);
        await invalidateSegmentCache(tag.segmentId);
      });
    }
  }

  return NextResponse.json({ ok: true });
}
