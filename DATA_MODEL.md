# Data Model — Lantern

## Design principle

Tag at the **street segment** level (an OSM way, or a sub-split of one), not free-floating points or hand-drawn polygons. Segments are the unit that aggregates cleanly and maps to routing later.

## Entities

### Segment
```
id                  uuid
osm_way_id          bigint          -- reference to OSM way
geometry             linestring     -- PostGIS geometry
name                 text           -- derived from OSM, editable
neighborhood         text
day_score            enum(lit_safe, caution, avoid, unrated)
night_score          enum(lit_safe, caution, avoid, unrated)
tag_count            int            -- denormalized for fast reads
last_tagged_at       timestamptz
```

### Tag
```
id                  uuid
segment_id          fk -> Segment
contributor_id      fk -> Contributor, nullable   -- null = fully anonymous
created_at          timestamptz
time_of_day         enum(day, evening, night)     -- self-reported context
lighting             enum(lit, dim, dark)
safety_feeling       enum(safe, caution, avoid)
category             enum(harassment, no_sidewalk, flooding, animals,
                           no_transport_available, other), nullable
note                 text, nullable                -- max ~280 chars
weight               float          -- computed, see decay below
flagged_count        int
status               enum(active, under_review, removed)
```

### Contributor (optional account)
```
id                  uuid
display_handle      text           -- never real name by default
joined_at           timestamptz
tag_count           int
trust_score         float          -- rises with corroborated tags, falls with removed ones
```

### ModerationFlag
```
id                  uuid
tag_id              fk -> Tag
flagged_by          fk -> Contributor, nullable
reason               enum(inaccurate, spam, hate_or_profiling, duplicate)
created_at           timestamptz
resolution           enum(pending, upheld, dismissed)
```

## Scoring algorithm

**Weight decay:** `weight = base_weight * exp(-days_since_tag / half_life_days)`
- `half_life_days = 45` default — a tag is worth half as much after ~6 weeks, negligible after ~6 months.
- Lighting-infrastructure tags (static, e.g. "no streetlight installed") can use a longer half-life (180 days) since infrastructure changes slowly. "Lit tonight" tags use a short half-life (1 day) — they expire by morning.

**Aggregate score per segment, per time-of-day bucket:**
1. Filter tags to the relevant `time_of_day` bucket
2. Sum weighted `safety_feeling` values (safe=+1, caution=0, avoid=-1) × `weight`
3. Require a minimum weighted tag count (e.g. 3) before a segment leaves `unrated`
4. Map the weighted average to a band: `lit_safe` / `caution` / `avoid` — never expose a raw numeric score in the UI (see `PRD.md` open questions)

**Status flip rule:** a segment's band only changes when the new aggregate has been stable across ≥2 recalculation cycles (e.g. 48 hours apart), to prevent a single bad-faith burst of tags from flipping a segment instantly.

## API sketch

```
GET  /segments?bbox=...&time_of_day=night     -> segments with current band in viewport
GET  /segments/:id                             -> full detail incl. recent tags, breakdown
POST /segments/:id/tags                        -> submit a tag
POST /tags/:id/flag                             -> flag a tag for moderation
GET  /moderation/queue                          -> pending flags (moderator-only)
POST /moderation/flags/:id/resolve              -> uphold/dismiss (moderator-only)
```

## What NOT to store (see also `DO_NOT.md`)

- No precise home/work location tied to an identifiable contributor
- No raw GPS trip trails retained past aggregation into segment tags
- No free-text note field indexed/searchable by contributor identity
