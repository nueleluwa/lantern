# Do Not — Lantern

Read this before implementing anything that touches routing, moderation, location storage, or copy that describes safety. These are hard constraints, not suggestions to weigh against convenience.

## Liability & claims

- **Do not** describe any route or segment as "safe" in absolute terms. Always "community-reported lit/safe" or equivalent — the app reflects reports, it does not guarantee outcomes.
- **Do not** ship a "safest route" router in Phase 1. Routing implies a stronger guarantee than tag data supports. Phase 2+ only, and even then with a persistent disclaimer in the routing UI itself, not just in a terms-of-service page nobody reads.
- **Do not** let a single unverified tag flip a segment's public status. Require the corroboration + stability window defined in `DATA_MODEL.md`.

## Privacy & data

- **Do not** store precise home or work locations tied to an identifiable contributor.
- **Do not** retain raw GPS trip trails past the point of aggregating them into segment tags — aggregate then discard the trail.
- **Do not** enable passive trip-detection tagging by default. It must be an explicit opt-in, explained in plain language before it's turned on (Flow C in `PRD.md`).
- **Do not** make contributor handles derivable from a real name, phone number, or other account by default.
- **Do not** expose a contributor's tag history publicly in a way that lets someone build a movement pattern of a specific person.

## Bias & profiling

- **Do not** allow free-text tags or categories that reference ethnicity, religion, or nationality as a safety signal. Build category options as a fixed enum (see `DATA_MODEL.md`) precisely so this can't happen through free text becoming a de facto category.
- **Do not** publish a "worst streets" ranked leaderboard without context. A raw ranking of "most dangerous neighborhoods" invites exactly the redlining-by-proxy failure mode that has discredited prior apps in this space. If a ranked view ships at all, pair every entry with the actual reported reasons (lighting, category), not just a score.
- **Do not** let moderators or seed-data partners bulk-tag a neighborhood as unsafe without segment-level specificity. "This whole area is unsafe" is not an acceptable tag; individual segments with individual reasons are.

## Design & UX (cross-reference `DESIGN_SYSTEM.md`)

- **Do not** use a bare numeric safety score as the primary UI element — bands only, per `DESIGN_SYSTEM.md`.
- **Do not** make any safety-critical control (tag, flag, "I feel unsafe") a small or icon-only tap target.
- **Do not** default the app to a cheerful/gamified tone for anything related to a caution or avoid rating — badges and streaks belong to the contribution flow, never to someone else's reported danger.

## Scope discipline

- **Do not** build city-wide coverage before one launch geography reaches trustworthy density (`MVP_SCOPE.md` Phase 1 definition of done).
- **Do not** add monetization, payments, or B2B data export before Phase 3 — earning trust in the community comes first.
- **Do not** integrate incident reporting to police/authorities into this product. If a partner NGO wants that, it's a separate, explicitly-consented flow — not a default part of tagging.
