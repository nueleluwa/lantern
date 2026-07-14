import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { contributors } from "@/db/schema";
import { computeNewStreak, computeEarnedBadges } from "./contributor-progress-logic";

// MVP_SCOPE.md Phase 2: "Contributor accounts, streaks, 'Safety Scout'
// badges." DO_NOT.md: streaks/badges belong to the contribution flow
// only — never applied to someone else's reported danger, which is why
// this only ever touches the contributors table, never a Segment/Tag's
// safety fields.
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

    const newStreak = computeNewStreak(contributor.lastContributionAt, contributor.currentStreakDays, now);
    const newTagCount = contributor.tagCount + 1;
    const badges = computeEarnedBadges(contributor.badges, newTagCount);

    await tx
      .update(contributors)
      .set({
        tagCount: newTagCount,
        currentStreakDays: newStreak,
        longestStreakDays: Math.max(newStreak, contributor.longestStreakDays),
        lastContributionAt: now,
        badges,
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
