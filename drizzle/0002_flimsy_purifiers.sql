CREATE INDEX IF NOT EXISTS "moderation_flags_tag_id_idx" ON "moderation_flags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moderation_flags_resolution_idx" ON "moderation_flags" USING btree ("resolution");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_segment_id_status_idx" ON "tags" USING btree ("segment_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_contributor_id_idx" ON "tags" USING btree ("contributor_id");--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_osm_way_id_unique" UNIQUE("osm_way_id");