import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { partnerApiKeys } from "@/db/schema";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// Phase 3 (MVP_SCOPE.md): "B2B/B2G data export for partners (aggregated,
// de-identified only)". Keys gate access to the aggregated export
// endpoint only — never to raw tags/contributors.
export async function verifyPartnerApiKey(rawKey: string | null): Promise<boolean> {
  if (!rawKey) return false;
  const hashed = hashApiKey(rawKey);
  const [key] = await db
    .select({ id: partnerApiKeys.id })
    .from(partnerApiKeys)
    .where(and(eq(partnerApiKeys.hashedKey, hashed), isNull(partnerApiKeys.revokedAt)));
  return Boolean(key);
}
