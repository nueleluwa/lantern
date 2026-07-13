-- Phase 3 (MVP_SCOPE.md): "Route suggestion that prefers higher-scored
-- segments (explicitly not a strict 'safest route' router)". Run once
-- against the Supabase database, and again after any bulk segment
-- import (OSM reseed / partner seed) to rebuild topology.
--
-- pgRouting ships as a Supabase-supported extension but isn't always
-- pre-enabled — toggle it on in Database > Extensions if this fails, or
-- run as the postgres role.

create extension if not exists pgrouting;

-- pgr_createTopology needs bigint source/target columns on the edge
-- table plus a bigint-ish "id" it can key internally; our primary key is
-- uuid; routing_id is a parallel bigserial used only for pgRouting calls.
alter table segments add column if not exists routing_id bigserial;
alter table segments add column if not exists source bigint;
alter table segments add column if not exists target bigint;

create index if not exists segments_routing_id_idx on segments (routing_id);

-- Snaps segment endpoints within ~1m (0.00001 deg) into shared routing
-- nodes so pgr_dijkstra can traverse between adjacent segments.
select pgr_createTopology('segments', 0.00001, 'geometry', 'routing_id');
