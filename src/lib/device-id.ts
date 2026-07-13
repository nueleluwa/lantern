"use client";

// ARCHITECTURE.md: rate limiting is per-device, not per-IP (carrier NAT
// puts many users behind few IPs). DO_NOT.md: contributor handles/ids must
// never be derivable from a real name, phone number, or account by
// default — so this is a client-generated random token, not a commercial
// fingerprinting library (which infers identity from device signals).
const STORAGE_KEY = "lantern_device_id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
