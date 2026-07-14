import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getLiveShareSession,
  updateLiveSharePosition,
  endLiveShareSession,
} from "@/lib/live-share";
import { apiError, apiValidationError } from "@/lib/api-error";

const bodySchema = z.object({ lng: z.number(), lat: z.number() });

// GET is viewer-facing (the share link alone is the intended
// authorization for reading position) — POST/DELETE require the
// separate owner token from session creation, found missing entirely by
// audit-project review.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getLiveShareSession(id);
  if (!session) {
    return apiError("not_found", "Session ended or expired");
  }
  return NextResponse.json(session);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerToken = request.headers.get("x-owner-token");
  if (!ownerToken) {
    return apiError("bad_request", "Missing X-Owner-Token header");
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const ok = await updateLiveSharePosition(id, ownerToken, parsed.data.lng, parsed.data.lat);
  if (!ok) {
    return apiError("not_found", "Session ended, expired, or wrong owner token");
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerToken = request.headers.get("x-owner-token");
  if (!ownerToken) {
    return apiError("bad_request", "Missing X-Owner-Token header");
  }

  const ok = await endLiveShareSession(id, ownerToken);
  if (!ok) {
    return apiError("not_found", "Session ended, expired, or wrong owner token");
  }
  return NextResponse.json({ ok: true });
}
