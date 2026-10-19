# Visual system

The v2 interface was redesigned a second time as a pure front-end pass: no API, database, auth, booking, organizer or AI-service
code changed. Components keep their data contracts; only markup that had to change (event cards, event detail, the new vibe picker,
header/footer) and the stylesheets were rewritten.

**Direction.** Arabic-first cultural-festival programme: bold Kufic headlines, flat colour fields, poster-style event cards and a
"lineup" list for dates. It is an interpretation of the brief's principles (editorial layouts, expressive type, vibrant imagery),
not a copy of any reference. The brief named a Dribbble shot, but no reference images were attached and the shot itself could not
be reached while building, so nothing was matched against it.

## Palette (from the original logo)

| role | value |
|---|---|
| Ink (text, outlines, dark fields) | `#25122f` |
| Paper | `#f5eefc` |
| Action violet (buttons) | `#5a2fd1` |
| Logo pink / saffron / sky / lavender | `#fd84b4` / `#feb96c` / `#72abfe` / `#ab88fc` |

Each category owns a flat poster palette (field, large shape, accent) in `lib/categories.ts`. Text on every poster field uses ink or
off-white chosen per palette. Gradients are not used; colour changes are floods (hover, selected vibe).

## Type

- Display: **Kufam** (variable, weights 700–900) for headlines, day numerals and prices.
- UI and reading: **IBM Plex Sans Arabic**. Both are self-hosted through `@fontsource`, so no request leaves the site for fonts.
- Latin digits and Gregorian dates are kept (Asia/Riyadh).

## Signature elements

- **Hero**: the original Madinah video, full-bleed, under a flat ink veil. Headline lines rise once on load; the video drifts slightly on
  scroll where the browser supports scroll-driven animations. The header floats over it and turns solid after 24 px of scroll.
- **Posters**: imageless events get one of six original flat compositions (arches, sun and hills, bands, arcs, minarets, quarter tiles),
  picked deterministically from the title and coloured by category. Real photos are left untouched.
- **Lineup rows**: day numeral, title in display type, perforated divider, thumbnail; hover floods the row with the category colour.
- **"وش مزاجك؟"**: six moods and a time chip send a plain-Arabic query to the same `/api/search` endpoint as the search box. Results are
  the real ranked events with their match reasons; picking a mood recolours the section.
- **Ticket**: after booking, the ticket prints in (clip reveal) and the confirmation stamps. The booking itself is the existing API call.

## Responsive behaviour

Checked with real screenshots at 1360, 820 and 390 px. Below 720 px lineup rows put the poster on top, and poster grids become
snap-scrolling shelves; there is no horizontal page scroll (an e2e test asserts it on key pages).

## Accessibility evidence

- axe-core (WCAG 2.0/2.1 A and AA rules) reported no violations on nine desktop pages: home, events, map, login, event detail, account,
  organizer dashboard, demand gaps and the event form. Automated rules cover only part of WCAG; there was no screen-reader pass.
- Keyboard: skip link, visible focus ring on every control tabbed through, vibe picker works with Enter. `prefers-reduced-motion`
  pauses the video and removes the entrance animation (checked).
- Motion that is not triggered by the user is limited to the one-off headline entrance and the live-dot pulse.
