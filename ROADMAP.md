# Roadmap

Status of each MVP_SCOPE.md phase, kept in sync with what's actually in the repo. Update this file whenever a checklist item's real-world status changes — it's the source of truth for "is X actually done," not the commit history.

## Phase 1 — Passive overlay

| Item | Status |
| --- | --- |
| OSM base map, night palette, config-driven bbox | Built — style is a **placeholder** (MapLibre demo style), needs real Maputnik authoring per `DESIGN_SYSTEM.md` before launch |
| Segment model + PostGIS storage, seeded from OSM ways | Built (`scripts/seed-osm-ways.ts`) |
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
| Route suggestion (prefers higher-scored segments, not a strict router) | Built (pgRouting) — **needs load-testing and a live Supabase+pgRouting instance to validate**; never built/tested against a real database in this repo's history |
| Live share / walk-with-me | Built — Redis-only, ephemeral |
| B2B/B2G aggregated data export | Built, API-key gated |
| Expansion beyond launch geography | Config supports multiple areas; only one is populated |

## Open questions (unresolved — do not silently assume an answer)

- **Who moderates?** PRD.md never answers this (Lantern staff vs. a delegated community lead like the Chidinma persona). `/moderation` currently uses a single shared `ADMIN_SECRET` — fine for one operator, wrong for a team. Revisit before onboarding more than one moderator.
- **Real launch neighborhood bbox.** `src/config/launch-area.ts` has placeholder coordinates. Needs the actual Port Harcourt neighborhood/campus decided in `PROJECT.md`'s "Geography for launch."
- **Authored map style.** Still MapLibre's public demo style. `DESIGN_SYSTEM.md` requires a real dark vector style (self-hosted OpenMapTiles + Maputnik, or a reskinned open dark base).

## Decisions made without an explicit spec answer (logged for review)

These were genuine gaps in the docs, resolved with a judgment call rather than blocking the build. Revisit any of them if they turn out wrong in practice — see `CHANGELOG.md` for the full reasoning at the time each was made.

- "Evening" tags count toward the **night** score bucket (DATA_MODEL.md only defines day/night; Tag.time_of_day has three values).
- Trust-score corroboration bonus is a flat +0.1 per commit event (direction was specified — "rises with corroborated tags" — magnitude was not).
- Moderator auth is a single shared secret (`ADMIN_SECRET`), not real accounts/roles.
- Route cost multipliers (lit_safe=1, caution=2, avoid=5, unrated=1.5) are a starting point, not a tuned value — revisit once there's real usage data.
- Live-share position updates every 15s client-side, 3-minute Redis TTL, 4-hour session ceiling — reasonable defaults, not spec'd anywhere.

## Before this can actually launch

1. Pick and configure the real launch neighborhood bbox.
2. Author the real dark map style per `DESIGN_SYSTEM.md`.
3. Provision the real Supabase project (enable `postgis` + `pgrouting`), run both SQL scripts in `scripts/`, run the OSM seed script.
4. Decide real moderator identity/roles and replace the shared-secret gate.
5. Load-test the routing endpoint against a real pgRouting topology — it has not been exercised against a live database in this repo.
