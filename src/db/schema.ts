import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  bigserial,
  timestamp,
  pgEnum,
  customType,
} from "drizzle-orm/pg-core";

// Requires the PostGIS extension enabled on the database
// (Supabase: Database > Extensions > postgis).
const geometry = customType<{ data: string }>({
  dataType() {
    return "geometry(LineString, 4326)";
  },
});

export const scoreBandEnum = pgEnum("score_band", [
  "lit_safe",
  "caution",
  "avoid",
  "unrated",
]);

export const timeOfDayEnum = pgEnum("time_of_day", ["day", "evening", "night"]);
export const lightingEnum = pgEnum("lighting", ["lit", "dim", "dark"]);
export const safetyFeelingEnum = pgEnum("safety_feeling", [
  "safe",
  "caution",
  "avoid",
]);
export const tagCategoryEnum = pgEnum("tag_category", [
  "harassment",
  "no_sidewalk",
  "flooding",
  "animals",
  "no_transport_available",
  "other",
]);
export const tagStatusEnum = pgEnum("tag_status", [
  "active",
  "under_review",
  "removed",
]);
export const flagReasonEnum = pgEnum("flag_reason", [
  "inaccurate",
  "spam",
  "hate_or_profiling",
  "duplicate",
]);
export const flagResolutionEnum = pgEnum("flag_resolution", [
  "pending",
  "upheld",
  "dismissed",
]);

// DATA_MODEL.md decay half-life varies by tag kind: standard (45d),
// static lighting-infrastructure reports (180d), and Phase 2's "lit
// tonight" real-time reports (1d, expire by morning).
export const tagKindEnum = pgEnum("tag_kind", [
  "standard",
  "infrastructure",
  "lit_tonight",
]);

// Per DATA_MODEL.md — tag at the street-segment level (an OSM way, or a
// sub-split of one), seeded from OSM ways in the launch bbox.
export const segments = pgTable("segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  osmWayId: text("osm_way_id").notNull(),
  geometry: geometry("geometry").notNull(),
  name: text("name"),
  neighborhood: text("neighborhood"),
  dayScore: scoreBandEnum("day_score").notNull().default("unrated"),
  nightScore: scoreBandEnum("night_score").notNull().default("unrated"),
  tagCount: integer("tag_count").notNull().default(0),
  lastTaggedAt: timestamp("last_tagged_at", { withTimezone: true }),

  // DATA_MODEL.md status-flip rule: "a segment's band only changes when
  // the new aggregate has been stable across >=2 recalculation cycles
  // (e.g. 48 hours apart)". These track a computed-but-not-yet-committed
  // band per bucket until it holds for the stability window.
  pendingDayScore: scoreBandEnum("pending_day_score"),
  pendingDayScoreSince: timestamp("pending_day_score_since", { withTimezone: true }),
  pendingNightScore: scoreBandEnum("pending_night_score"),
  pendingNightScoreSince: timestamp("pending_night_score_since", { withTimezone: true }),

  // Phase 3 pgRouting: stable bigint join key referenced by
  // segments_noded.old_id (scripts/002_enable_pgrouting_topology.sql).
  // The actual routable graph (source/target/topology) lives in the
  // separate segments_noded table, not here — pgr_nodeNetwork splits
  // ways at real intersection points, which a plain source/target pair
  // on the original un-split geometry can't represent (see the 2026-07-13
  // correction note in that script for why).
  routingId: bigserial("routing_id", { mode: "number" }),
});

// Contributor is optional — anonymous-by-default (see DO_NOT.md: no handle
// derivable from a real name/phone/account by default).
export const contributors = pgTable("contributors", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayHandle: text("display_handle").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  tagCount: integer("tag_count").notNull().default(0),
  trustScore: real("trust_score").notNull().default(0),

  // Phase 2 (MVP_SCOPE.md): streaks/badges belong to the contribution
  // flow only — DO_NOT.md: never gamify someone else's reported danger.
  currentStreakDays: integer("current_streak_days").notNull().default(0),
  longestStreakDays: integer("longest_streak_days").notNull().default(0),
  lastContributionAt: timestamp("last_contribution_at", { withTimezone: true }),
  badges: text("badges").array().notNull().default([]),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  segmentId: uuid("segment_id")
    .notNull()
    .references(() => segments.id),
  contributorId: uuid("contributor_id").references(() => contributors.id),
  // Opaque client-generated token (src/lib/device-id.ts) — used for rate
  // limiting and duplicate-burst detection only. Never a real identifier
  // (DO_NOT.md: no handle derivable from a real name/phone/account).
  deviceId: text("device_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  timeOfDay: timeOfDayEnum("time_of_day").notNull(),
  lighting: lightingEnum("lighting").notNull(),
  safetyFeeling: safetyFeelingEnum("safety_feeling").notNull(),
  category: tagCategoryEnum("category"),
  note: text("note"), // max ~280 chars, enforced at the API boundary
  kind: tagKindEnum("kind").notNull().default("standard"),
  // Base multiplier before time-decay (e.g. lowered for a low-trust
  // contributor); the exp(-days/half_life) decay factor itself is
  // computed live at aggregation time in src/lib/scoring.ts, never
  // stored, so it can't go stale.
  weight: real("weight").notNull().default(1),
  flaggedCount: integer("flagged_count").notNull().default(0),
  status: tagStatusEnum("status").notNull().default("active"),

  // Phase 2 (MVP_SCOPE.md): partner-seed bulk import, "tagged with a
  // seed_source field distinct from organic tags".
  seedSource: text("seed_source"),
});

export const moderationFlags = pgTable("moderation_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id),
  flaggedBy: uuid("flagged_by").references(() => contributors.id),
  reason: flagReasonEnum("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolution: flagResolutionEnum("resolution").notNull().default("pending"),
});

// Phase 3 (MVP_SCOPE.md): "B2B/B2G data export for partners (aggregated,
// de-identified only)". A key gates access to the aggregated export
// endpoint — never the raw tags/tag table.
export const partnerApiKeys = pgTable("partner_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerName: text("partner_name").notNull(),
  hashedKey: text("hashed_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
