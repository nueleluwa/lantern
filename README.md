# Lantern

Crowdsourced safe-route mapper for people walking at night in Nigerian cities, launching in Port Harcourt. A community-reported lighting/safety overlay on OpenStreetMap — not a router that guarantees safety (see `DO_NOT.md`).

**Live:** <https://lantern-blue.vercel.app> (see `ROADMAP.md` for what's real vs. still placeholder before this is launch-ready).

Full product/architecture docs live in this directory: `PROJECT.md`, `DO_NOT.md`, `PRD.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `MVP_SCOPE.md`. **Read `DO_NOT.md` before touching moderation, scoring, or location-handling code** — its constraints override convenience every time. See `CONTRIBUTING.md` for the recommended reading order, `ROADMAP.md` for what's real vs. placeholder right now, and **[`docs/API.md`](docs/API.md) for the full API reference** (every endpoint, request/response shapes, auth, rate limits).

## Stack

- Next.js (App Router) — deployed on Vercel
- MapLibre GL JS for the map
- Supabase Postgres with PostGIS + pgRouting enabled — segments, tags, routing topology
- Upstash Redis — bbox/segment read cache, live-share ephemeral state
- Drizzle ORM (`postgres-js` driver)
- Vercel Cron Jobs — daily score recalculation (Vercel Hobby plan only supports daily cron; see `ROADMAP.md`)

## What's built

All three `MVP_SCOPE.md` phases have a working implementation — see `ROADMAP.md` for the honest per-item status and what's still a placeholder (map style, launch-area bbox, moderator auth) versus load-bearing and real.

- **Phase 1:** base map, segment model, anonymous tag submission, decay-weighted scoring engine with a 48h stability window before a band publicly flips, flagging + simple moderation, day/night toggle.
- **Phase 2:** optional contributor accounts with streaks/badges, partner-seed bulk import, "lit tonight" real-time lighting tags, share-to-WhatsApp, upgraded moderation UI.
- **Phase 3:** route suggestion that prefers higher-scored segments (pgRouting, not a strict safest-route router — persistent in-UI disclaimer per `DO_NOT.md`), ephemeral live-share/walk-with-me, aggregated B2B/B2G data export, multi-area config support.

## Setup

1. Create a Supabase project. Enable the `postgis` and `pgrouting` extensions (Database > Extensions), and copy the connection string into `.env` as `DATABASE_URL`.
2. Run the migration SQL against that database once, in order (Supabase SQL editor or `psql`):
   - `scripts/001_enable_postgis_and_indexes.sql`
   - `scripts/002_enable_pgrouting_topology.sql` (re-run after any bulk segment import to rebuild routing topology)
3. Create an Upstash Redis database, copy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` into `.env`.
4. Set `CRON_SECRET` in `.env` and in Vercel's project environment variables (Vercel sends it as the cron request's `Authorization: Bearer` header automatically once the env var exists).
5. Set `ADMIN_SECRET` in `.env` — gates `/moderation` and its APIs. This is a placeholder single-operator gate, not real moderator accounts (see `ROADMAP.md` open questions).
6. `npm install`
7. `npm run db:generate && npm run db:migrate` — applies the Drizzle schema.
8. Edit `src/config/launch-area.ts` — replace the placeholder bbox with the real launch neighborhood's bounds.
9. `npm run seed:osm-ways` — pulls walkable OSM ways for that bbox from Overpass and inserts them as segments.
10. `npm run dev`.

### Optional: partner data seeding and B2B export

```bash
npm run seed:partner -- --file ./partner-data.csv --source "GRA Women's Safety Group"
npm run partner:create-key -- --name "UNIPORT Safety Office"
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build — **always run this, not just `typecheck`**, before considering a change done (see `CHANGELOG.md`'s 2026-07-13 entry for why) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle schema management |
| `npm run seed:osm-ways` | Seed segments from OSM ways in the configured launch bbox |
| `npm run seed:partner` | Bulk-import partner CSV/GeoJSON tags |
| `npm run partner:create-key` | Issue a hashed B2B export API key |

## What's still placeholder (not launch-ready)

See `ROADMAP.md` for the full, kept-current list. In short: the map style is plain OpenStreetMap raster tiles (needs real Maputnik dark-vector authoring per `DESIGN_SYSTEM.md`), the launch-area bbox is a placeholder, and moderator auth is a single shared secret.
