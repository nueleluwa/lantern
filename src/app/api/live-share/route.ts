import { NextResponse } from "next/server";
import { createLiveShareSession } from "@/lib/live-share";

export async function POST() {
  const session = await createLiveShareSession();
  return NextResponse.json(session, { status: 201 });
}
