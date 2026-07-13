import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
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

  // Atomic conditional update: only a flag still 'pending' can be
  // resolved. Two concurrent/duplicate resolve calls on the same flag
  // (double-click, retry) would otherwise both take the 'upheld' branch
  // below and double-apply its side effects (trust penalty, rescoring)
  // — found by audit-project review.
  const [flag] = await db
    .update(moderationFlags)
    .set({ resolution: parsed.data.resolution })
    .where(and(eq(moderationFlags.id, flagId), eq(moderationFlags.resolution, "pending")))
    .returning({ id: moderationFlags.id, tagId: moderationFlags.tagId });

  if (!flag) {
    const [existing] = await db
      .select({ id: moderationFlags.id })
      .from(moderationFlags)
      .where(eq(moderationFlags.id, flagId));
    return NextResponse.json(
      { error: existing ? "Flag already resolved" : "Flag not found" },
      { status: existing ? 409 : 404 }
    );
  }

  if (parsed.data.resolution === "upheld") {
    const tag = await db.transaction(async (tx) => {
      const [t] = await tx
        .select({ id: tags.id, segmentId: tags.segmentId, contributorId: tags.contributorId })
        .from(tags)
        .where(eq(tags.id, flag.tagId));
      if (!t) return null;

      await tx.update(tags).set({ status: "removed" }).where(eq(tags.id, t.id));

      if (t.contributorId) {
        await tx
          .update(contributors)
          .set({ trustScore: sql`${contributors.trustScore} - 1` })
          .where(eq(contributors.id, t.contributorId));
      }

      return t;
    });

    if (tag) {
      after(async () => {
        await recalculateSegment(tag.segmentId);
        await invalidateSegmentCache(tag.segmentId);
      });
    }
  }

  return NextResponse.json({ ok: true });
}
