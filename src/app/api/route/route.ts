import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findSuggestedRoute } from "@/lib/routing";

const lngLat = z
  .string()
  .transform((v) => v.split(",").map(Number))
  .refine((v): v is [number, number] => v.length === 2 && v.every((n) => !Number.isNaN(n)), {
    message: "must be lng,lat",
  });

const querySchema = z.object({
  from: lngLat,
  to: lngLat,
  time_of_day: z.enum(["day", "night"]),
});

// Phase 3 (MVP_SCOPE.md) — "not a strict router". DO_NOT.md requires a
// persistent disclaimer "in the routing UI itself, not just in a
// terms-of-service page" — the disclaimer text ships as part of every
// response so the client can't accidentally render the route without it.
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { from, to, time_of_day } = parsed.data;
  const route = await findSuggestedRoute(from, to, time_of_day);

  if (!route) {
    return NextResponse.json(
      { error: "No route found between those points" },
      { status: 404 }
    );
  }

  return NextResponse.json(route);
}
