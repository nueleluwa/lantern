# Design System — Lantern

## Philosophy

The design should feel like **the ten seconds before you step under a streetlamp** — the moment of checking, not a generic "safety app" mood board. The night sky is the base; the streetlamp's amber sodium-vapor glow is the accent that means "trustworthy, lit, human-tagged." This is a functional metaphor, not decoration: real Nigerian streetlights are amber/sodium-colored, not the cool white or neon-green that most "safety app" UIs default to. Lean into that specificity everywhere.

**Explicitly avoided defaults:** warm cream background with terracotta accent (the current AI-design cliché), near-black with acid-green/neon accent, broadsheet hairline-rule layouts. None of these have anything to do with streets at night.

## Color palette

| Token | Hex | Use |
|---|---|---|
| `night-950` | `#10132B` | Base background — deep indigo-navy, not pure black |
| `night-800` | `#1C2148` | Cards, elevated surfaces |
| `lamp-500` | `#F5A524` | Primary accent — sodium-vapor amber. CTAs, "lit" tags, brand mark |
| `lamp-300` | `#FFD08A` | Amber glow/highlight states, hover |
| `safe-500` | `#4ADE80` | "Lit & safe" segment color — cool green reads as calm/clear against navy |
| `caution-500` | `#E8590C` | "Caution" segment color — a true burnt orange-red, pulled well clear of `lamp-500` on the hue wheel so brand-amber and warning-orange never get confused on the map |
| `avoid-500` | `#E11D48` | "Avoid" segment color — deepened from an earlier rose (`#F43F5E`) to clear WCAG AA contrast at 4.5:1+ against `mist-100` text on the destructive button |
| `mist-100` | `#EDEFFB` | Primary text on dark surfaces |
| `mist-400` | `#9AA0C4` | Secondary text, metadata, timestamps |
| `day-050` | `#F6F5FA` | Day-mode background — pale cool-grey, not white (see Day Mode below) |
| `day-900` | `#181B34` | Day-mode primary text |

Segment colors (`safe-500`/`caution-500`/`avoid-500`) are reserved **only** for map/tag states — never reuse them decoratively elsewhere, or the map loses legibility.

**Color is never the only signal for a segment band.** `safe-500`/`caution-500`/`avoid-500` are far enough apart in hue to be distinguishable, but map lines are thin and small, so red-green color-vision deficiency (~8% of men) can still make them hard to tell apart at a glance. Every segment line on the map carries a second, non-color encoding:
- `safe-500` → solid line, standard weight
- `caution-500` → solid line, +1.5px weight (visibly thicker)
- `avoid-500` → dashed line, standard weight
This pairing (weight for caution, dash pattern for avoid) means the map is legible with color entirely removed.

## Typography

Three roles, deliberately not a single default sans stack:

- **Display — Space Grotesk.** Used for the wordmark, screen titles, and the segment-status band label ("LIT & SAFE"). It has a slightly mechanical, signage-like character — appropriate for something that behaves like street signage/wayfinding, not a lifestyle app.
- **Body — Inter.** Everything conversational: descriptions, onboarding copy, flow text. Chosen for legibility at small sizes in low-light phone use (high x-height, open apertures).
- **Data/Utility — JetBrains Mono.** Timestamps, tag counts, coordinates, "3 tags · 4h ago" metadata, contributor handles. A monospace face reads as *logged data* rather than *opinion* — reinforces that these are timestamped community reports, not editorial claims.

Never substitute a single system-default sans (e.g. plain Inter or Helvetica everywhere) across all three roles — the distinction between display/body/data is load-bearing for how trustworthy the data feels.

**Type scale** (consistent steps, not arbitrary sizes):

| Role | Size | Weight | Use |
|---|---|---|---|
| Display XL | 32px | 700 (Bold) | Screen-level titles, onboarding |
| Display | 24px | 700 (Bold) | Segment-status band label, section headers |
| Body Large | 18px | 500 (Medium) | Primary button labels, key flow copy |
| Body | 16px | 400 (Regular) | Default body text — never go smaller for body copy |
| Label | 14px | 500 (Medium) | Form labels, chip text, secondary controls |
| Data/Caption | 12px | 400 (Regular, JetBrains Mono) | Timestamps, metadata, tag counts only |

Line-height 1.5 for body copy, 1.3 for display/headings. 16px is the floor for anything read as sentence-level content — smaller sizes are reserved for the mono data role above, never for body prose.

## Iconography — Heroicons Solid only

Do not mix in Heroicons Outline, another icon set, or emoji. Solid weight only, for consistency and visibility in low-light/small-screen conditions.

| Concept | Icon |
|---|---|
| Well-lit segment | `light-bulb` |
| Dim/dark segment | `moon` |
| Safe rating | `shield-check` |
| Caution rating | `exclamation-triangle` |
| Avoid rating | `no-symbol` |
| Tag this street (primary CTA) | `map-pin` |
| Community/contributors | `users` |
| Flag a tag | `flag` |
| Time-of-day toggle | `sun` (day) / `moon` (night) |
| Recency/timestamp | `clock` |
| Okada/transport available | `truck` (closest available transit-adjacent glyph — confirm against final Heroicons set) |
| No sidewalk | `arrows-right-left` (path/crossing context) — pair with a label, don't rely on icon alone |
| Share route/segment | `share` |
| Filters | `adjustments-horizontal` |

Icons pair with a text label in every primary UI location. Never ship an icon-only control for a safety-critical action — see `DO_NOT.md`. Where an icon-only control is allowed at all (secondary controls only — map layer toggles, close buttons), it must carry an `aria-label` describing the action in plain language ("Close street detail," not "Close"), since there's no visible text for a screen reader to fall back on.

## Day mode

Flow A ("check before you walk," `PRD.md`) will get used constantly in bright daylight — checking your route home before you leave in the afternoon is a real, common case, not an edge case. A night-first `night-950` background under direct Nigerian sun glare is genuinely hard to read, so this is not optional polish.

- App chrome (background, cards, nav) switches between `night-950`/`night-800` (night/evening) and `day-050`/white-adjacent surfaces with `day-900` text (day), following the same day/night toggle already in the product (Flow A).
- **Segment band colors (`safe-500`/`caution-500`/`avoid-500`) and the line-weight/dash encoding stay identical in both modes** — the map's meaning must not shift with time of day, only the chrome around it.
- `lamp-500` amber remains the CTA/brand color in both modes; verify it against `day-050` for contrast (it's built for dark surfaces — confirm AA compliance on light backgrounds before shipping the day variant, may need a slightly deepened `lamp-600` for text-on-light use).
- Default mode follows device time, not user location sunrise/sunset data, to keep it simple in v1.

## Buttons

This is a low-light, one-handed, possibly-rushed usage context. Button sizing follows from that constraint, not aesthetic preference alone.

- **Primary CTA height: 56–64px minimum**, full-width or near-full-width on mobile. "Tag this street" and "I feel unsafe — flag" are the two buttons that must be reachable and tappable without precision.
- Corner radius: 16px — soft enough to feel calm, not so soft it reads as playful/toylike (this isn't a game).
- Primary button: `lamp-500` fill, `night-950` text (dark text on amber reads clearly and echoes lit-sign contrast).
- Destructive/avoid actions (e.g. flag as unsafe): `avoid-500` fill, `mist-100` text.
- Minimum tap target 48×48px on any icon-only secondary control (map layer toggles, etc.) — even though primary actions are much larger.
- No ghost/text-only buttons for primary actions. Low-light, quick-glance use punishes low-contrast controls.
- **Minimum 8px gap** between any two adjacent tap targets, to prevent mis-taps during rushed, one-handed use.

### Interaction states (previously unspecified — required for every button and tag chip)

| State | Treatment |
|---|---|
| Default | As specified above per button type |
| Pressed | Fill darkens ~10% (e.g. `lamp-500` → a step toward `lamp-600`), no layout shift — opacity/color change only, never a transform that moves the button |
| Focus (keyboard/switch control) | 3px solid `lamp-300` ring, 2px offset from the button edge, visible in both night and day mode — never remove focus rings for aesthetics |
| Disabled | 40% opacity, no pointer/tap response, `disabled` attribute set (not just visual) |
| Loading (async submit, e.g. tag submission) | Button stays at full size, label replaced with a small spinner using `lamp-300`; button is disabled for the duration — never let a second tap fire a duplicate submission |

## Responsive & layout

Mobile-first — this is a phone-in-hand product; desktop is a distant secondary target, not a parallel design.

- Breakpoints: 375px (small phone, design baseline) / 768px (tablet) / 1024px+ (desktop, map gets a persistent side panel instead of a bottom sheet).
- `viewport` meta: `width=device-width, initial-scale=1` — never disable pinch-zoom, it's an accessibility requirement, not a nicety.
- 8px spacing rhythm for all padding/gaps, scaling to 16/24/32/48 for section-level spacing — no arbitrary spacing values.
- No horizontal scroll at any breakpoint. Bottom sheet and map fill viewport width on mobile.
- Use `min-height: 100dvh` rather than `100vh` for full-height containers — avoids the mobile browser chrome resize jump.

## Feedback states (loading / empty / error / offline)

None of these existed in earlier drafts of this doc — they're required, not optional polish, given real-world network conditions this app will run under.

- **Map loading:** skeleton map (dimmed `night-800` placeholder with a centered spinner) — never a blank white/black screen while tiles load.
- **Segment with no tags yet:** bottom sheet shows "No reports yet — be the first to tag this street" with the primary "Tag this street" CTA surfaced immediately, not buried.
- **Tag submission error:** inline message directly under the submit button (not a top-of-screen banner disconnected from the action), stating what happened and offering retry — e.g. "Couldn't submit — check your connection and try again," with the button re-enabled.
- **Offline / poor connection:** this matters more here than in a typical brief — Nigerian mobile connectivity is inconsistent. A tag submitted with no connection should queue locally and show "Saved — will submit when you're back online," not fail silently or block the user.
- **Success feedback:** brief toast or inline checkmark flash (using `safe-500`) confirming a tag was recorded — under 2 seconds, non-blocking, doesn't require a tap to dismiss.

## Components — notes

- **Segment tag chip:** pill shape, colored by band (`safe-500`/`caution-500`/`avoid-500`), Heroicons Solid icon + JetBrains Mono count, e.g. `🛡 12`.
- **Bottom sheet (segment detail):** slides up from tap, `night-800` surface, rounded top corners 24px, drag handle visible.
- **Map style — concrete spec, not a general direction:** don't try to recolor default OSM raster tiles at runtime (this is a to-do, not a spec, and looks muddy in practice). Instead, self-host vector tiles (OpenMapTiles schema) and author a real dark style in Maputnik, or start from an existing open dark base style (e.g. a Stadia/MapTiler dark variant) and reskin its roads/land/water layers to the `night-950`/`night-800`/`mist-400` tokens above. Render with MapLibre GL JS. Roads should sit just barely above the `night-950` background (a step toward `night-800`), water even darker, so tagged segments — which use the far brighter `safe/caution/avoid` colors — are the clear visual foreground.

## Motion

Minimal and purposeful only:
- **Signature moment — light pool, not just a pulse.** Segments marked "lit & safe" render with a soft radial glow beneath the line itself (a wide, low-opacity `lamp-500` gradient), which breathes on a slow 2–3s ease-in-out cycle. This is deliberately more literal than a flat color pulse — it's the one place the streetlamp metaphor gets to be fully rendered rather than implied, and it should be the most visually memorable thing on the map. Caution/avoid segments get no glow — glow is reserved exclusively for "lit," so it stays meaningful. **Implementation note:** render the glow as a static pre-composited gradient sprite/layer and animate only its `opacity` (e.g. 0.4 → 0.7 → 0.4); do not animate `box-shadow` or `filter: blur()` directly, which is expensive to repaint on lower-end Android GPUs common in this market and will jank on a map with many lit segments visible at once.
- Standard 150–200ms transitions elsewhere (sheet open/close, button press).
- No decorative scroll animation, no parallax. Respect `prefers-reduced-motion` — render the glow as a static soft gradient with no breathing animation when set (don't remove it entirely; it's still meaningful information, just not animated).

## Design do-not list

- Do not use a generic warm-cream/terracotta or near-black/neon-green template palette.
- Do not use Heroicons Outline or mix icon sets.
- Do not use a single typeface for display, body, and data — the three-role split is intentional.
- Do not represent segment safety as a bare number in the primary UI — always a qualitative band with icon + color + label together (numeric detail can live in an expanded/data view only).
- Do not make any safety-critical control (tag, flag, "I feel unsafe") smaller than the 56px primary button spec.
- Do not use red (`avoid-500`) decoratively outside segment/tag states — it must stay meaningful.
- Do not encode segment band with color alone — line weight (caution) and dash pattern (avoid) must ship alongside color on every map render.
- Do not ship the app dark-only — day mode chrome is required before launch, since daytime checking is a real core flow, not an edge case. Segment colors and line encoding never change between modes; only chrome does.
- Do not recolor default OSM raster tiles at runtime as a substitute for an authored dark vector style — see Components note above.
- Do not extend the ambient glow to caution/avoid segments — it is reserved for "lit" only.
- Do not remove or hide focus rings for aesthetic reasons — the 3px `lamp-300` focus ring is required on every interactive element for keyboard/switch-control users.
- Do not animate `box-shadow` or `filter: blur()` for the glow or any other effect — opacity/transform only, to protect performance on lower-end devices.
- Do not let a tag submission fail silently on poor connection — queue and confirm, per Feedback States above.
- Do not go below 16px for body text, or below the type-scale table's sizes generally — the 12px mono role is reserved for data/metadata only, never for sentence-level content.
- Do not disable pinch-zoom in the viewport meta tag.
