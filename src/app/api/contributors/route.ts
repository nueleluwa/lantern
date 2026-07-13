import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contributors } from "@/db/schema";
import { setContributorCookie } from "@/lib/contributor-session";

const bodySchema = z.object({
  displayHandle: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "letters, numbers, - and _ only"),
});

// MVP_SCOPE.md Phase 2: "Contributor accounts... for contribution
// history." Optional — Phase 1's anonymous flow keeps working
// unchanged for anyone who never calls this.
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [contributor] = await db
    .insert(contributors)
    .values({ displayHandle: parsed.data.displayHandle })
    .returning();

  await setContributorCookie(contributor.id);

  return NextResponse.json({ contributor }, { status: 201 });
}
