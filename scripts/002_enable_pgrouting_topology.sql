-- Phase 3 (MVP_SCOPE.md): "Route suggestion that prefers higher-scored
-- segments (explicitly not a strict 'safest route' router)". Run once
-- against the Supabase database, and again after any bulk segment
-- import (OSM reseed / partner seed) to rebuild topology.
--
-- pgRouting ships as a Supabase-supported extension but isn't always
-- pre-enabled — toggle it on in Database > Extensions if this fails, or
-- run as the postgres role.
--
-- CORRECTED 2026-07-13: the first version of this script ran
-- pgr_createTopology directly on the raw `segments` table, which only
-- snaps a way's declared start/end points to other ways' start/end
-- points. Real OSM ways routinely pass straight *through* an
-- intersection without being split there (a through-street continues
-- past a T-junction as one continuous way), so a crossing street's
-- endpoint lands in the middle of that line, not at a shared vertex.
-- Live-tested against 1171 real Port Harcourt segments: this produced
-- 667 disconnected components, 513 of them a single isolated edge
-- (confirmed 1160/1171 segments geometrically cross another line
-- somewhere that isn't a declared endpoint). pgr_nodeNetwork() is
-- pgRouting's purpose-built fix — it splits edges at every actual
-- intersection point first, into a new `segments_noded` table, which
-- is what topology and routing must run against instead.

create extension if not exists pgrouting;

alter table segments add column if not exists routing_id bigserial;
create index if not exists segments_routing_id_idx on segments (routing_id);

-- Drop the no-longer-used direct source/target from segments — the
-- routable graph now lives in segments_noded (below), joined back to
-- segments via old_id = routing_id for cost lookups and to resolve
-- which tagged street a routed sub-edge belongs to.
alter table segments drop column if exists source;
alter table segments drop column if exists target;

drop table if exists segments_noded;
select pgr_nodeNetwork('segments', 0.00001, 'routing_id', 'geometry');

alter table segments_noded add column if not exists source bigint;
alter table segments_noded add column if not exists target bigint;
create index if not exists segments_noded_old_id_idx on segments_noded (old_id);

select pgr_createTopology('segments_noded', 0.00001, 'geometry', 'id');
