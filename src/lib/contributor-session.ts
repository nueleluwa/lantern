import "server-only";
import { cookies } from "next/headers";

// PROJECT.md: "anonymous-by-default, optional account for contribution
// history." No password/email — a contributor account is just a label
// (display handle) attached to a browser via a plain cookie, since
// there's nothing sensitive gated behind it (DO_NOT.md: handles must
// never be derivable from a real name/phone/account regardless).
const COOKIE_NAME = "lantern_contributor_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getContributorIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setContributorCookie(contributorId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, contributorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}
