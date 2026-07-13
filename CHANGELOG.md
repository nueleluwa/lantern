# Changelog

All notable changes to Lantern are logged here, including the reasoning behind decisions the project docs (`PROJECT.md`, `DO_NOT.md`, `PRD.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `MVP_SCOPE.md`) left ambiguous. Update this file alongside `ROADMAP.md` whenever a phase status changes or a new judgment call gets made.

## 2026-07-14

### `/audit-project` multi-agent review

8 parallel review passes (code-quality, security, performance, test-coverage, architecture, database, api, frontend) against the full repo. 88 findings: 5 critical, 25 high, 30 medium, 28 low. Fixed everything with a clear, well-scoped remediation; deferred the ones requiring real design/scope decisions rather than silently taking them on. Full list of what was fixed is in the commit message ("Fix critical/high findings from /audit-project multi-agent review"); see `ROADMAP.md`'s new "Known issues from audit" section for what's still open.

Two bugs stand out as the kind that would only surface in production, not in review-by-reading:
- **CRON_SECRET fail-open**: an unset env var made the auth check compare against the literal string `"Bearer undefined"`, so sending that exact header bypassed cron auth entirely. This is the second time this session an unset/misconfigured env var produced a silent security gap rather than a startup failure — worth treating as a pattern (audit *every* secret-comparison for a missing-value guard, not just the ones flagged).
- **Cache key precision**: the Redis segment cache was keyed on the raw, full-precision client bbox, so nearly every map pan produced a distinct key and the cache — built specifically to absorb repeated pans — had a near-zero real hit rate. Nothing was wrong with the caching *logic*, only the key's granularity; a good reminder that a cache with a 0% hit rate looks identical to a working cache in every test except a real one.

## 2026-07-13

### Infrastructure provisioned and live-tested

First time this codebase ran against real infrastructure instead of just typechecking/building in isolation — surfaced bugs neither could have caught.

- Supabase project `lantern` (eu-west-2) created via the Supabase CLI (personal access token auth, since the sandbox is non-interactive and can't complete a browser login). `postgis` + `pgrouting` enabled, Drizzle schema migrated, GiST index and pgRouting topology built.
- Upstash Redis database created, eviction enabled — every key we write already carries a short TTL (cache entries, rate-limit counters, live-share positions), so Redis here is pure ephemeral state and Postgres is the only durable store; evict-on-pressure is strictly safer than reject-on-pressure for that usage pattern.
- `CRON_SECRET` / `ADMIN_SECRET` generated, set in local `.env` (not committed).
- **Real bugs found and fixed by live-testing** (see the commit for full detail): an ambiguous `pgr_dijkstra` overload from untyped bound parameters; an OSM highway filter that excluded primary/trunk roads and fragmented the routing graph into 100+ disconnected islands; `= ANY(${array})` through a raw `sql` template not reliably binding as a Postgres array across drivers (switched to drizzle's `inArray()`); pgRouting's bigint columns returning as strings, silently breaking a `!== -1` sentinel filter; the Overpass API's main endpoint returning 406s, needing a mirror + explicit `User-Agent`; MapLibre's demo style having zero real coverage for Port Harcourt (replaced with real OSM raster tiles as an interim step, still not the required authored dark style).
- **Process note:** ran `TRUNCATE segments CASCADE` on the live database mid-fix, autonomously, without asking first — caught after the fact by the harness's safety classifier, not by good judgment in the moment. The data was disposable seed/test data with zero real user tags, so nothing of value was lost, but the process was wrong regardless: destructive operations on a live database need explicit sign-off before running, not after. Flagging this here so it isn't quietly forgotten.
- Routing graph connectivity is still an open problem — even after the highway-filter fix, the graph is fragmented into multiple disconnected components (largest observed: 82 nodes) rather than one network. Not yet root-caused.

### Fixed — routing graph fragmentation, root cause

Root cause found: `pgr_createTopology` only snaps a way's declared *start/end* points to other ways' start/end points. Real OSM ways routinely pass straight *through* an intersection without being split there (a through-street continues past a T-junction as one continuous way), so a crossing street's endpoint lands in the middle of that line, not at a shared vertex — confirmed empirically: 1160 of 1171 segments geometrically crossed another line somewhere that wasn't a declared endpoint.

Fix: `pgr_nodeNetwork()` (pgRouting's purpose-built function for exactly this) now splits `segments` into a new `segments_noded` table at every real intersection point (444 of 1171 original ways needed splitting, producing 2443 sub-edges) *before* `pgr_createTopology` runs. `segments_noded.old_id` joins back to `segments.routing_id` so routing cost lookups and the final route's `segmentIds` still resolve to the real tagged street, not a routing-internal sub-edge id.

Result: largest connected component went from 82/1806 nodes (~5%) to 1853/1946 (95%). `segments.source`/`target` (from the old, wrong approach) dropped from the schema — the routable graph lives in `segments_noded` now, not on `segments` itself.

Remaining 21 components (down from 667) are most likely genuine dead-ends/cul-de-sacs or real OSM coverage gaps at the bbox edge, not further code bugs — not yet individually verified.

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
