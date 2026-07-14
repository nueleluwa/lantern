import { NextRequest, NextResponse } from "next/server";
import { createLiveShareSession } from "@/lib/live-share";
import { checkAndIncrementLiveShareRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

// audit-project review: session creation had no rate limiting — a
// low-cost but real resource-exhaustion vector against Redis (each
// session holds a key for up to 4h).
export async function POST(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return apiError("bad_request", "Missing X-Device-Id header");
  }

  const rateLimit = await checkAndIncrementLiveShareRateLimit(deviceId);
  if (!rateLimit.allowed) {
    return apiError("rate_limited", "Rate limit exceeded — try again later");
  }

  const session = await createLiveShareSession();
  return NextResponse.json(session, { status: 201 });
}
