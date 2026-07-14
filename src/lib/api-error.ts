import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

// Shared error envelope for every API route — audit-project review
// found error bodies were inconsistent in shape (zod .flatten() objects
// in some routes, plain string messages in others), leaving no single
// contract a client-side error handler could rely on.
export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "rate_limited";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_error: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] }
  );
}

export function apiValidationError(zodError: z.ZodError) {
  return apiError("validation_error", "Request failed validation", zodError.flatten());
}
