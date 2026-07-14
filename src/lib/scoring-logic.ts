// Pure scoring logic, split out of scoring.ts so it can be unit-tested
// without a database or "server-only" in the import graph — this is the
// safety-critical part DATA_MODEL.md and DO_NOT.md care most about
// (decay math, banding thresholds, the stability-window anti-abuse
// rule), previously untested (audit-project review, critical finding).

// DATA_MODEL.md "Scoring algorithm" — implemented as specified:
//   weight = base_weight * exp(-days_since_tag / half_life_days)
//   half_life_days = 45 default; 180 for static lighting-infrastructure
//   reports; 1 for "lit tonight" reports (expire by morning).
export const HALF_LIFE_DAYS: Record<"standard" | "infrastructure" | "lit_tonight", number> = {
  standard: 45,
  infrastructure: 180,
  lit_tonight: 1,
};

// "Require a minimum weighted tag count (e.g. 3) before a segment leaves
// unrated."
export const MIN_WEIGHTED_TAG_COUNT = 3;

// "a segment's band only changes when the new aggregate has been stable
// across >=2 recalculation cycles (e.g. 48 hours apart)"
export const STABILITY_WINDOW_MS = 48 * 60 * 60 * 1000;

export const SAFETY_FEELING_VALUE: Record<"safe" | "caution" | "avoid", number> = {
  safe: 1,
  caution: 0,
  avoid: -1,
};

export type Band = "lit_safe" | "caution" | "avoid" | "unrated";
export type Bucket = "day" | "night";

export type ScoringTag = {
  createdAt: Date;
  timeOfDay: "day" | "evening" | "night";
  safetyFeeling: "safe" | "caution" | "avoid";
  kind: "standard" | "infrastructure" | "lit_tonight";
  weight: number;
  status: "active" | "under_review" | "removed";
  contributorId: string | null;
};

export function decayedWeight(tag: ScoringTag, now: Date): number {
  const daysSinceTag = (now.getTime() - tag.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const halfLife = HALF_LIFE_DAYS[tag.kind];
  return tag.weight * Math.exp(-daysSinceTag / halfLife);
}

// DECISION (logged for periodic review, see CHANGELOG.md): DATA_MODEL.md
// defines two score buckets (day/night) but Tag.time_of_day has three
// values (day/evening/night). "Evening" tags are counted toward the
// night bucket, since dusk is when the walking-at-night use case starts
// to apply — not an explicit spec answer, a judgment call.
export function bucketMatches(bucket: Bucket, timeOfDay: ScoringTag["timeOfDay"]): boolean {
  if (bucket === "day") return timeOfDay === "day";
  return timeOfDay === "evening" || timeOfDay === "night";
}

export function computeBand(weightedSum: number, totalWeight: number): Band {
  if (totalWeight < MIN_WEIGHTED_TAG_COUNT) return "unrated";
  const average = weightedSum / totalWeight;
  if (average >= 1 / 3) return "lit_safe";
  if (average <= -1 / 3) return "avoid";
  return "caution";
}

export function aggregateBucket(allTags: ScoringTag[], bucket: Bucket, now: Date): Band {
  const relevant = allTags.filter(
    (tag) => tag.status !== "removed" && bucketMatches(bucket, tag.timeOfDay)
  );

  let weightedSum = 0;
  let totalWeight = 0;
  for (const tag of relevant) {
    const w = decayedWeight(tag, now);
    weightedSum += SAFETY_FEELING_VALUE[tag.safetyFeeling] * w;
    totalWeight += w;
  }

  return computeBand(weightedSum, totalWeight);
}

export type StabilityWindowResult = {
  committedBand: Band;
  pendingBand: Band | null;
  pendingSince: Date | null;
  justCommitted: boolean;
};

/**
 * Applies the stability-window commit rule: a freshly computed band only
 * overwrites the segment's public band once it has been the pending
 * value for >=48h. Returns the fields to persist.
 */
export function applyStabilityWindow(
  computedBand: Band,
  committedBand: Band,
  pendingBand: Band | null,
  pendingSince: Date | null,
  now: Date
): StabilityWindowResult {
  if (computedBand === committedBand) {
    // Stable at the current public value — clear any in-flight pending change.
    return { committedBand, pendingBand: null, pendingSince: null, justCommitted: false };
  }

  if (computedBand === pendingBand && pendingSince) {
    const stableFor = now.getTime() - pendingSince.getTime();
    if (stableFor >= STABILITY_WINDOW_MS) {
      // Held stable for the full window — commit it.
      return {
        committedBand: computedBand,
        pendingBand: null,
        pendingSince: null,
        justCommitted: true,
      };
    }
    // Still within the window — keep waiting.
    return { committedBand, pendingBand, pendingSince, justCommitted: false };
  }

  // A new candidate band — start (or restart) the stability clock.
  return { committedBand, pendingBand: computedBand, pendingSince: now, justCommitted: false };
}

const BAND_MATCHING_FEELING: Record<"lit_safe" | "caution" | "avoid", "safe" | "caution" | "avoid"> = {
  lit_safe: "safe",
  caution: "caution",
  avoid: "avoid",
};

export function corroboratingContributorIds(
  allTags: ScoringTag[],
  bucket: Bucket,
  committedBand: Band
): string[] {
  if (committedBand === "unrated") return [];
  const matchingFeeling = BAND_MATCHING_FEELING[committedBand];
  return allTags
    .filter(
      (tag) =>
        tag.status !== "removed" &&
        bucketMatches(bucket, tag.timeOfDay) &&
        tag.safetyFeeling === matchingFeeling &&
        tag.contributorId !== null
    )
    .map((tag) => tag.contributorId as string);
}
