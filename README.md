# Lantern

Crowdsourced night-walking safety overlay, launching in Port Harcourt. See the project docs in this directory (`PROJECT.md`, `DO_NOT.md`, `PRD.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `MVP_SCOPE.md`) for the full spec — read `DO_NOT.md` before touching moderation, scoring, or location-handling code.

## Stack

- Next.js (App Router) — deployed on Vercel
- MapLibre GL JS for the map
- Supabase Postgres with PostGIS enabled — segment/tag storage
- Upstash Redis — bbox/segment read cache
- Drizzle ORM (`postgres-js` driver)
- Vercel Cron Jobs — score recalculation (`vercel.json` → `/api/cron/recalculate`, hourly)

## Setup

1. Create a Supabase project, enable the `postgis` extension (Database > Extensions), and copy the connection string into `.env` as `DATABASE_URL`.
2. Run `scripts/001_enable_postgis_and_indexes.sql` against that database once (Supabase SQL editor or `psql`) — enables PostGIS and creates the GiST index `ARCHITECTURE.md` calls a hard schema requirement.
3. Create an Upstash Redis database, copy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` into `.env`.
4. Set `CRON_SECRET` in `.env` and in the Vercel project's environment variables (Vercel sets the `Authorization: Bearer $CRON_SECRET` header on cron invocations automatically once this env var exists).
5. `npm install`
6. `npm run db:generate && npm run db:migrate` — applies the Drizzle schema.
7. Edit `src/config/launch-area.ts` — replace the placeholder bbox with the real launch neighborhood's bounds.
8. `npm run seed:osm-ways` — pulls walkable OSM ways for that bbox from Overpass and inserts them as segments.
9. `npm run dev`.

## What's built vs. what's a deliberate stopping point

Built (Phase 1, MVP_SCOPE.md steps 1–2, "base map + segment model"):
- Project scaffold, schema (`src/db/schema.ts`) matching `DATA_MODEL.md` exactly
- OSM way seeding script
- `GET /api/segments` — bbox-filtered read of already-stored segment bands, Redis-cached per `ARCHITECTURE.md` §2
- Map view with day/night toggle, band color + line-weight/dash encoding per `DESIGN_SYSTEM.md`, loading skeleton state

Deliberately **not** built yet — stopped here to check in, since these are the DO_NOT.md-flagged areas (moderation logic, scoring that decides a segment's public status):
- Tag submission (`POST /segments/:id/tags`)
- The decay-weighted scoring algorithm and 48h stability-window status-flip rule (`DATA_MODEL.md` "Scoring algorithm") — `/api/cron/recalculate` is stubbed and returns 501
- Flagging (`POST /tags/:id/flag`) and the moderation queue/admin table
- Segment detail bottom sheet UI

Also still placeholder, not production-ready:
- `src/styles/map-style.ts` points at MapLibre's public demo style. `DESIGN_SYSTEM.md` requires an authored dark vector style (self-hosted OpenMapTiles + Maputnik, or a reskinned open dark base style) — this still needs real design work, not just a config swap.
- `src/config/launch-area.ts` bbox is a placeholder — needs the real launch neighborhood's coordinates.
