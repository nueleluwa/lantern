# Lantern — Community-Lit Safe Route Mapper

> Assumption: I've named this project **Lantern** (a community lights the way at night). Rename freely — it's used as a placeholder string across all docs in `/config` and `/branding`, so a find-and-replace is enough if you change it.

## What this is

Lantern is a crowdsourced map overlay on OpenStreetMap where people tag street segments as well-lit / poorly-lit and safe / unsafe for walking at night. It's built for people — especially women — deciding whether to walk a route after dark, starting in Port Harcourt.

## Problem

Night-walking risk in Nigerian cities isn't static. A street can be safe at 6pm and empty by 9pm. Streetlights exist but aren't reliably powered. None of this is mapped anywhere. People currently rely on word-of-mouth, which doesn't scale and doesn't update.

## Who it's for

Primary: women walking or navigating on foot/okada at night in urban Nigeria.
Secondary: NGOs, university safety offices, and estate/security managers who want a live view of risk in their area.

## MVP definition (read this before building anything)

**Phase 1 is a passive overlay, not a router.** Users view a map with tagged segments before they walk. No route calculation, no "safe path" guarantee. This is a deliberate scope cut — see `DO_NOT.md` for why routing-with-liability is deferred.

## File map

| File | Purpose |
|---|---|
| `PRD.md` | Goals, personas, user flows, prioritized feature list, success metrics |
| `DATA_MODEL.md` | Entities, schema, scoring/decay algorithm, API sketch |
| `ARCHITECTURE.md` | Requirements, data flow, caching, recalculation mechanism, scaling ceiling |
| `DESIGN_SYSTEM.md` | Colors, type, Heroicons mapping, button spec, motion, components |
| `MVP_SCOPE.md` | Phased build order — what ships in v1 vs later |
| `DO_NOT.md` | Hard constraints — ethical, legal, and product guardrails |

Read `DO_NOT.md` before writing any feature that touches routing, moderation, or location storage. It is not optional context.

## Suggested stack (not locked — propose alternatives if you have a reason)

- Base map: OpenStreetMap tiles (self-hosted or MapTiler/Mapbox free tier)
- Frontend: Next.js + a map library (MapLibre GL JS — avoid Mapbox GL's paid tier lock-in)
- Backend: Node/Postgres + PostGIS (segment geometry, spatial queries)
- Routing (Phase 2+ only): OSRM or Valhalla with a custom cost profile
- Auth: anonymous-by-default, optional account for contribution history

## Geography for launch

Start narrow: one Port Harcourt neighborhood or a university campus. Do not attempt city-wide coverage in v1 — see `MVP_SCOPE.md`.
