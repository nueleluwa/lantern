import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contributors } from "@/db/schema";
import { getContributorIdFromCookie } from "@/lib/contributor-session";

export async function GET() {
  const contributorId = await getContributorIdFromCookie();
  if (!contributorId) {
    return NextResponse.json({ contributor: null });
  }

  const [contributor] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.id, contributorId));

  return NextResponse.json({ contributor: contributor ?? null });
}
