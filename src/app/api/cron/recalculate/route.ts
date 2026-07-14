import { NextRequest, NextResponse } from "next/server";
import { recalculateAllSegments } from "@/lib/scoring";
import { apiError } from "@/lib/api-error";

// Vercel Cron Jobs invocation target (see vercel.json — daily, not
// hourly: Vercel's Hobby plan only supports daily cron schedules, see
// CHANGELOG.md 2026-07-14) — ARCHITECTURE.md §3: "Runs on tag write and
// on a rolling schedule... to handle pure time-decay even with no new
// tags." Tag-write recalculation happens inline via `after()` in the
// tag submission route; this covers decay for segments with no new tags.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("unauthorized", "Unauthorized");
  }

  const count = await recalculateAllSegments();

  return NextResponse.json({ recalculated: count });
}
