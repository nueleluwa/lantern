-- Run once against the Supabase database before the first drizzle migration.
-- (Supabase also lets you toggle the postgis extension on from
-- Database > Extensions, which does the same thing as line 1.)

create extension if not exists postgis;

-- ARCHITECTURE.md: "every Segment.geometry column needs a GiST index —
-- bbox queries against an unindexed geometry column will degrade fast
-- well before Phase 1's target scale is reached."
create index if not exists segments_geometry_gist
  on segments
  using gist (geometry);
