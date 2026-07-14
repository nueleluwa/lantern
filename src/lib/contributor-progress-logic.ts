// Pure streak/badge logic, split out of contributor-progress.ts so it
// can be unit-tested without a database — previously entirely untested
// (audit-project review), including the most bug-prone branch (streak
// reset after a missed day).

export const BADGE_THRESHOLDS: { tagCount: number; badge: string }[] = [
  { tagCount: 10, badge: "Safety Scout" },
  { tagCount: 50, badge: "Neighborhood Watch" },
  { tagCount: 200, badge: "Lantern Keeper" },
];

// Port Harcourt is Africa/Lagos, a fixed UTC+1 with no DST — bucketing
// by raw UTC calendar day means a contribution just after UTC midnight
// but still the same Lagos evening, or vice versa, could wrongly break
// or extend a streak. audit-project review.
const LOCAL_UTC_OFFSET_MS = 60 * 60 * 1000;

function localDayNumber(date: Date): number {
  return Math.floor((date.getTime() + LOCAL_UTC_OFFSET_MS) / (1000 * 60 * 60 * 24));
}

export function isConsecutiveDay(previous: Date, now: Date): boolean {
  return localDayNumber(now) - localDayNumber(previous) === 1;
}

export function isSameDay(previous: Date, now: Date): boolean {
  return localDayNumber(now) === localDayNumber(previous);
}

export function computeNewStreak(
  lastContributionAt: Date | null,
  currentStreakDays: number,
  now: Date
): number {
  if (!lastContributionAt) return 1;
  if (isSameDay(lastContributionAt, now)) return currentStreakDays || 1;
  if (isConsecutiveDay(lastContributionAt, now)) return currentStreakDays + 1;
  return 1; // missed a day (or more) — streak resets
}

export function computeEarnedBadges(existingBadges: string[], newTagCount: number): string[] {
  const earned = new Set(existingBadges);
  for (const { tagCount, badge } of BADGE_THRESHOLDS) {
    if (newTagCount >= tagCount) earned.add(badge);
  }
  return Array.from(earned);
}
