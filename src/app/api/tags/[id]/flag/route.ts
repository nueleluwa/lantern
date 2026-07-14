import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { tags, moderationFlags } from "@/db/schema";
import { checkAndIncrementFlagRateLimit } from "@/lib/rate-limit";
import { getContributorIdFromCookie } from "@/lib/contributor-session";
import { apiError, apiValidationError } from "@/lib/api-error";

const bodySchema = z.object({
  reason: z.enum(["inaccurate", "spam", "hate_or_profiling", "duplicate"]),
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
  if (!z.string().uuid().safeParse(tagId).success) {
    return apiError("bad_request", "id must be a valid UUID");
  }

  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return apiError("bad_request", "Missing X-Device-Id header");
  }

  const rateLimit = await checkAndIncrementFlagRateLimit(deviceId);
  if (!rateLimit.allowed) {
    return apiError("rate_limited", "Rate limit exceeded — try again later");
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const [tag] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, tagId));
  if (!tag) {
    return apiError("not_found", "Tag not found");
  }

  // Identity is derived server-side from the session cookie, never taken
  // from the request body — audit-project review found the previous
  // client-supplied flaggedBy field let anyone attribute a flag to any
  // other contributor's real UUID.
  const flaggedBy = await getContributorIdFromCookie();

  const [flag] = await db
    .insert(moderationFlags)
    .values({
      tagId,
      flaggedBy,
      reason: parsed.data.reason,
    })
    .returning();

  await db
    .update(tags)
    .set({ flaggedCount: sql`${tags.flaggedCount} + 1` })
    .where(eq(tags.id, tagId));

  return NextResponse.json({ flag }, { status: 201 });
}
