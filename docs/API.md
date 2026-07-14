# API Reference

Base URL: `https://lantern-blue.vercel.app` (production) or `http://localhost:3000` (local dev — port varies if 3000 is taken).

This is the internal API for the Lantern web client, plus one versioned endpoint (`/api/v1/export/segments`) meant for external partners. Everything else is unversioned and may change without notice — if you're integrating externally, only rely on the `/api/v1/*` surface.

Read `DO_NOT.md` before building anything against this API that touches routing, moderation, or location data — several endpoints below exist specifically to enforce constraints from that document (segment-level tagging only, no absolute "safe" claims, flagging never directly changes a tag's status, etc.), and those constraints aren't optional.

## Conventions

### Error envelope

Every error response (across every endpoint) uses the same shape:

```json
{
  "error": {
    "code": "bad_request",
    "message": "Human-readable description",
    "details": { "...": "optional, e.g. zod validation output" }
  }
}
```

| `code` | HTTP status | Meaning |
| --- | --- | --- |
| `bad_request` | 400 | Malformed input (bad UUID, missing required header, oversized bbox, etc.) |
| `validation_error` | 400 | Request body/query failed zod schema validation — `details` has the zod `.flatten()` output |
| `unauthorized` | 401 | Missing/invalid auth (admin secret, partner API key, cron secret, owner token) |
| `not_found` | 404 | Resource doesn't exist, or (for live-share) exists but the token doesn't match |
| `conflict` | 409 | State conflict — e.g. a moderation flag already resolved, a contributor handle already taken |
| `rate_limited` | 429 | Per-device or per-IP rate limit exceeded |

### Anonymous identity

Most write endpoints require an `X-Device-Id` header — an opaque, client-generated random UUID (see `src/lib/device-id.ts`), stored in `localStorage`. This is **not** a fingerprinting mechanism; it's a self-issued token used only for rate limiting. Per `DO_NOT.md`, nothing in this API can ever derive a real identity from it.

Optional contributor accounts (see `POST /api/contributors`) layer on top via an httpOnly session cookie (`lantern_contributor_id`) — most endpoints work identically with or without one.

### Rate limits

All rate limits are per-`X-Device-Id`, rolling 1-hour windows, enforced via Redis:

| Action | Limit |
| --- | --- |
| Tag submission | 10/hour |
| Flag submission | 20/hour |
| Live-share session creation | 5/hour |
| Contributor account creation | 5/hour |

Admin (`/api/moderation/*`) and partner (`/api/v1/export/*`) auth additionally lock out an IP for 15 minutes after 10 failed attempts.

---

## Segments

### `GET /api/segments`

Public. Returns segments intersecting a bounding box as a GeoJSON `FeatureCollection`. Cached in Redis (~2 min TTL, bbox snapped to a coarse grid so nearby pans at the same zoom share a cache entry).

**Query parameters**

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `bbox` | `minLng,minLat,maxLng,maxLat` | yes | Max area: 4 sq degrees |
| `time_of_day` | `day` \| `night` | yes | Determines which score column (`day_score`/`night_score`) is returned as `band` |
| `zoom` | number | no | Currently only affects the cache key, not query bounding |

Max 2000 rows per response regardless of bbox size.

**Response** `200`

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [[7.03, 4.79], [7.031, 4.791]] },
      "properties": {
        "id": "8228991b-0f65-40d5-acbd-1a3fe7390b8f",
        "name": "Amadi-Ama Road",
        "band": "lit_safe",
        "tagCount": 4,
        "lastTaggedAt": "2026-07-13T18:02:00.000Z"
      }
    }
  ]
}
```

`band` is one of `lit_safe` \| `caution` \| `avoid` \| `unrated` — never a raw number (`DESIGN_SYSTEM.md`).

**Errors:** `validation_error` (bad bbox/time_of_day), `bad_request` (bbox area over 4 sq degrees).

---

### `GET /api/segments/:id`

Public. Full detail for one segment: current bands, tag count, up to 20 most recent active tags, and a safe/caution/avoid breakdown of those recent tags.

**Response** `200`

```json
{
  "segment": {
    "id": "8228991b-0f65-40d5-acbd-1a3fe7390b8f",
    "name": "Amadi-Ama Road",
    "neighborhood": "TODO: name the launch neighborhood",
    "dayScore": "unrated",
    "nightScore": "caution",
    "tagCount": 4,
    "lastTaggedAt": "2026-07-13T18:02:00.000Z"
  },
  "breakdown": { "safe": 1, "caution": 2, "avoid": 1 },
  "recentTags": [
    {
      "id": "...",
      "createdAt": "2026-07-13T18:02:00.000Z",
      "timeOfDay": "night",
      "lighting": "dim",
      "safetyFeeling": "caution",
      "category": "no_sidewalk",
      "note": "Getting dark by the market stalls",
      "kind": "standard"
    }
  ]
}
```

**Errors:** `bad_request` (malformed UUID), `not_found`.

---

### `POST /api/segments/:id/tags`

Submit a tag (PRD.md Flow B). Requires `X-Device-Id`. Rate-limited (10/hour/device).

**Request body**

```json
{
  "timeOfDay": "night",
  "lighting": "dim",
  "safetyFeeling": "caution",
  "category": "no_sidewalk",
  "note": "Getting dark by the market stalls",
  "kind": "standard"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `timeOfDay` | `day` \| `evening` \| `night` | yes | |
| `lighting` | `lit` \| `dim` \| `dark` | yes | |
| `safetyFeeling` | `safe` \| `caution` \| `avoid` | yes | |
| `category` | `harassment` \| `no_sidewalk` \| `flooding` \| `animals` \| `no_transport_available` \| `other` \| `null` | no | Fixed enum only — `DO_NOT.md` forbids free-text safety categories |
| `note` | string, ≤280 chars, or `null` | no | Free text, never used as a safety signal itself |
| `kind` | `standard` \| `infrastructure` \| `lit_tonight` | no, defaults to `standard` | Controls decay half-life: 45/180/1 days respectively |

If a contributor session cookie is present, the tag is attributed to that contributor and counts toward their streak/badges.

**Response** `201` — `{ "tag": { ...inserted row } }`

**Side effects:** recalculates the segment's day/night bands in the background (`next/server`'s `after()`, doesn't block the response) and invalidates its cache entries. A band only publicly changes after DATA_MODEL.md's 48h stability window, regardless of how quickly recalculation runs.

**Errors:** `bad_request` (bad UUID, missing device id), `rate_limited`, `validation_error`, `not_found`.

---

## Tags & moderation

### `POST /api/tags/:id/flag`

Flag a tag for review (PRD.md Flow D). Requires `X-Device-Id`. Rate-limited (20/hour/device).

**Request body:** `{ "reason": "inaccurate" | "spam" | "hate_or_profiling" | "duplicate" }`

Flagging alone **never** changes a tag's public status — `DO_NOT.md` requires a moderator to resolve it. The flagger's contributor id (if any) is derived server-side from their session cookie, never taken from the request body.

**Response** `201` — `{ "flag": { ...inserted row } }`

**Errors:** `bad_request`, `rate_limited`, `validation_error`, `not_found`.

---

### `GET /api/moderation/queue`

Moderator-only (see Auth below). Lists moderation flags.

**Query parameters:** `resolution` (`pending` \| `upheld` \| `dismissed`, default `pending`), `limit` (default 50, max 200), `offset` (default 0).

**Response** `200`

```json
{
  "flags": [
    {
      "flagId": "...", "reason": "spam", "createdAt": "...", "resolution": "pending",
      "tagId": "...", "tagNote": "...", "tagCategory": "harassment", "tagSafetyFeeling": "avoid", "tagFlaggedCount": 2,
      "segmentId": "...", "segmentName": "Amadi-Ama Road",
      "contributorHandle": "amaka_walks", "contributorTrustScore": 1.2
    }
  ],
  "limit": 50,
  "offset": 0
}
```

**Auth:** header `X-Admin-Secret: <ADMIN_SECRET>`. This is a placeholder single-operator gate (see `ROADMAP.md` — PRD.md's "who moderates" question is unanswered), not real per-moderator accounts. Locked out after 10 failed attempts from the same IP for 15 minutes.

**Errors:** `unauthorized`.

---

### `POST /api/moderation/flags/:id/resolve`

Moderator-only. Uphold or dismiss a flag.

**Request body:** `{ "resolution": "upheld" | "dismissed" }`

Upholding a flag: sets the tag's `status` to `removed` (excluding it from future scoring), decrements the tagging contributor's `trust_score` by 1 (if the tag had a contributor), and triggers rescoring of the segment in the background. Only a flag still in `pending` state can be resolved — a second resolve attempt on the same flag returns `409 conflict` rather than double-applying the side effects.

**Response** `200` — `{ "ok": true }`

**Errors:** `unauthorized`, `validation_error`, `not_found`, `conflict` (already resolved).

---

## Routing (Phase 3)

### `GET /api/route`

Public. Suggests a route between two points, preferring higher-scored segments. **Not a "safest route" guarantee** — `DO_NOT.md` explicitly forbids that framing; it still routes through caution/avoid segments if that's the only path, since refusing to route would itself imply a stronger guarantee than the data supports.

**Query parameters:** `from` (`lng,lat`), `to` (`lng,lat`), `time_of_day` (`day` \| `night`).

**Response** `200`

```json
{
  "geometry": { "type": "LineString", "coordinates": [ ... ] },
  "segmentIds": ["...", "..."],
  "totalCost": 0.0247,
  "disclaimer": "This route prefers streets with better community-reported lighting and safety — it is not a guarantee of safety. Always use your own judgment."
}
```

The `disclaimer` string is part of every response body specifically so a client can't accidentally render a route without it (`DO_NOT.md` requires it live in the routing UI, not a ToS page). `totalCost` is an internal cost-graph unit (segment length × band multiplier), not a real-world distance or time — don't display it directly to end users.

**Errors:** `validation_error`, `not_found` (no path exists between the two points — can happen since the routing graph isn't fully connected everywhere yet, see `ROADMAP.md`).

---

## Live share (Phase 3)

Ephemeral, opt-in, Redis-only "walk with me" companion mode. Nothing here is ever written to Postgres — DO_NOT.md forbids retaining raw GPS trails, and only the single latest position is ever stored (overwritten, never appended). Sessions hard-expire after 4 hours; a position older than 3 minutes is considered stale.

### `POST /api/live-share`

Start a session. Requires `X-Device-Id`. Rate-limited (5/hour/device).

**Response** `201`

```json
{ "id": "session-uuid", "ownerToken": "owner-secret-uuid", "expiresAt": 1784000000000 }
```

`id` is the share link identifier — safe to hand to a viewer (`/share/:id` page). `ownerToken` must **never** be shared; it's the only credential that can update the position or end the session. Keep it in memory on the walker's device only.

### `GET /api/live-share/:id`

Public (viewer-facing) — no token required, since the `id` itself is the intended authorization for read-only viewing.

**Response** `200` — `{ "expiresAt": 1784000000000, "position": { "lng": 7.03, "lat": 4.79, "updatedAt": 1783999000000 } | null }`, or `404 not_found` if the session ended or expired.

### `POST /api/live-share/:id`

Update the current position. Requires header `X-Owner-Token: <ownerToken>`.

**Request body:** `{ "lng": 7.03, "lat": 4.79 }`

**Response** `200` — `{ "ok": true }`, or `404 not_found` if the session/token doesn't match.

### `DELETE /api/live-share/:id`

End the session early ("I'm safe"). Requires header `X-Owner-Token: <ownerToken>`.

**Response** `200` — `{ "ok": true }`, or `404 not_found` if the session/token doesn't match.

---

## Contributors (Phase 2, optional)

Anonymous-by-default remains fully functional without ever calling these — an account only labels contribution history (streaks, badges, trust score), never gates anything.

### `POST /api/contributors`

Create a contributor account. Requires `X-Device-Id`. Rate-limited (5/hour/device).

**Request body:** `{ "displayHandle": "amaka_walks" }` — 3-24 chars, letters/digits/`-`/`_` only. Must be globally unique (never derivable from a real name/phone per `DO_NOT.md` — that's on you to enforce client-side by not asking for one).

Sets an httpOnly session cookie (`lantern_contributor_id`) on success — no password, no email.

**Response** `201` — `{ "contributor": { ...inserted row } }`

**Errors:** `bad_request`, `rate_limited`, `validation_error`, `conflict` (handle taken).

### `GET /api/contributors/me`

Returns the current session's contributor record, or `{ "contributor": null }` if there's no session cookie or it doesn't match a row. Always `200` — this is a "do I have an account" check, not an auth gate.

---

## B2B/B2G export (Phase 3, partner-only)

### `GET /api/v1/export/segments`

Aggregated, de-identified export for partners (NGOs, campus safety offices, estate managers — PRD.md's Tamuno persona). Deliberately excludes individual tags, notes, contributor ids/handles, and device ids — only segment-level bands/counts, with `last_tagged_at` truncated to the day.

**Auth:** header `X-Api-Key: <raw key>`. Keys are issued via `npm run partner:create-key -- --name "Partner Name"` (see `CONTRIBUTING.md`) — only the SHA-256 hash is stored, so a lost key can't be recovered, only reissued. Locked out after 10 failed attempts from the same IP for 15 minutes.

**Response** `200`

```json
{
  "segments": [
    { "id": "...", "neighborhood": "...", "dayScore": "unrated", "nightScore": "caution", "tagCount": 4, "lastTaggedDate": "2026-07-13T00:00:00.000Z" }
  ],
  "exportedAt": "2026-07-14T09:00:00.000Z"
}
```

**Errors:** `unauthorized`.

---

## Internal — not for external use

### `GET /api/cron/recalculate`

Vercel Cron Jobs invocation target (`vercel.json`, daily — see `CHANGELOG.md` for why not hourly). Recomputes decay-weighted scores for every segment in one batched pass. Not useful to call manually unless you have `CRON_SECRET`.

**Auth:** header `Authorization: Bearer <CRON_SECRET>`.

**Response** `200` — `{ "recalculated": 1171 }` (segment count processed).
