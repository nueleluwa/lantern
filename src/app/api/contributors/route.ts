import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contributors } from "@/db/schema";
import { setContributorCookie } from "@/lib/contributor-session";
import { checkAndIncrementContributorRateLimit } from "@/lib/rate-limit";
import { apiError, apiValidationError } from "@/lib/api-error";

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
//
// audit-project review: no rate limiting or device-id requirement at
// all, enabling mass Sybil account creation.
export async function POST(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return apiError("bad_request", "Missing X-Device-Id header");
  }

  const rateLimit = await checkAndIncrementContributorRateLimit(deviceId);
  if (!rateLimit.allowed) {
    return apiError("rate_limited", "Rate limit exceeded — try again later");
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const [contributor] = await db
      .insert(contributors)
      .values({ displayHandle: parsed.data.displayHandle })
      .returning();

    await setContributorCookie(contributor.id);

    return NextResponse.json({ contributor }, { status: 201 });
  } catch (err) {
    // Postgres unique_violation — displayHandle already taken.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return apiError("conflict", "That handle is already taken");
    }
    throw err;
  }
}
