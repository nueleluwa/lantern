import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { contributors } from "@/db/schema";

// MVP_SCOPE.md Phase 2: "Contributor accounts, streaks, 'Safety Scout'
// badges." DO_NOT.md: streaks/badges belong to the contribution flow
// only — never applied to someone else's reported danger, which is why
// this only ever touches the contributors table, never a Segment/Tag's
// safety fields.
const BADGE_THRESHOLDS: { tagCount: number; badge: string }[] = [
  { tagCount: 10, badge: "Safety Scout" },
  { tagCount: 50, badge: "Neighborhood Watch" },
  { tagCount: 200, badge: "Lantern Keeper" },
];

// Port Harcourt is Africa/Lagos, a fixed UTC+1 with no DST — bucketing
// by raw UTC calendar day (as this did before) means a contribution
// just after UTC midnight but still the same Lagos evening, or vice
// versa, could wrongly break or extend a streak. audit-project review.
const LOCAL_UTC_OFFSET_MS = 60 * 60 * 1000;

function localDayNumber(date: Date): number {
  return Math.floor((date.getTime() + LOCAL_UTC_OFFSET_MS) / (1000 * 60 * 60 * 24));
}

function isConsecutiveDay(previous: Date, now: Date): boolean {
  return localDayNumber(now) - localDayNumber(previous) === 1;
}

function isSameDay(previous: Date, now: Date): boolean {
  return localDayNumber(now) === localDayNumber(previous);
}

export async function recordContribution(contributorId: string, now = new Date()) {
  // Select-for-update + write in one transaction — audit-project review
  // found the previous plain read-then-write was a lost-update race:
  // two contributions from the same contributor arriving close together
  // (two tabs, or drainTagQueue flushing several queued tags back to
  // back) could both read the same starting row and one update's
  // streak/tagCount/badge changes would silently clobber the other's.
  await db.transaction(async (tx) => {
    const [contributor] = await tx
      .select()
      .from(contributors)
      .where(eq(contributors.id, contributorId))
      .for("update");
    if (!contributor) return;

    let newStreak = 1;
    if (contributor.lastContributionAt) {
      const last = new Date(contributor.lastContributionAt);
      if (isSameDay(last, now)) {
        newStreak = contributor.currentStreakDays || 1;
      } else if (isConsecutiveDay(last, now)) {
        newStreak = contributor.currentStreakDays + 1;
      }
    }

    const newTagCount = contributor.tagCount + 1;
    const earnedBadges = new Set(contributor.badges);
    for (const { tagCount, badge } of BADGE_THRESHOLDS) {
      if (newTagCount >= tagCount) earnedBadges.add(badge);
    }

    await tx
      .update(contributors)
      .set({
        tagCount: newTagCount,
        currentStreakDays: newStreak,
        longestStreakDays: Math.max(newStreak, contributor.longestStreakDays),
        lastContributionAt: now,
        badges: Array.from(earnedBadges),
      })
      .where(eq(contributors.id, contributorId));
  });
}

// DATA_MODEL.md: "trust_score ... rises with corroborated tags." Called
// when a segment's band newly commits (stability window passed) — each
// active tag in that bucket whose direction matches the committed band
// counts as corroborated. A documented heuristic, not a spec'd formula
// (the docs only define the direction, not the magnitude).
export async function bumpTrustForCorroboratedContributors(contributorIds: string[]) {
  if (contributorIds.length === 0) return;
  await db
    .update(contributors)
    .set({ trustScore: sql`${contributors.trustScore} + 0.1` })
    .where(inArray(contributors.id, contributorIds));
}
