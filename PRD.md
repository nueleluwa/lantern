# PRD — Lantern

## Goals

1. Give someone a fast, honest read on a street's lighting and safety before they walk it at night.
2. Build tag density in one small geography fast enough that the map is trustworthy within weeks, not years.
3. Never let the product imply a guarantee it can't back up.

## Non-goals (v1)

- Turn-by-turn routing that avoids unsafe segments (Phase 2+, see `MVP_SCOPE.md`)
- Live location sharing / check-in timers (Phase 3+)
- Incident reporting to police or any authority — this is a community lighting/safety layer, not an incident-report pipeline
- City-wide coverage

## Personas

**Amaka, 24, grad student.** Walks 10 minutes from a night class to her hostel. Wants a 5-second check: is my usual route still fine tonight, or should I take the longer lit road.

**Chidinma, 31, runs a women's safety WhatsApp group in GRA.** Already informally collects "avoid this street" messages. Wants a tool that replaces the group chat with something structured and shareable.

**Tamuno, 29, estate facility manager.** Wants a live view of reported dark spots in his estate so he can prioritize streetlight repairs with data instead of complaints.

## Core user flows

### Flow A — Check before walking (primary, no login required)
1. Open app → map centers on current location
2. Segments colored by aggregate safety score (see `DATA_MODEL.md`)
3. Tap a segment → see tag breakdown, count, most recent tag age, category chips
4. Close app, walk

### Flow B — Tag a segment (contribution)
1. Big "Tag this street" button, always reachable within one thumb-reach (see `DESIGN_SYSTEM.md` button spec)
2. Select: lighting status → safety feeling → optional category chip (harassment, no sidewalk, flooding, stray dogs, okada available) → optional note
3. Submit → segment recalculates, contributor sees immediate visual confirmation

### Flow C — Passive prompt (post-walk, opt-in only)
1. If the user has opted into trip detection, after a detected walk: "How did that walk feel?" with 2-tap response (thumbs up / down + optional detail)
2. Never enabled by default — see `DO_NOT.md`

### Flow D — Moderation
1. Any tag can be flagged by other users
2. A segment's status only flips (e.g. safe → caution) after N corroborating tags within a rolling window, not on a single report
3. Tags decay in weight over time (see `DATA_MODEL.md`)

## Feature list (prioritized)

**P0 — ships in v1**
- OSM base map with segment overlay
- Tag submission (lighting, safety, category, note)
- Aggregate scoring per segment, time-of-day aware (day vs night view toggle)
- Segment detail view (tag count, recency, breakdown)
- Basic flagging/moderation
- Anonymous use by default

**P1 — fast follow**
- Contributor accounts + streaks/badges (see gamification, `MVP_SCOPE.md`)
- Partner-seed data import (NGO/campus bulk tagging)
- "Lit tonight" real-time lighting status distinct from static lighting infrastructure
- Share a segment/screenshot to WhatsApp

**P2 — later**
- Route suggestion that prefers higher-scored segments (not a strict router)
- Live share / walk-with-me
- B2B data export for partners

## Success metrics

- Tag density: median segment in launch geography has ≥3 tags within 60 days
- Freshness: % of active segments with a tag <30 days old
- Return usage: % of users who check the map more than once in a week without being prompted
- Trust proxy: % of flagged tags that get removed vs upheld (should stay low — high flag-removal rate signals bad-faith reporting or bad UX)

## Open questions

- Who moderates disputed segments in the seed geography — Lantern staff, or a delegated community lead (Chidinma-persona)?
- Does a "safe" score ever get shown as a number, or only as a qualitative band (lit/dim/dark)? Numbers invite false precision — lean toward bands.
