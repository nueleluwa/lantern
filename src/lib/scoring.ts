import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "./db";
import { segments, tags } from "@/db/schema";

// DATA_MODEL.md "Scoring algorithm" — implemented as specified:
//   weight = base_weight * exp(-days_since_tag / half_life_days)
//   half_life_days = 45 default; 180 for static lighting-infrastructure
//   reports; 1 for "lit tonight" reports (expire by morning).
const HALF_LIFE_DAYS: Record<"standard" | "infrastructure" | "lit_tonight", number> = {
  standard: 45,
  infrastructure: 180,
  lit_tonight: 1,
};

// "Require a minimum weighted tag count (e.g. 3) before a segment leaves
// unrated."
const MIN_WEIGHTED_TAG_COUNT = 3;

// "a segment's band only changes when the new aggregate has been stable
// across >=2 recalculation cycles (e.g. 48 hours apart)"
const STABILITY_WINDOW_MS = 48 * 60 * 60 * 1000;

const SAFETY_FEELING_VALUE: Record<"safe" | "caution" | "avoid", number> = {
  safe: 1,
  caution: 0,
  avoid: -1,
};

type Band = "lit_safe" | "caution" | "avoid" | "unrated";
type Bucket = "day" | "night";

type ScoringTag = {
  createdAt: Date;
  timeOfDay: "day" | "evening" | "night";
  safetyFeeling: "safe" | "caution" | "avoid";
  kind: "standard" | "infrastructure" | "lit_tonight";
  weight: number;
  status: "active" | "under_review" | "removed";
};

function decayedWeight(tag: ScoringTag, now: Date): number {
  const daysSinceTag = (now.getTime() - tag.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const halfLife = HALF_LIFE_DAYS[tag.kind];
  return tag.weight * Math.exp(-daysSinceTag / halfLife);
}

// DECISION (logged for periodic review, see CHANGELOG.md): DATA_MODEL.md
// defines two score buckets (day/night) but Tag.time_of_day has three
// values (day/evening/night). "Evening" tags are counted toward the
// night bucket, since dusk is when the walking-at-night use case starts
// to apply — not an explicit spec answer, a judgment call.
function bucketMatches(bucket: Bucket, timeOfDay: ScoringTag["timeOfDay"]): boolean {
  if (bucket === "day") return timeOfDay === "day";
  return timeOfDay === "evening" || timeOfDay === "night";
}

function computeBand(weightedSum: number, totalWeight: number): Band {
  if (totalWeight < MIN_WEIGHTED_TAG_COUNT) return "unrated";
  const average = weightedSum / totalWeight;
  if (average >= 1 / 3) return "lit_safe";
  if (average <= -1 / 3) return "avoid";
  return "caution";
}

function aggregateBucket(allTags: ScoringTag[], bucket: Bucket, now: Date): Band {
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

/**
 * Applies the stability-window commit rule: a freshly computed band only
 * overwrites the segment's public band once it has been the pending
 * value for >=48h. Returns the fields to persist.
 */
function applyStabilityWindow(
  computedBand: Band,
  committedBand: Band,
  pendingBand: Band | null,
  pendingSince: Date | null,
  now: Date
) {
  if (computedBand === committedBand) {
    // Stable at the current public value — clear any in-flight pending change.
    return { committedBand, pendingBand: null, pendingSince: null };
  }

  if (computedBand === pendingBand && pendingSince) {
    const stableFor = now.getTime() - pendingSince.getTime();
    if (stableFor >= STABILITY_WINDOW_MS) {
      // Held stable for the full window — commit it.
      return { committedBand: computedBand, pendingBand: null, pendingSince: null };
    }
    // Still within the window — keep waiting.
    return { committedBand, pendingBand, pendingSince };
  }

  // A new candidate band — start (or restart) the stability clock.
  return { committedBand, pendingBand: computedBand, pendingSince: now };
}

export async function recalculateSegment(segmentId: string, now = new Date()) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, segmentId));
  if (!segment) return;

  const segmentTags = await db
    .select({
      createdAt: tags.createdAt,
      timeOfDay: tags.timeOfDay,
      safetyFeeling: tags.safetyFeeling,
      kind: tags.kind,
      weight: tags.weight,
      status: tags.status,
    })
    .from(tags)
    .where(and(eq(tags.segmentId, segmentId), ne(tags.status, "removed")));

  const dayComputed = aggregateBucket(segmentTags, "day", now);
  const nightComputed = aggregateBucket(segmentTags, "night", now);

  const day = applyStabilityWindow(
    dayComputed,
    segment.dayScore,
    segment.pendingDayScore,
    segment.pendingDayScoreSince,
    now
  );
  const night = applyStabilityWindow(
    nightComputed,
    segment.nightScore,
    segment.pendingNightScore,
    segment.pendingNightScoreSince,
    now
  );

  await db
    .update(segments)
    .set({
      dayScore: day.committedBand,
      pendingDayScore: day.pendingBand,
      pendingDayScoreSince: day.pendingSince,
      nightScore: night.committedBand,
      pendingNightScore: night.pendingBand,
      pendingNightScoreSince: night.pendingSince,
    })
    .where(eq(segments.id, segmentId));
}

/**
 * ARCHITECTURE.md §3: "Runs on tag write and on a rolling schedule (e.g.
 * hourly) to handle pure time-decay even with no new tags."
 *
 * NOTE: iterates segments one at a time (N+1 queries). Fine at Phase 1's
 * scale target (low thousands of segments, ARCHITECTURE.md §1) — revisit
 * with a single batched SQL aggregation if recalculation lag becomes
 * noticeable at higher volume (see ARCHITECTURE.md §4 scale table).
 */
export async function recalculateAllSegments(now = new Date()) {
  const rows = await db.select({ id: segments.id }).from(segments);
  for (const row of rows) {
    await recalculateSegment(row.id, now);
  }
  return rows.length;
}
