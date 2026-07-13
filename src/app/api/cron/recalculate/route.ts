import { NextRequest, NextResponse } from "next/server";

// Vercel Cron Jobs invocation target (see vercel.json, hourly) — also
// meant to be called on tag write per ARCHITECTURE.md's recalculation
// mechanism ("Runs on tag write and on a rolling schedule").
//
// STOPPING POINT: the actual decay-weighted aggregate + 48h stability
// window logic (DATA_MODEL.md "Scoring algorithm") is deliberately not
// implemented yet. That algorithm decides when a segment's public
// safety band changes, which is exactly the DO_NOT.md territory the
// project owner asked to be consulted on before it's built ("Do not let
// a single unverified tag flip a segment's public status"). Confirm the
// approach before filling this in.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { status: "not_implemented", note: "Scoring engine pending — see comment in route.ts" },
    { status: 501 }
  );
}
