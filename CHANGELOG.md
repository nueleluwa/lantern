# Changelog

All notable changes to Lantern are logged here, including the reasoning behind decisions the project docs (`PROJECT.md`, `DO_NOT.md`, `PRD.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `MVP_SCOPE.md`) left ambiguous. Update this file alongside `ROADMAP.md` whenever a phase status changes or a new judgment call gets made.

## 2026-07-13

### Added — Phase 3 (later)
- Route suggestion via pgRouting (`pgr_dijkstra`), cost-weighted toward higher-scored segments. **Explicitly not a strict "safest route" router** (`DO_NOT.md`): it still routes through caution/avoid segments if that's the only path — refusing to route would itself imply a guarantee the tag data can't support.
- Persistent, non-dismissible routing disclaimer (`src/lib/route-disclaimer.ts`, rendered in `RouteSuggestion.tsx`) — `DO_NOT.md` requires this live in the routing UI itself, not a ToS page.
- Live share / walk-with-me: Redis-only, latest-position-only (never a trail), 4h session ceiling, 3-minute position TTL.
- B2B/B2G aggregated export endpoint, hashed-API-key gated — segment-level bands/counts only, never raw tags, notes, contributor ids, or device ids.
- Multi-area selector UI (hidden until a second launch area is configured).

### Fixed
- `RouteSuggestion.tsx` (client component) imported `ROUTE_DISCLAIMER` from `lib/routing.ts`, which also imports the server-only `postgres` driver — broke the production build (`net`/`tls`/`fs` unresolvable in the browser bundle). Split into `lib/route-disclaimer.ts` with no server dependencies. Only surfaced by `npm run build`, not `tsc --noEmit` — typecheck alone would have shipped this.

### Decisions logged
- Route cost multipliers (lit_safe=1, caution=2, avoid=5, unrated=1.5) are a starting point pending real usage data, not a tuned or spec'd value.
- Live-share cadence (15s client push, 3min Redis TTL, 4h ceiling) is a reasonable default, not spec'd anywhere in the docs.

### Added — Phase 2 (fast follow)
- Optional contributor accounts — cookie-based identity, no password/email, since an account only labels contribution history (`PROJECT.md`) and never gates anything sensitive.
- Streaks and badges ("Safety Scout" / "Neighborhood Watch" / "Lantern Keeper"), scoped strictly to the `contributors` table.
- `trust_score` now rises on corroboration and falls when a flag is upheld, per `DATA_MODEL.md`'s stated direction.
- `scripts/import-partner-seed.ts` — CSV/GeoJSON bulk import, tagged with `seed_source`, requires an existing `segment_id` per row (never whole-area bulk tagging, per `DO_NOT.md`).
- "Lit tonight" quick action using the `kind='lit_tonight'` 1-day-half-life path already built into the Phase 1 scoring engine.
- Share-to-WhatsApp via the Web Share API with a `wa.me` fallback.
- Moderation admin UI upgraded with resolved-history tabs and contributor trust context.

### Decisions logged
- DO_NOT.md: gamification (streaks/badges) touches only the `contributors` table — never a segment or tag's safety fields.
- Trust-score corroboration bonus: flat **+0.1** per commit event where a contributor's tag matches the newly committed band direction. `DATA_MODEL.md` specifies the direction ("rises with corroborated tags, falls with removed ones") but not the magnitude — this is a starting heuristic, not a tuned value.
- Moderator auth: a single shared secret (`ADMIN_SECRET` env var), checked in `src/lib/admin-auth.ts`. `PRD.md`'s open question ("Lantern staff, or a delegated community lead?") is still unanswered — this is the simplest thing that satisfies "moderator-only" for one operator, not a real accounts/roles system.

### Added — Phase 1 (passive overlay, MVP)
- Scoring engine (`src/lib/scoring.ts`): decay-weighted aggregate (`weight = base_weight * exp(-days/half_life)`), minimum-weighted-tag-count gate before a segment leaves `unrated`, 48h stability-window rule before a band publicly flips — all per `DATA_MODEL.md`'s algorithm.
- `POST /api/segments/:id/tags` — anonymous submission, per-device rate limiting (10/hour via Redis), recalculation deferred via `next/server`'s `after()` so submission stays fast without standing up a separate queue service.
- Flagging + moderation resolve APIs — flagging alone never changes a tag's public status; only a resolved "upheld" flag removes it and triggers rescoring (`DO_NOT.md`).
- Segment detail bottom sheet, tag submission form, flag button — `DESIGN_SYSTEM.md` band/color/icon rules, offline tag queue (localStorage + retry-with-backoff, 24h expiry) per Feedback States.
- Simple `/moderation` admin table.
- Hourly Vercel Cron wired to the real recalculation engine.

### Decisions logged
- **Time bucket mapping:** `DATA_MODEL.md` defines two score buckets (day/night) but `Tag.time_of_day` has three values (day/evening/night). "Evening" tags are counted toward the **night** bucket, since dusk is when the walking-at-night use case starts to apply. Not an explicit spec answer — revisit if it produces surprising band flips at dusk.
- **Recalculation mechanism on Vercel:** `ARCHITECTURE.md` calls for a queue-based job; Vercel serverless functions have no persistent process to run one. Used `next/server`'s `after()` for the on-write path and Vercel Cron Jobs for the hourly time-decay pass, instead of standing up a separate queue service (e.g. Upstash QStash) — the platform-native equivalent given the constraint change to Vercel deployment (originally scoped for a Coolify/VPS deploy in `ARCHITECTURE.md`, changed mid-build).
- **Cache invalidation:** `ARCHITECTURE.md` asks for "targeted invalidation, not a full cache flush," but cache keys are viewport-shaped (bbox+zoom+time_of_day), not segment-shaped. Built a reverse index (`segment-cache-index:{id}` Redis set, populated on cache write) so a tag write can invalidate exactly the cache entries containing that segment.

### Initial scaffold
- Next.js (App Router) + MapLibre GL JS + Drizzle ORM, deploying to Vercel.
- Supabase (Postgres + PostGIS) and Upstash Redis chosen over the original Coolify/VPS-oriented stack in `ARCHITECTURE.md`, after the deployment target changed to Vercel mid-project — both are serverless-compatible replacements for the same roles (spatial Postgres, cache).
- Drizzle ORM chosen over Prisma: Prisma's PostGIS support requires raw-SQL escape hatches anyway, so Drizzle's first-class `sql` template support was a better fit with less abstraction fighting.
