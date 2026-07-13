CREATE TYPE "public"."flag_reason" AS ENUM('inaccurate', 'spam', 'hate_or_profiling', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."flag_resolution" AS ENUM('pending', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."lighting" AS ENUM('lit', 'dim', 'dark');--> statement-breakpoint
CREATE TYPE "public"."safety_feeling" AS ENUM('safe', 'caution', 'avoid');--> statement-breakpoint
CREATE TYPE "public"."score_band" AS ENUM('lit_safe', 'caution', 'avoid', 'unrated');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('harassment', 'no_sidewalk', 'flooding', 'animals', 'no_transport_available', 'other');--> statement-breakpoint
CREATE TYPE "public"."tag_kind" AS ENUM('standard', 'infrastructure', 'lit_tonight');--> statement-breakpoint
CREATE TYPE "public"."tag_status" AS ENUM('active', 'under_review', 'removed');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('day', 'evening', 'night');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_handle" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tag_count" integer DEFAULT 0 NOT NULL,
	"trust_score" real DEFAULT 0 NOT NULL,
	"current_streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_contribution_at" timestamp with time zone,
	"badges" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"flagged_by" uuid,
	"reason" "flag_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" "flag_resolution" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_name" text NOT NULL,
	"hashed_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"osm_way_id" text NOT NULL,
	"geometry" geometry(LineString, 4326) NOT NULL,
	"name" text,
	"neighborhood" text,
	"day_score" "score_band" DEFAULT 'unrated' NOT NULL,
	"night_score" "score_band" DEFAULT 'unrated' NOT NULL,
	"tag_count" integer DEFAULT 0 NOT NULL,
	"last_tagged_at" timestamp with time zone,
	"pending_day_score" "score_band",
	"pending_day_score_since" timestamp with time zone,
	"pending_night_score" "score_band",
	"pending_night_score_since" timestamp with time zone,
	"routing_id" bigserial NOT NULL,
	"source" bigint,
	"target" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"contributor_id" uuid,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_of_day" time_of_day NOT NULL,
	"lighting" "lighting" NOT NULL,
	"safety_feeling" "safety_feeling" NOT NULL,
	"category" "tag_category",
	"note" text,
	"kind" "tag_kind" DEFAULT 'standard' NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"flagged_count" integer DEFAULT 0 NOT NULL,
	"status" "tag_status" DEFAULT 'active' NOT NULL,
	"seed_source" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_flagged_by_contributors_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."contributors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tags" ADD CONSTRAINT "tags_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tags" ADD CONSTRAINT "tags_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
