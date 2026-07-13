# MVP Scope & Build Order — Lantern

## Why phased this way

Cold start is the central risk (see `PROJECT.md`). Every phase-1 decision optimizes for getting a small geography to trustworthy tag density fast — not for feature completeness.

## Phase 1 — Passive overlay (ship this first, nothing else)

1. OSM base map, restyled to `DESIGN_SYSTEM.md` night palette, scoped to one launch neighborhood (config-driven bounding box, not hardcoded — makes expansion trivial later)
2. Segment model + PostGIS storage, seeded from OSM ways in the launch bbox
3. Tag submission flow (Flow B in `PRD.md`) — anonymous, no login required
4. Aggregate scoring (day/night buckets, decay-weighted) per `DATA_MODEL.md`
5. Segment detail bottom sheet
6. Basic flagging (submit flag, store it — moderator review UI can be a simple admin table, not a polished screen yet)
7. Day/night toggle on the map

**Definition of done for Phase 1:** a person in the launch neighborhood can open the map, see tagged segments, tag a new one, and trust that stale/single-source tags don't dominate.

## Phase 2 — Fast follow

1. Partner-seed data import tool (CSV/GeoJSON bulk import from an NGO or campus safety office, tagged with a `seed_source` field distinct from organic tags)
2. Contributor accounts, streaks, "Safety Scout" badges
3. "Lit tonight" short-half-life lighting tags, distinct from static infrastructure tags
4. Share-to-WhatsApp for a segment or screenshot
5. Moderator admin UI (proper, not the Phase-1 table)

## Phase 3 — Later

1. Route suggestion that prefers higher-scored segments (explicitly not a strict "safest route" router — see `DO_NOT.md` on liability language)
2. Live share / walk-with-me companion mode
3. B2B/B2G data export for partners (aggregated, de-identified only)
4. Expansion beyond the launch geography — repeat Phase 1's seeding playbook per new area, don't go city-wide in one jump

## Explicitly out of scope until stated otherwise

- Native iOS/Android apps — ship mobile-web first (PWA-capable)
- Payment/monetization of any kind
- Incident reporting to authorities
- Multi-city launch
