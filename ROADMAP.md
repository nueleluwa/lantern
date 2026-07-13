# Roadmap

Status of each MVP_SCOPE.md phase, kept in sync with what's actually in the repo. Update this file whenever a checklist item's real-world status changes — it's the source of truth for "is X actually done," not the commit history.

## Phase 1 — Passive overlay

| Item | Status |
| --- | --- |
| OSM base map, night palette, config-driven bbox | Built and **live-verified** against real Port Harcourt data (1171 segments seeded). Style is now real OpenStreetMap raster tiles (was a blank placeholder — MapLibre's demo style had no coverage for this location) — still not the authored dark vector style `DESIGN_SYSTEM.md` requires |
| Segment model + PostGIS storage, seeded from OSM ways | Built and **live-verified** (`scripts/seed-osm-ways.ts`) against a provisioned Supabase project. Found and fixed: excluding primary/trunk roads as "not pedestrian relevant" fragmented the routing graph into 100+ disconnected islands — broadened the filter |
| Tag submission flow (anonymous) | Built |
| Aggregate scoring (day/night, decay-weighted) | Built (`src/lib/scoring.ts`) |
| Segment detail bottom sheet | Built |
| Basic flagging + simple admin table | Built (`/moderation`) |
| Day/night toggle | Built |

**Not launch-ready yet:** real bbox coordinates for the actual launch neighborhood (`src/config/launch-area.ts` still has placeholder coordinates), and the authored dark map style.

## Phase 2 — Fast follow

| Item | Status |
| --- | --- |
| Partner-seed import tool | Built (`scripts/import-partner-seed.ts`) |
| Contributor accounts, streaks, badges | Built — cookie-based, no email/password |
| "Lit tonight" short-half-life tags | Built |
| Share-to-WhatsApp | Built |
| Proper moderator admin UI | Built — still behind a placeholder shared-secret gate, not real moderator roles (see Open questions below) |

## Phase 3 — Later

| Item | Status |
| --- | --- |
| Route suggestion (prefers higher-scored segments, not a strict router) | Built and **live-verified end-to-end**, including a properly connected routing graph (root-caused and fixed the fragmentation — see `CHANGELOG.md`: raw OSM ways pass through unsplit intersections, needed `pgr_nodeNetwork()` to split edges at real crossing points before building topology). Largest connected component now covers 1853/1946 nodes (95%), up from 82/1806 (~5%) before the fix. |
| Live share / walk-with-me | Built — Redis-only, ephemeral. **Not yet live-tested** (Upstash was provisioned after this was last checked) |
| B2B/B2G aggregated data export | Built, API-key gated. **Not yet live-tested** |
| Expansion beyond launch geography | Config supports multiple areas; only one is populated |

## Open questions (unresolved — do not silently assume an answer)

- **Who moderates?** PRD.md never answers this (Lantern staff vs. a delegated community lead like the Chidinma persona). `/moderation` currently uses a single shared `ADMIN_SECRET` — fine for one operator, wrong for a team. Revisit before onboarding more than one moderator.
- **Real launch neighborhood bbox.** `src/config/launch-area.ts` has placeholder coordinates. Needs the actual Port Harcourt neighborhood/campus decided in `PROJECT.md`'s "Geography for launch."
- **Authored map style.** Now plain OpenStreetMap raster tiles (real data, but unstyled). `DESIGN_SYSTEM.md` requires a real dark vector style (self-hosted OpenMapTiles + Maputnik, or a reskinned open dark base).
- ~~**Routing graph connectivity.**~~ Resolved — see CHANGELOG.md. Root cause was pgr_createTopology running on un-split OSM ways; fixed with pgr_nodeNetwork(). 21 components remain (down from 667), the largest covering 95% of nodes — the rest are most likely genuine dead-ends/cul-de-sacs or real OSM coverage gaps at the bbox edge, not a code bug, but not re-verified in detail.

## Decisions made without an explicit spec answer (logged for review)

These were genuine gaps in the docs, resolved with a judgment call rather than blocking the build. Revisit any of them if they turn out wrong in practice — see `CHANGELOG.md` for the full reasoning at the time each was made.

- "Evening" tags count toward the **night** score bucket (DATA_MODEL.md only defines day/night; Tag.time_of_day has three values).
- Trust-score corroboration bonus is a flat +0.1 per commit event (direction was specified — "rises with corroborated tags" — magnitude was not).
- Moderator auth is a single shared secret (`ADMIN_SECRET`), not real accounts/roles.
- Route cost multipliers (lit_safe=1, caution=2, avoid=5, unrated=1.5) are a starting point, not a tuned value — revisit once there's real usage data.
- Live-share position updates every 15s client-side, 3-minute Redis TTL, 4-hour session ceiling — reasonable defaults, not spec'd anywhere.

## Live infrastructure (provisioned 2026-07-13)

- Supabase project `lantern` (ref `hjaiivmybvfawtjtdfun`, eu-west-2), `postgis` + `pgrouting` enabled, schema migrated, 1171 segments seeded from real Port Harcourt OSM data, routing topology built.
- Upstash Redis database `lantern` provisioned, eviction enabled (all our keys are short-TTL cache/ephemeral state — Postgres is the only durable store, so evict-on-pressure is safer than reject-on-pressure here).
- `CRON_SECRET` / `ADMIN_SECRET` generated and set locally in `.env` (not committed).
- Not yet done: Vercel project/deployment. Everything above has only been run against a local dev server pointed at the live Supabase/Upstash instances.

## Before this can actually launch

1. Pick and name the real launch neighborhood (the seeded bbox sits on real Port Harcourt streets already, but was never deliberately chosen — still says `"TODO: name the launch neighborhood"`).
2. Author the real dark map style per `DESIGN_SYSTEM.md` (currently plain OSM raster tiles).
3. Decide real moderator identity/roles and replace the shared-secret gate.
4. Deploy to Vercel and confirm the cron job actually fires on schedule against the live project.
5. Live-test live-share and B2B export against the now-live Redis/Supabase (built, never exercised).
