import { describe, it, expect } from "vitest";
import {
  decayedWeight,
  bucketMatches,
  computeBand,
  applyStabilityWindow,
  corroboratingContributorIds,
  aggregateBucket,
  HALF_LIFE_DAYS,
  MIN_WEIGHTED_TAG_COUNT,
  STABILITY_WINDOW_MS,
  type ScoringTag,
} from "../scoring-logic";

const NOW = new Date("2026-07-14T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function makeTag(overrides: Partial<ScoringTag> = {}): ScoringTag {
  return {
    createdAt: NOW,
    timeOfDay: "night",
    safetyFeeling: "safe",
    kind: "standard",
    weight: 1,
    status: "active",
    contributorId: null,
    ...overrides,
  };
}

describe("decayedWeight", () => {
  // Despite the "half_life_days" name (DATA_MODEL.md's own term), the
  // spec'd formula is weight * exp(-days/half_life) — a time constant,
  // not a true half-life decay (which would be 0.5^(days/half_life)).
  // At days == half_life this evaluates to weight * exp(-1) ≈ 36.8% of
  // base, not 50%. Testing the formula as spec'd, not as literally named.
  it("decays to base_weight * exp(-1) at days_since_tag == half_life, for each kind", () => {
    for (const kind of ["standard", "infrastructure", "lit_tonight"] as const) {
      const halfLife = HALF_LIFE_DAYS[kind];
      const tag = makeTag({ kind, createdAt: daysAgo(halfLife), weight: 2 });
      expect(decayedWeight(tag, NOW)).toBeCloseTo(2 * Math.exp(-1), 5);
    }
  });

  it("standard tags decay slower than lit_tonight tags over the same elapsed time", () => {
    const oneDayOld = daysAgo(1);
    const standard = decayedWeight(makeTag({ kind: "standard", createdAt: oneDayOld }), NOW);
    const litTonight = decayedWeight(makeTag({ kind: "lit_tonight", createdAt: oneDayOld }), NOW);
    expect(litTonight).toBeLessThan(standard);
  });

  it("infrastructure tags decay slower than standard tags over the same elapsed time", () => {
    const thirtyDaysOld = daysAgo(30);
    const standard = decayedWeight(makeTag({ kind: "standard", createdAt: thirtyDaysOld }), NOW);
    const infrastructure = decayedWeight(makeTag({ kind: "infrastructure", createdAt: thirtyDaysOld }), NOW);
    expect(infrastructure).toBeGreaterThan(standard);
  });

  it("a lit_tonight tag from 24h+ ago contributes near-zero weight", () => {
    const tag = makeTag({ kind: "lit_tonight", createdAt: daysAgo(1), weight: 1 });
    expect(decayedWeight(tag, NOW)).toBeLessThan(0.4);
  });

  it("a fresh tag (0 days old) decays to its full base weight", () => {
    const tag = makeTag({ createdAt: NOW, weight: 3 });
    expect(decayedWeight(tag, NOW)).toBeCloseTo(3, 10);
  });
});

describe("bucketMatches", () => {
  it("day bucket matches only 'day' tags", () => {
    expect(bucketMatches("day", "day")).toBe(true);
    expect(bucketMatches("day", "evening")).toBe(false);
    expect(bucketMatches("day", "night")).toBe(false);
  });

  it("night bucket matches 'evening' and 'night' tags (documented judgment call)", () => {
    expect(bucketMatches("night", "night")).toBe(true);
    expect(bucketMatches("night", "evening")).toBe(true);
    expect(bucketMatches("night", "day")).toBe(false);
  });
});

describe("computeBand", () => {
  it("stays unrated below MIN_WEIGHTED_TAG_COUNT even with a strongly positive average", () => {
    expect(computeBand(MIN_WEIGHTED_TAG_COUNT - 0.001, MIN_WEIGHTED_TAG_COUNT - 0.001)).toBe("unrated");
  });

  it("leaves unrated exactly at MIN_WEIGHTED_TAG_COUNT", () => {
    // average = 1 (all "safe"), totalWeight exactly at the threshold
    expect(computeBand(MIN_WEIGHTED_TAG_COUNT, MIN_WEIGHTED_TAG_COUNT)).toBe("lit_safe");
  });

  it("boundary: average exactly 1/3 is lit_safe", () => {
    const totalWeight = 3;
    const weightedSum = totalWeight * (1 / 3);
    expect(computeBand(weightedSum, totalWeight)).toBe("lit_safe");
  });

  it("boundary: average just under 1/3 is caution", () => {
    const totalWeight = 3;
    const weightedSum = totalWeight * (1 / 3) - 0.0001;
    expect(computeBand(weightedSum, totalWeight)).toBe("caution");
  });

  it("boundary: average exactly -1/3 is avoid", () => {
    const totalWeight = 3;
    const weightedSum = totalWeight * (-1 / 3);
    expect(computeBand(weightedSum, totalWeight)).toBe("avoid");
  });

  it("boundary: average just over -1/3 is caution", () => {
    const totalWeight = 3;
    const weightedSum = totalWeight * (-1 / 3) + 0.0001;
    expect(computeBand(weightedSum, totalWeight)).toBe("caution");
  });
});

describe("aggregateBucket", () => {
  it("excludes removed tags from the aggregate", () => {
    const tags = [
      makeTag({ safetyFeeling: "safe", status: "active", weight: 10 }),
      makeTag({ safetyFeeling: "avoid", status: "removed", weight: 10 }),
      makeTag({ safetyFeeling: "safe", status: "active", weight: 10 }),
      makeTag({ safetyFeeling: "safe", status: "active", weight: 10 }),
    ];
    // If the removed "avoid" tag were counted, this would pull the
    // average down toward caution/avoid instead of lit_safe.
    expect(aggregateBucket(tags, "night", NOW)).toBe("lit_safe");
  });

  it("only counts tags in the matching bucket", () => {
    const tags = [
      makeTag({ timeOfDay: "day", safetyFeeling: "avoid", weight: 10 }),
      makeTag({ timeOfDay: "night", safetyFeeling: "safe", weight: 10 }),
      makeTag({ timeOfDay: "night", safetyFeeling: "safe", weight: 10 }),
      makeTag({ timeOfDay: "night", safetyFeeling: "safe", weight: 10 }),
    ];
    expect(aggregateBucket(tags, "night", NOW)).toBe("lit_safe");
  });
});

describe("applyStabilityWindow", () => {
  const t0 = NOW;

  it("computed band matching the already-committed band clears any pending change", () => {
    const result = applyStabilityWindow("lit_safe", "lit_safe", "avoid", daysAgo(1), t0);
    expect(result).toEqual({
      committedBand: "lit_safe",
      pendingBand: null,
      pendingSince: null,
      justCommitted: false,
    });
  });

  it("a brand-new candidate band starts the stability clock, does not commit", () => {
    const result = applyStabilityWindow("avoid", "caution", null, null, t0);
    expect(result.committedBand).toBe("caution"); // unchanged
    expect(result.pendingBand).toBe("avoid");
    expect(result.pendingSince).toEqual(t0);
    expect(result.justCommitted).toBe(false);
  });

  it("held just under the 48h window: stays pending, does not commit", () => {
    const pendingSince = new Date(t0.getTime() - (STABILITY_WINDOW_MS - 1));
    const result = applyStabilityWindow("avoid", "caution", "avoid", pendingSince, t0);
    expect(result.committedBand).toBe("caution");
    expect(result.justCommitted).toBe(false);
  });

  it("held for exactly 48h: commits", () => {
    const pendingSince = new Date(t0.getTime() - STABILITY_WINDOW_MS);
    const result = applyStabilityWindow("avoid", "caution", "avoid", pendingSince, t0);
    expect(result.committedBand).toBe("avoid");
    expect(result.pendingBand).toBeNull();
    expect(result.pendingSince).toBeNull();
    expect(result.justCommitted).toBe(true);
  });

  it("adversarial: a bad-faith burst reverts before commit — the clock restarts, never commits from the burst", () => {
    // Segment is stable at "caution". A burst pushes the computed band
    // to "avoid" (start of pending). Just before 48h elapses, the burst
    // is diluted/reverted and the computed band goes back to "caution"
    // (matching committed) — pending must clear, not carry over.
    const burstStart = t0;
    const afterBurst = applyStabilityWindow("avoid", "caution", null, null, burstStart);
    expect(afterBurst.pendingBand).toBe("avoid");

    const almost48hLater = new Date(burstStart.getTime() + STABILITY_WINDOW_MS - 1000);
    const reverted = applyStabilityWindow(
      "caution", // computed band reverted back to the stable value
      "caution",
      afterBurst.pendingBand,
      afterBurst.pendingSince,
      almost48hLater
    );
    expect(reverted.committedBand).toBe("caution");
    expect(reverted.pendingBand).toBeNull();
    expect(reverted.justCommitted).toBe(false);

    // And if the burst re-appears after the revert, it must restart the
    // clock from this later point, not resume the original one.
    const burstAgain = applyStabilityWindow(
      "avoid",
      reverted.committedBand,
      reverted.pendingBand,
      reverted.pendingSince,
      almost48hLater
    );
    expect(burstAgain.pendingSince).toEqual(almost48hLater);
    expect(burstAgain.justCommitted).toBe(false);
  });
});

describe("corroboratingContributorIds", () => {
  const tags: ScoringTag[] = [
    makeTag({ contributorId: "a", safetyFeeling: "safe", timeOfDay: "night" }),
    makeTag({ contributorId: "b", safetyFeeling: "avoid", timeOfDay: "night" }),
    makeTag({ contributorId: "c", safetyFeeling: "safe", timeOfDay: "day" }), // wrong bucket
    makeTag({ contributorId: null, safetyFeeling: "safe", timeOfDay: "night" }), // anonymous
    makeTag({ contributorId: "d", safetyFeeling: "safe", timeOfDay: "night", status: "removed" }),
  ];

  it("unrated band returns no corroborators", () => {
    expect(corroboratingContributorIds(tags, "night", "unrated")).toEqual([]);
  });

  it("only returns contributors whose tag direction matches the committed band", () => {
    expect(corroboratingContributorIds(tags, "night", "lit_safe")).toEqual(["a"]);
    expect(corroboratingContributorIds(tags, "night", "avoid")).toEqual(["b"]);
  });

  it("excludes anonymous (null contributorId) tags", () => {
    const result = corroboratingContributorIds(tags, "night", "lit_safe");
    expect(result).not.toContain(null);
    expect(result).toEqual(["a"]);
  });

  it("excludes removed tags", () => {
    const removedOnly: ScoringTag[] = [
      makeTag({ contributorId: "d", safetyFeeling: "safe", timeOfDay: "night", status: "removed" }),
    ];
    expect(corroboratingContributorIds(removedOnly, "night", "lit_safe")).toEqual([]);
  });
});
