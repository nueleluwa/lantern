import { describe, it, expect } from "vitest";
import {
  isSameDay,
  isConsecutiveDay,
  computeNewStreak,
  computeEarnedBadges,
} from "../contributor-progress-logic";

describe("isSameDay / isConsecutiveDay (Africa/Lagos, UTC+1)", () => {
  it("treats 23:59 and 00:01 UTC as different days when they're the same Lagos day", () => {
    // 2026-07-14 23:59 UTC == 2026-07-15 00:59 Lagos
    // 2026-07-15 00:01 UTC == 2026-07-15 01:01 Lagos — same Lagos day
    const a = new Date("2026-07-14T23:59:00Z");
    const b = new Date("2026-07-15T00:01:00Z");
    expect(isSameDay(a, b)).toBe(true);
  });

  it("is consecutive across a Lagos midnight boundary", () => {
    // 2026-07-14 22:30 UTC == 2026-07-14 23:30 Lagos (still the 14th)
    // 2026-07-14 23:30 UTC == 2026-07-15 00:30 Lagos (now the 15th)
    const a = new Date("2026-07-14T22:30:00Z");
    const b = new Date("2026-07-14T23:30:00Z");
    expect(isConsecutiveDay(a, b)).toBe(true);
  });

  it("is not consecutive across a 2-day gap", () => {
    const a = new Date("2026-07-10T12:00:00Z");
    const b = new Date("2026-07-13T12:00:00Z");
    expect(isConsecutiveDay(a, b)).toBe(false);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe("computeNewStreak", () => {
  const now = new Date("2026-07-14T12:00:00Z");

  it("first-ever contribution starts a streak of 1", () => {
    expect(computeNewStreak(null, 0, now)).toBe(1);
  });

  it("a same-day repeat contribution leaves the streak unchanged", () => {
    const earlierToday = new Date("2026-07-14T06:00:00Z");
    expect(computeNewStreak(earlierToday, 5, now)).toBe(5);
  });

  it("a next-day contribution increments the streak", () => {
    const yesterday = new Date("2026-07-13T12:00:00Z");
    expect(computeNewStreak(yesterday, 5, now)).toBe(6);
  });

  it("a 2+ day gap resets the streak to 1", () => {
    const threeDaysAgo = new Date("2026-07-11T12:00:00Z");
    expect(computeNewStreak(threeDaysAgo, 20, now)).toBe(1);
  });
});

describe("computeEarnedBadges", () => {
  it("awards no badge below the first threshold", () => {
    expect(computeEarnedBadges([], 9)).toEqual([]);
  });

  it("awards 'Safety Scout' exactly at 10 tags", () => {
    expect(computeEarnedBadges([], 10)).toEqual(["Safety Scout"]);
  });

  it("awards both thresholds crossed at once (e.g. seeded/bulk update)", () => {
    expect(computeEarnedBadges([], 50)).toEqual(
      expect.arrayContaining(["Safety Scout", "Neighborhood Watch"])
    );
  });

  it("awards all three at 200 tags", () => {
    const badges = computeEarnedBadges([], 200);
    expect(badges).toEqual(
      expect.arrayContaining(["Safety Scout", "Neighborhood Watch", "Lantern Keeper"])
    );
    expect(badges).toHaveLength(3);
  });

  it("preserves previously-earned badges on a later call that doesn't cross a new threshold", () => {
    const badges = computeEarnedBadges(["Safety Scout"], 15);
    expect(badges).toEqual(["Safety Scout"]);
  });

  it("never loses a badge already earned, even if called with a lower count than before", () => {
    // Defensive: recordContribution always passes an incrementing count,
    // but the pure function itself should never silently drop history.
    const badges = computeEarnedBadges(["Safety Scout", "Neighborhood Watch"], 12);
    expect(badges).toEqual(expect.arrayContaining(["Safety Scout", "Neighborhood Watch"]));
  });
});
