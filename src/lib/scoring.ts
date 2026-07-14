import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { segments, tags } from "@/db/schema";
import { bumpTrustForCorroboratedContributors } from "./contributor-progress";
import {
  type Band,
  type Bucket,
  type ScoringTag,
  aggregateBucket,
  applyStabilityWindow,
  computeBand,
  corroboratingContributorIds,
} from "./scoring-logic";

export async function recalculateSegment(segmentId: string, now = new Date()) {
  // Independent queries — audit-project review found these awaited
  // sequentially even though neither depends on the other's result.
  const [[segment], segmentTags] = await Promise.all([
    db.select().from(segments).where(eq(segments.id, segmentId)),
    db
      .select({
        createdAt: tags.createdAt,
        timeOfDay: tags.timeOfDay,
        safetyFeeling: tags.safetyFeeling,
        kind: tags.kind,
        weight: tags.weight,
        status: tags.status,
        contributorId: tags.contributorId,
      })
      .from(tags)
      .where(and(eq(tags.segmentId, segmentId), ne(tags.status, "removed"))),
  ]);
  if (!segment) return;

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

  if (day.justCommitted) {
    await bumpTrustForCorroboratedContributors(
      corroboratingContributorIds(segmentTags, "day", day.committedBand)
    );
  }
  if (night.justCommitted) {
    await bumpTrustForCorroboratedContributors(
      corroboratingContributorIds(segmentTags, "night", night.committedBand)
    );
  }
}

// SQL equivalent of decayedWeight/SAFETY_FEELING_VALUE, computed in one
// aggregate query instead of fetched-then-summed in JS per segment.
// audit-project review flagged the original per-segment loop (up to 5
// sequential round trips each) as a real cron-timeout risk once segment
// count grows past a few hundred — this replaces the whole "select
// segment, select its tags" N+1 pattern with a handful of queries total,
// regardless of how many segments exist.
const DECAY_SQL = `weight * exp(-(extract(epoch from (now() - created_at)) / 86400) / (case kind when 'infrastructure' then 180 when 'lit_tonight' then 1 else 45 end))`;
const FEELING_VALUE_SQL = `(case safety_feeling when 'safe' then 1 when 'avoid' then -1 else 0 end)`;

type SegmentAggregate = {
  id: string;
  dayScore: Band;
  nightScore: Band;
  pendingDayScore: Band | null;
  pendingDayScoreSince: Date | null;
  pendingNightScore: Band | null;
  pendingNightScoreSince: Date | null;
  dayWeightedSum: number;
  dayTotalWeight: number;
  nightWeightedSum: number;
  nightTotalWeight: number;
};

/**
 * ARCHITECTURE.md §3: "Runs on tag write and on a rolling schedule (e.g.
 * hourly) to handle pure time-decay even with no new tags."
 */
export async function recalculateAllSegments(now = new Date()) {
  const rows = await db.execute<SegmentAggregate>(sql`
    select
      s.id,
      s.day_score as "dayScore",
      s.night_score as "nightScore",
      s.pending_day_score as "pendingDayScore",
      s.pending_day_score_since as "pendingDayScoreSince",
      s.pending_night_score as "pendingNightScore",
      s.pending_night_score_since as "pendingNightScoreSince",
      coalesce(sum(case when t.time_of_day = 'day' then ${sql.raw(DECAY_SQL)} * ${sql.raw(FEELING_VALUE_SQL)} else 0 end), 0) as "dayWeightedSum",
      coalesce(sum(case when t.time_of_day = 'day' then ${sql.raw(DECAY_SQL)} else 0 end), 0) as "dayTotalWeight",
      coalesce(sum(case when t.time_of_day in ('evening', 'night') then ${sql.raw(DECAY_SQL)} * ${sql.raw(FEELING_VALUE_SQL)} else 0 end), 0) as "nightWeightedSum",
      coalesce(sum(case when t.time_of_day in ('evening', 'night') then ${sql.raw(DECAY_SQL)} else 0 end), 0) as "nightTotalWeight"
    from segments s
    left join tags t on t.segment_id = s.id and t.status != 'removed'
    group by s.id
  `);

  type UpdatePayload = {
    id: string;
    dayScore: Band;
    pendingDayScore: Band | null;
    pendingDayScoreSince: Date | null;
    nightScore: Band;
    pendingNightScore: Band | null;
    pendingNightScoreSince: Date | null;
  };
  const updates: UpdatePayload[] = [];
  const committedSegmentIds: { segmentId: string; bucket: Bucket; committedBand: Band }[] = [];

  for (const row of rows) {
    const dayComputed = computeBand(Number(row.dayWeightedSum), Number(row.dayTotalWeight));
    const nightComputed = computeBand(Number(row.nightWeightedSum), Number(row.nightTotalWeight));

    const day = applyStabilityWindow(
      dayComputed,
      row.dayScore,
      row.pendingDayScore,
      row.pendingDayScoreSince,
      now
    );
    const night = applyStabilityWindow(
      nightComputed,
      row.nightScore,
      row.pendingNightScore,
      row.pendingNightScoreSince,
      now
    );

    const unchanged =
      day.committedBand === row.dayScore &&
      day.pendingBand === row.pendingDayScore &&
      night.committedBand === row.nightScore &&
      night.pendingBand === row.pendingNightScore;
    if (unchanged) continue;

    updates.push({
      id: row.id,
      dayScore: day.committedBand,
      pendingDayScore: day.pendingBand,
      pendingDayScoreSince: day.pendingSince,
      nightScore: night.committedBand,
      pendingNightScore: night.pendingBand,
      pendingNightScoreSince: night.pendingSince,
    });

    if (day.justCommitted) committedSegmentIds.push({ segmentId: row.id, bucket: "day", committedBand: day.committedBand });
    if (night.justCommitted) committedSegmentIds.push({ segmentId: row.id, bucket: "night", committedBand: night.committedBand });
  }

  if (updates.length > 0) {
    // Single bulk UPDATE via VALUES list instead of one UPDATE per
    // segment — the other half of eliminating the N+1 pattern.
    const valuesSql = sql.join(
      updates.map(
        (u) => sql`(
          ${u.id}::uuid,
          ${u.dayScore}::score_band,
          ${u.pendingDayScore}::score_band,
          ${u.pendingDayScoreSince},
          ${u.nightScore}::score_band,
          ${u.pendingNightScore}::score_band,
          ${u.pendingNightScoreSince}
        )`
      ),
      sql`, `
    );

    await db.execute(sql`
      update segments as s
      set
        day_score = v.day_score,
        pending_day_score = v.pending_day_score,
        pending_day_score_since = v.pending_day_score_since,
        night_score = v.night_score,
        pending_night_score = v.pending_night_score,
        pending_night_score_since = v.pending_night_score_since
      from (values ${valuesSql}) as v(
        id, day_score, pending_day_score, pending_day_score_since,
        night_score, pending_night_score, pending_night_score_since
      )
      where s.id = v.id
    `);
  }

  // Corroboration trust bumps only need the raw tag rows for segments
  // that actually just committed a band this round — a small subset, not
  // every segment, so this stays a targeted query rather than reverting
  // to per-segment fetches.
  if (committedSegmentIds.length > 0) {
    const segmentIdsNeedingTags = Array.from(new Set(committedSegmentIds.map((c) => c.segmentId)));
    const tagRows = await db
      .select({
        segmentId: tags.segmentId,
        createdAt: tags.createdAt,
        timeOfDay: tags.timeOfDay,
        safetyFeeling: tags.safetyFeeling,
        kind: tags.kind,
        weight: tags.weight,
        status: tags.status,
        contributorId: tags.contributorId,
      })
      .from(tags)
      .where(and(inArray(tags.segmentId, segmentIdsNeedingTags), ne(tags.status, "removed")));

    const tagsBySegment = new Map<string, ScoringTag[]>();
    for (const t of tagRows) {
      const list = tagsBySegment.get(t.segmentId) ?? [];
      list.push(t);
      tagsBySegment.set(t.segmentId, list);
    }

    const allCorroborating: string[] = [];
    for (const { segmentId, bucket, committedBand } of committedSegmentIds) {
      const segmentTags = tagsBySegment.get(segmentId) ?? [];
      allCorroborating.push(...corroboratingContributorIds(segmentTags, bucket, committedBand));
    }
    await bumpTrustForCorroboratedContributors(allCorroborating);
  }

  return rows.length;
}
