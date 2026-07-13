import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getLiveShareSession,
  updateLiveSharePosition,
  endLiveShareSession,
} from "@/lib/live-share";

const bodySchema = z.object({ lng: z.number(), lat: z.number() });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getLiveShareSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session ended or expired" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ok = await updateLiveSharePosition(id, parsed.data.lng, parsed.data.lat);
  if (!ok) {
    return NextResponse.json({ error: "Session ended or expired" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await endLiveShareSession(id);
  return NextResponse.json({ ok: true });
}
