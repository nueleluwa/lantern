# Contributing to Lantern

## Read this first

Before touching anything that involves routing, moderation, scoring, or location data, read `DO_NOT.md` in full. It encodes hard constraints — liability language, privacy limits, anti-profiling rules — that override convenience or a quicker implementation every time. If a change conflicts with something in there, the doc wins, not the shortcut.

Recommended reading order for new context, same order the project itself was built in:

1. `PROJECT.md` — overview, file map, stack
2. `DO_NOT.md` — hard constraints
3. `PRD.md` — goals, personas, flows, prioritized features
4. `DATA_MODEL.md` — schema, scoring/decay algorithm
5. `ARCHITECTURE.md` — data flow, caching, recalculation, scale notes
6. `DESIGN_SYSTEM.md` — colors, type, icons, button spec, motion
7. `MVP_SCOPE.md` — phased build order
8. `ROADMAP.md` — current status of every phase item, what's still placeholder
9. `CHANGELOG.md` — what's shipped and the reasoning behind judgment calls made where the docs above were ambiguous
10. `docs/API.md` — full API reference (endpoints, request/response shapes, auth, rate limits) — update this alongside any route change, same as ROADMAP/CHANGELOG

## Local setup

See `README.md` for the full environment setup (Supabase, Upstash, env vars, seeding).

```bash
npm install
npm run dev
```

## Before opening a PR

- `npm run typecheck` and `npm run build` must both pass. Typecheck alone has already missed at least one real bug (a client component pulling a server-only DB driver into the browser bundle — see the `CHANGELOG.md` entry for 2026-07-13) — always run the full build before considering a change done.
- If you touched scoring, moderation, or anything in `DO_NOT.md`'s territory, say so explicitly in the PR description and explain how the change stays inside those constraints.
- If you made a judgment call on something the docs leave ambiguous, add an entry to `CHANGELOG.md`'s "Decisions logged" section — don't let it live only in a code comment. Future contributors need to find it without reading every file.
- Update `ROADMAP.md` if your change moves an item from placeholder to real, or from one phase to done.
- Update `docs/API.md` if you add, remove, or change the shape of any endpoint — it's a reference, and a stale one is worse than none.

## Code style

- No comments explaining *what* code does — names should do that. Comments are for *why*: a constraint from the docs, a non-obvious tradeoff, a workaround.
- Don't add dependencies, abstractions, or config options beyond what the current task needs.
- Match the existing pattern for a given layer (API routes validate with `zod`, DB access goes through `src/lib/db.ts`, scoring logic stays in `src/lib/scoring.ts` — don't duplicate it inline in a route).
