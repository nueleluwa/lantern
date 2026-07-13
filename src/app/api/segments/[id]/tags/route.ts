import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { segments, tags } from "@/db/schema";
import { checkAndIncrementTagRateLimit } from "@/lib/rate-limit";
import { invalidateSegmentCache } from "@/lib/redis";
import { recalculateSegment } from "@/lib/scoring";

const bodySchema = z.object({
  timeOfDay: z.enum(["day", "evening", "night"]),
  lighting: z.enum(["lit", "dim", "dark"]),
  safetyFeeling: z.enum(["safe", "caution", "avoid"]),
  category: z
    .enum(["harassment", "no_sidewalk", "flooding", "animals", "no_transport_available", "other"])
    .nullable()
    .optional(),
  note: z.string().max(280).nullable().optional(),
  kind: z.enum(["standard", "infrastructure", "lit_tonight"]).optional().default("standard"),
});

// Flow B (PRD.md): anonymous tag submission. DO_NOT.md: no free-text
// category — category is the fixed enum above, note is a separate
// optional free-text field that is never used as a safety-signal
// category itself.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: segmentId } = await params;

  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "Missing X-Device-Id header" }, { status: 400 });
  }

  const rateLimit = await checkAndIncrementTagRateLimit(deviceId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded — try again later" },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const [segment] = await db.select({ id: segments.id }).from(segments).where(eq(segments.id, segmentId));
  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const [tag] = await db
    .insert(tags)
    .values({
      segmentId,
      deviceId,
      timeOfDay: body.timeOfDay,
      lighting: body.lighting,
      safetyFeeling: body.safetyFeeling,
      category: body.category ?? null,
      note: body.note ?? null,
      kind: body.kind,
    })
    .returning();

  await db
    .update(segments)
    .set({
      tagCount: sql`${segments.tagCount} + 1`,
      lastTaggedAt: new Date(),
    })
    .where(eq(segments.id, segmentId));

  // ARCHITECTURE.md §2 write path: recalculation happens off the
  // client-visible request path so submission stays fast. On Vercel
  // there's no persistent queue consumer to hand this to, so `after()`
  // runs it once the response has been sent within the same invocation —
  // the serverless-native equivalent of "queue a recalculation job"
  // (see also the hourly /api/cron/recalculate for pure time-decay).
  after(async () => {
    await recalculateSegment(segmentId);
    await invalidateSegmentCache(segmentId);
  });

  return NextResponse.json({ tag }, { status: 201 });
}
