import {
  pgTable,
  uuid,
  text,
  integer,
  real,
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
});

// Contributor is optional — anonymous-by-default (see DO_NOT.md: no handle
// derivable from a real name/phone/account by default).
export const contributors = pgTable("contributors", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayHandle: text("display_handle").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  tagCount: integer("tag_count").notNull().default(0),
  trustScore: real("trust_score").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  segmentId: uuid("segment_id")
    .notNull()
    .references(() => segments.id),
  contributorId: uuid("contributor_id").references(() => contributors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  timeOfDay: timeOfDayEnum("time_of_day").notNull(),
  lighting: lightingEnum("lighting").notNull(),
  safetyFeeling: safetyFeelingEnum("safety_feeling").notNull(),
  category: tagCategoryEnum("category"),
  note: text("note"), // max ~280 chars, enforced at the API boundary
  weight: real("weight").notNull().default(1),
  flaggedCount: integer("flagged_count").notNull().default(0),
  status: tagStatusEnum("status").notNull().default("active"),
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
