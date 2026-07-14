# Architecture — Lantern

This doc covers what `DATA_MODEL.md` doesn't: requirements, data flow, caching, and what happens as this scales past one neighborhood. Read alongside `DATA_MODEL.md` (schema) and `MVP_SCOPE.md` (phasing).

> **Deployment target changed mid-project, this doc wasn't rewritten (flagged by audit-project review).** §1's "Coolify/VPS" constraint and §3's "background job/queue consumer" mechanism describe the *original* plan. The actual deployment is Vercel + Supabase + Upstash: recalculation runs via `next/server`'s `after()` on tag write and Vercel Cron Jobs hourly, not a persistent queue consumer. See `CHANGELOG.md`'s 2026-07-13 entry ("Recalculation mechanism on Vercel") for the reasoning. Kept here unedited as the record of the original design intent — read `README.md` and `CHANGELOG.md` for what's actually running.

## 1. Requirements

**Functional** — covered in full by `PRD.md`. Summary: view tagged segments on a map, submit a tag, moderate flagged tags, aggregate scores with time-decay.

**Non-functional (previously unstated — set here explicitly):**
- **Latency:** map/segment reads under 300ms p95 within the launch bbox. This is a "check before I walk out the door" flow — anything slower breaks the use case.
- **Scale target for Phase 1:** design for one neighborhood, low thousands of segments, hundreds of daily active users, single-digit tags-per-minute at peak. Do not over-engineer for city-wide scale before Phase 1 proves the model — see `MVP_SCOPE.md`.
- **Availability:** best-effort, no formal SLA in Phase 1 — this is not safety-critical infrastructure (see `DO_NOT.md` on liability language), so a brief outage degrades the experience but shouldn't be treated as an incident requiring on-call.
- **Offline tolerance:** tag submission must survive a dropped connection (queue-and-retry client-side) given inconsistent Nigerian mobile connectivity — see `DESIGN_SYSTEM.md` Feedback States.

**Constraints:** small team, deploying to Coolify/VPS per Emmanuel's existing infra pattern (not a hyperscale cloud setup) — architecture should stay boring and operable by one or two people, not assume a platform team.

## 2. High-level design

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Client      │──1──▶│  API layer    │──2──▶│  Postgres+PostGIS │
│ (Next.js PWA)│      │ (Node/Next    │      │  segments, tags   │
│              │◀─5───│  API routes)  │◀─3───│                    │
└─────────────┘      └───────┬──────┘      └─────────────────┘
                              │4
                              ▼
                      ┌──────────────┐
                      │  Redis cache  │
                      │  (segment/bbox │
                      │   read cache)  │
                      └──────────────┘
```

**Data flow for the two hot paths:**

- **Read (map load):** (1) client requests segments for current bbox + time-of-day → (2) API checks Redis cache keyed on `bbox+zoom+time_of_day` → cache hit returns immediately; cache miss (3) queries Postgres with a spatial index, (4) writes result to Redis with a short TTL (~2 min — short enough that a new tag shows up quickly, long enough to absorb repeated map-pan requests), (5) returns to client.
- **Write (tag submission):** client submits tag → API validates + rate-limits (see §3) → writes to `tags` table → invalidates the Redis cache entries for that segment's bbox (targeted invalidation, not a full cache flush) → queues a recalculation job (see §3) rather than recalculating synchronously in the request path, so tag submission stays fast even if scoring logic gets more complex later.

## 3. Deep dive — items `DATA_MODEL.md` left unspecified

**Score recalculation mechanism:** a lightweight background job (a scheduled function or a simple queue consumer — doesn't need Kafka-scale infrastructure at this size) picks up "segment needs recalculation" events, recomputes the weighted aggregate per `DATA_MODEL.md`'s decay formula, and only writes a new `day_score`/`night_score` if the 48-hour stability window condition is met. Runs on tag write and on a rolling schedule (e.g. hourly) to handle pure time-decay even with no new tags.

**Spatial indexing:** every `Segment.geometry` column needs a GiST index — bbox queries against an unindexed geometry column will degrade fast well before Phase 1's target scale is reached. This is a schema requirement, not an optimization to defer.

**Rate limiting on anonymous tag submission:** per-device-fingerprint (not just per-IP, since mobile carriers NAT many users behind few IPs) limit — e.g. max 10 tags per rolling hour per device. This is the first line of defense referenced in `DO_NOT.md`'s concern about bad-faith tagging bursts; the corroboration/stability-window logic in `DATA_MODEL.md` is the second line, not the only one.

**Error handling & retry:** client-side tag submission uses an optimistic local queue (per Feedback States in `DESIGN_SYSTEM.md`) — write to local storage first, show "saved," attempt submission, retry with backoff on failure, only surface an error to the user if retries are exhausted after a reasonable window (e.g. 24h).

## 4. Scale and reliability — what to revisit as this grows

Stated explicitly so nobody over-builds Phase 1 for a scale it doesn't have yet, and so the ceiling is visible when it's time to revisit:

| Current design holds through... | Revisit when... | What changes |
|---|---|---|
| Single Postgres instance | Multiple neighborhoods, thousands of concurrent users | Read replica for the hot `GET /segments` path |
| Redis single-node cache | Multi-region/multi-city | CDN-level tile/response caching in front of the API |
| Scheduled/queue-based recalculation on one worker | Recalculation lag becomes noticeable at higher tag volume | Dedicated queue (e.g. BullMQ on the existing Redis) with worker concurrency |
| No formal monitoring | Any production traffic at all, honestly | Minimum viable: uptime check on the API, error-rate alerting (even a simple Sentry + a cron-based healthcheck ping beats nothing) |
| Manual moderation queue | Flag volume exceeds a small team's daily bandwidth | Auto-hide (not auto-delete) tags that cross a flag-count threshold pending review, rather than requiring every flag to be manually triaged |

## 5. Trade-offs made explicit

- **Queue-based recalculation vs. synchronous:** chosen for write-path speed and future flexibility, at the cost of slight eventual-consistency (a tag might take up to a few minutes to affect the visible score). Acceptable — this is not a real-time system.
- **Redis cache vs. no cache:** adds one more moving part for a small team to run, but the alternative (hitting Postgres on every map pan) doesn't hold up even at Phase 1 scale given how map UIs generate request volume. Kept minimal — single-node, short TTL, no clustering.
- **Boring stack (Node/Postgres/Redis on a VPS) vs. managed serverless:** chosen for operability by a small team already running Coolify infra, at the cost of not auto-scaling — acceptable given the Phase 1 scale target above.
