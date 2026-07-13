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

function isConsecutiveDay(previous: Date, now: Date): boolean {
  const prevDay = Math.floor(previous.getTime() / (1000 * 60 * 60 * 24));
  const nowDay = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return nowDay - prevDay === 1;
}

function isSameDay(previous: Date, now: Date): boolean {
  const prevDay = Math.floor(previous.getTime() / (1000 * 60 * 60 * 24));
  const nowDay = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return nowDay === prevDay;
}

export async function recordContribution(contributorId: string, now = new Date()) {
  const [contributor] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.id, contributorId));
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

  await db
    .update(contributors)
    .set({
      tagCount: newTagCount,
      currentStreakDays: newStreak,
      longestStreakDays: Math.max(newStreak, contributor.longestStreakDays),
      lastContributionAt: now,
      badges: Array.from(earnedBadges),
    })
    .where(eq(contributors.id, contributorId));
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
