# DESIGN.md: jgao.info

The personal site of Joseph Gao, a software engineer who builds the maps 9-1-1 uses to find people. Read this before changing how anything looks. The skills in `.cursor/skills/` (taste-skill, web-design-guidelines, apple-design) are the rules; this file is how they apply here.

## 1. Visual Theme & Atmosphere

A quiet reading page laid over a live contour map. The story runs from a Central Park tennis court to a Washington rowhouse, so the page reads like a well-set magazine feature about one career: large condensed names and years, a serif body with room to breathe, and hand-drawn artifacts and live demos instead of pictures.

- Density: low. One idea per screen, generous vertical rhythm (12vh to 24vh between chapters and sections).
- Personality lives in the content and the demos (Happy the Samoyed, hidden ducks, the dispatch map, the radar scope), never in ornament.
- No costume: no map-legend boxes, waypoint numbers, coordinates, sheet labels, hairline grids or monospace captions. The contour canvas is the only cartographic surface.

## 2. Color Palette & Roles

Every theme defines the same eight roles on `:root` / `[data-theme]`. Components only ever read the roles.

| Role | Survey (default) | Night shift | Use |
| --- | --- | --- | --- |
| `--paper` | `#e7ece9` | `#0d1820` | Page ground, nav bar, `theme-color` |
| `--ink` | `#15262a` | `#e3ebe8` | Text, primary buttons, toast surface |
| `--muted` | `#56686a` | `#8ea1a5` | Secondary text, captions, meta (always AA on paper) |
| `--contour` | `#c3cfca` | `#1a2c37` | Contour lines, quiet fills |
| `--contour-strong` | `#9fb1ab` | `#2d4654` | Index contours, planned route. Never text |
| `--signal` | `#2747d9` | `#6f97ff` | The one accent: links on hover, progress, active state |
| `--map-water` / `--map-land` | `#d3ddd9` / `#eff3f0` | `#09131a` / `#142531` | Demo maps and image placeholders |

Other themes: Hardcourt `#1c3a98` / `#ffd65a`, Roland Garros `#c4623a` / `#0f4b37`, Wimbledon `#1f4d31` / `#c5a8f0`, and the secret Duck pond `#0f3b3f` / `#ffcf33` (paper / signal). Dark themes set `color-scheme: dark`.

Tone steps instead of lines: raised controls use `color-mix(in srgb, var(--ink) 7%, var(--paper))`, hover goes to 13%.

## 3. Typography Rules

Two families, loaded from Google Fonts:

- Display: Bricolage Grotesque (variable `wdth` 75 to 100). Names, years, headings, UI.
- Body: Source Serif 4. Paragraphs, ledes, italic artifact captions.

| Level | Size | Weight / width | Used for |
| --- | --- | --- | --- |
| Hero | `clamp(84px, 17vw, 280px)` / 0.84 | 700, wdth 78, -0.035em | "Joseph Gao" |
| Display | `clamp(88px, 10vw, 156px)` | 700, wdth 78 | Rail year counter, "Say hello" |
| Section | `clamp(48px, 6.4vw, 92px)` / 0.92 | 700, wdth 80, -0.03em | Section titles, scoreboard numbers |
| Chapter | `clamp(34px, 4.2vw, 54px)` / 1.02 | 650, wdth 85 | Chapter titles |
| Item | `clamp(22px, 2.4vw, 30px)` | 600 to 650 | Workbench rows, toolbox, footer links |
| Lede | 22px / 1.55 | 400 | Hero and section ledes |
| Body | 19px / 1.6 (17px under 600px) | 400 | Running text |
| Secondary | 17px | 400 to 500 | Points, stats text, UI labels |
| Small | 15px | 400 | Dates, captions, tags, nav |
| UI micro | 13px | 500 | Only inside `data-ui` demos and `kbd` |

Rules: sentence case everywhere, no tracked uppercase labels, nothing readable under 13px, `tabular-nums` on every number that changes, `…` not `...`.

## 4. Component Stylings

- **Nav**: a plain solid bar on `--paper`. Wordmark, five section links (underline on hover), theme swatches, Menu button. No blur.
- **Links**: real `text-decoration: underline`, 1px (2px in the footer), `text-underline-offset: 0.2em`; hover moves to `--signal`.
- **Buttons**: pill, `--signal` or `--ink` fill, paper text. Secondary controls are tone-step pills (`.nav__search`, `.segmented`), never outlined.
- **Theme swatches**: 18px circles split diagonally into the theme's paper and signal colours as two flat fills. The active one gets a 1.5px ink outline with a 2px offset. Pressing it again goes back to the previous theme.
- **Chapters**: year, title, role, "dates, place", body, then artifact or demo, then topics as a plain comma-separated line. No photographs.
- **Toast** (duck finds): inverted filled surface (`--ink` ground, `--paper` text), no border or shadow.
- **Demos** (`DispatchMap`, `RadarScope`, `GisCatalog`, `CommandPalette`): real interface fragments with a `data-ui` root. Their rules are scoped with `:where([data-ui])`, and only they may keep borders, table rules and the palette shadow.

## 5. Layout Principles

- Max width 1240px, gutter `clamp(20px, 5vw, 64px)`.
- Timeline and section heads share a two-column grid: `minmax(240px, 0.85fr) minmax(0, 1.6fr)`. The left rail is sticky (year, place, chapter index, elevation profile); the right column carries everything you read. At 900px and below it collapses to `minmax(0, 1fr)`.
- Chapter text measure max 60ch; ledes 44ch.
- Separate with space, tone and scale. No dividers between stats or list rows.
- Every `[id]` has `scroll-margin-top: 72px` for the fixed nav.

## 6. Depth & Elevation

Flat. Surfaces differ by tone, not shadow. The only things that float are the command palette (scrim `rgb(4 10 14 / 0.45)` plus one soft shadow on its panel) and the skip link when focused. The contour canvas sits at `z-index: 0` behind everything.

The hero is the one exception: a 650svh pinned fly-through drawn on the same canvas (`src/lib/heroScene.js`). Scrolling moves a single camera (zoom, pitch and yaw, with a small mouse lean) through four acts, each with a one-line headline. First, the contour lines settle into rings around a tennis court, which inks in as thin accent-coloured lines while the camera swings round to a low court-side view, the court's length running across the screen. A rally plays out: the ball's arc and trail read from the side, Hawk-Eye-style marks ring where it lands, and the players swing through each shot as the camera dollies along the sideline. The lines then fade and the court holds for a beat as pure elevation rings, which relax into plain contours as the camera pulls back to the Manhattan street grid. Central Park is not labelled; it is recognised by its own landmarks (tree stipple, the drive loop and transverse roads, the Great Lawn, the Reservoir, the Lake, the Pond and the Harlem Meer in a water tint drawn from the accent), where a 9-1-1 call pin appears and a unit routes to it. Next the view pitches into 3D as the blocks rise and the tower X-rays down to the caller on Floor 23. Finally the city falls away and the camera flies into that floor, a cutaway office where an mmWave radar sweeps a point cloud and tracks three people by distance and speed. At the end the contour plane rises to that floor and takes its outline as the room fades, so the floor plan becomes elevation rings; they relax as the camera settles flat, while the timeline (overlapping the hero's last 40svh) rises into view over the same contour field the hero started on. The name is plain solid type on load. Under a mouse (or for a moment after a tap) a sensor window opens, but only inside the letters and only while the pointer is over the type: there the ink melts into contour rings that match the map, with a radar ping. The hero duck stays in the open beside the intro. The real text stays in the page (transparent) for selection and screen readers; with reduced motion it is plain type. On phones the theme switch is one swatch that opens a menu of every theme. With reduced motion the scene is skipped.

Fly-through rules:
- One headline per act, centred in a band at the top, rising out of a mask. No supporting copy. The scene is centred in the space below and scaled to fill it, and fades out before it reaches the headline band.
- Acts never overlap. Each act's objects leave before the next act's arrive. The camera follows a monotone spline, so it never overshoots and only rests at real holds.
- The map is figure-ground: block footprints on land, with Broadway cut through. The same footprints extrude into the buildings and sink back at the end. Building faces are shaded from the theme's paper and ink, so every theme gets its own city.
- Scene labels are few and factual (Central Park, 9-1-1 call, Floor 23, the radar's readings). They sit on the main canvas with a paper halo, step around the headline band and each other, and flip sides before they collide with the subject.
- Transitions are continuous, not crossfades: the contours become the court and take it back, and the Floor 23 band becomes the room the camera enters.

## 7. Do's and Don'ts

Do:
- Let scale, the artifacts and the demos fill space a removed ornament leaves.
- Keep one accent per theme (`--signal`) and use it for state.
- Respect `prefers-reduced-motion`: the contour field freezes, reveals and reels stop moving.
- Use springs and short eases (`cubic-bezier(0.22, 1, 0.36, 1)`), and animate only transform and opacity.
- Run `node .cursor/skills/taste-skill/scripts/lint.mjs src index.html` and `inspect.mjs` on `dist/index.html` before shipping.

Don't:
- Add eyebrows, sheet numbers, waypoint/elevation/coordinate micro-labels, hairlines, outlined boxes, monospace (outside a real `<pre>`), gradients, resting shadows, glass, or emoji as UI.
- Introduce a third typeface or a second accent.
- Add photographs or stock imagery.
- Use `transition: all`.

## 8. Responsive Behavior

- 1080px: section links hide; Menu (⌘K palette) carries navigation.
- 900px: the timeline rail hides, chapters get a 48px left column for the route, and section heads stack.
- 600px: body drops to 17px and the theme switcher collapses to the current swatch.
- Demos accept taps (`touch-action: manipulation`), and the hero hint swaps "Press ⌘K" for "Tap Menu".
- No horizontal scroll at 390px; inspect.mjs checks it.

## 9. Agent Prompt Guide

Quick reference: paper `#e7ece9`, ink `#15262a`, muted `#56686a`, signal `#2747d9`. Bricolage Grotesque condensed for display, Source Serif 4 for body at 19px.

Prompts:
- "Add a section in the jgao.info style: condensed Bricolage title at section size in the left column, a 22px muted serif lede in the right, content below with no dividers or cards."
- "Add a demo: give its root `data-ui`, scope any borders with `:where([data-ui])`, keep its text at 13px or larger, and make it work with taps."
