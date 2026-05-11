# Theme Customizer — Technical Handover

A practical description of the GoPublic Theme Customizer app for developers porting it
into the GoPublic CMS. This document is written for engineers who have access to the
codebase; it explains **what the app does, how it is structured, what is essential, and
what is incidental**, so the rewrite can preserve behaviour without reproducing the
current implementation line-for-line.

For the underlying *theme format* the app produces and consumes, the source of truth is
[`docs/theme-source-conventions.md`](./theme-source-conventions.md). Read that first if
you are touching parsing, validation, export, or V5→V6 conversion.

---

## 1. What the app does (in one paragraph)

The Theme Customizer is a visual editor for GoPublic SCSS themes. A user loads a theme
(either an empty V6 starter, a V5 legacy theme they want to migrate, or an existing V6
theme they want to keep editing). The app parses the theme's SCSS, extracts ~200 CSS
custom properties, groups them into sections (Colors, Typography, Navigation, Buttons,
etc.), and renders an interactive control panel for each property type (color, font,
size, number, string). Edits are reflected in a **live HTML preview** of a real client
page, so designers can tune a theme against an actual site. When done, the user exports
a zip containing `css/_variables.scss`, `css/theme.scss`, `styles.xml`, and any custom
assets (fonts, graphics, JS, additional SCSS) — ready to drop into the
`beru-org/Assets` repo at `Clients/<client>/Themes/<theme>/`.

There is also a **batch converter** that takes a folder of V5 themes and outputs V6
versions in one pass.

---

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React)                           │
│                                                                    │
│  ┌──────────────┐  ┌────────────────────────┐  ┌──────────────┐    │
│  │ ControlPanel │  │  Page-level state in   │  │ PreviewPane  │    │
│  │  (left)      │←→│  theme-customizer.tsx  │←→│  (right)     │    │
│  └──────────────┘  │  - variables[]         │  └──────────────┘    │
│                    │  - scssFiles[]         │                      │
│                    │  - customFonts[]       │                      │
│                    │  - customGraphics[]    │                      │
│                    │  - jsFiles[]           │                      │
│                    │  - cssClassesData      │                      │
│                    │  - baseStylesV6 cache  │                      │
│                    └────────────────────────┘                      │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ fetch (JSON)
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                       SERVER (Express + tsx)                       │
│                                                                    │
│  /api/parse-scss       — extract CSS variables from SCSS           │
│  /api/compile-theme    — compile :root { --x: … } to CSS           │
│  /api/compile-full-theme — full SCSS → CSS via Dart Sass           │
│  /api/refresh-base-styles — fetch latest baseStylesV6 from GitHub  │
│  /api/fetch-preview    — server-side fetch+rewrite of preview HTML │
│  /api/parse-styles-xml / /api/export-styles-xml                    │
│  /api/sample-scss      — built-in starter variables                │
│  /api/google-fonts(-metadata) — Google Fonts directory             │
│  /api/proxy-js         — CORS proxy for preview-page scripts       │
└────────────────────────────────────────────────────────────────────┘
```

### Stack
- **Frontend**: React 18 + TypeScript + Vite. State is plain `useState` in the page
  component (`client/src/pages/theme-customizer.tsx`); React Query is present but
  barely used. UI is **shadcn/ui** (Radix primitives + Tailwind).
- **Backend**: Node.js + Express, written in TypeScript and run with `tsx` in dev,
  bundled with `esbuild` for production. The only heavy job the server does is **SCSS
  compilation** via the `sass` (Dart Sass) package; everything else is parsing strings.
- **Database**: Drizzle ORM is wired up but **not used** by the customizer itself. The
  `users` table in `shared/schema.ts` is scaffold from the Replit template. **The app is
  stateless** — nothing persists server-side. All theme data lives in the browser.
- **Routing**: Wouter on the client; Express on the server. There is exactly one
  page (`/`).

> **Implication for the CMS port:** treat the server purely as an SCSS-compile and
> GitHub-fetch helper. The "app" is really a single-page React tool with no auth, no
> sessions, and no persistence layer to migrate.

---

## 3. The single source of truth: the variable list

Everything the app does revolves around an array of `CSSVariable` objects held in page
state. Shape (from `client/src/components/theme-customizer/types.ts`):

```ts
interface CSSVariable {
  name: string;          // e.g. "--color-brand-a"
  value: string;         // current value, e.g. "#0066cc" or "var(--color-brand-a)"
  defaultValue: string;  // baseline; "modified" = value !== defaultValue
  type: 'color' | 'font' | 'size' | 'number' | 'string';
  category: string;      // legacy single-level grouping
  mainSection: string;   // current two-level grouping (left-panel section header)
  subSection: string;    // accordion sub-group within a section
  description?: string;
}
```

**Important properties of this model:**

1. `value` is a **raw CSS value string**, not a parsed object. It may be a hex color, a
   length (`16px`, `1.25rem`), a number, a font stack, or a `var(--x)` reference, or
   even a nested `color-mix(in srgb, var(--x) 60%, transparent)`. The UI lets users
   reference other variables, and that reference is stored verbatim.
2. `mainSection` / `subSection` are derived at parse time from SCSS comments in
   `_variables.scss` (`// === Colors ===`, `// --- Brand ---`). The convention is
   documented in `theme-source-conventions.md`. Without those comments the variables
   fall into "Other".
3. The `type` is **inferred** from variable name + value patterns (see
   `client/src/lib/legacy-import.ts` and the parser logic in `server/routes.ts`
   `/api/parse-scss`). The CMS port must preserve this inference so the right input
   component is chosen.

---

## 4. Component map

All theme-customizer components live in
`client/src/components/theme-customizer/`. The page (`pages/theme-customizer.tsx`,
~1500 lines) is the orchestrator; everything else is presentational with callbacks.

### Top-level layout
- **`theme-customizer.tsx`** — page. Holds all state, all callbacks, all file I/O. Tabs
  in the left panel switch between Variables / CSS Classes / Custom CSS / Custom JS /
  Custom Fonts / Custom Graphics. The right side is always the preview.
- **`ControlPanel.tsx`** — left panel container. Renders the section/sub-section
  accordion tree from the variables array, hosts the search field, and dispatches per-
  variable change/reset callbacks back to the page.
- **`VariableGroup.tsx`** — one accordion item per sub-section. Picks an input component
  based on `variable.type`.
- **`ActionBar.tsx`** — bottom bar with Reset / Export buttons and a "modified count".
- **`PreviewPane.tsx`** (~1000 lines) — the most complex component. See §6.

### Input components (one per variable type)
- **`ColorPicker.tsx`** — hex picker (react-colorful) + a "Reference" tab that lets the
  user point a derived variable at a base variable via `var(--…)`, optionally wrapped in
  `color-mix(...)` for transparency. Resolves multi-hop `var()` chains (up to 8 deep)
  for the swatch preview. Computes WCAG contrast against an optional background and
  shows a warning icon for AA-Large / Fail.
- **`FontPicker.tsx`** + **`GoogleFontPicker.tsx`** — Google Fonts directory picker.
  Falls back to a hardcoded top-300 list in `types.ts` if `/api/google-fonts` is
  unavailable.
- **`SizeInput.tsx`** — number + unit (`px`, `rem`, `em`, `%`, `vh`, `vw`).
- **`NumberInput.tsx`** — bare number with min/max/step; auto-tuned for font-weight
  variables (step 100, max 900) vs. line-height (step 0.1).
- **`StringInput.tsx`** — fallback for anything not otherwise typed.
- **`BorderInput.tsx`** — composite "width style color" for shorthand border vars.
- **`FamilyReferenceSelect.tsx`** / **`WeightReferenceSelect.tsx`** /
  **`LinkStyleSelect.tsx`** — variable-reference dropdowns used by specific variables
  (`--font-family-headlines: var(--font-family-secondary)`, etc.).

### Asset managers (each owns its own zip-export contribution)
- **`CustomCssManager.tsx`** — user-supplied SCSS files. Each file has `enabled: boolean`.
  Disabled files are written to the export but their `@import` is commented out in
  `theme.scss`, and the preview skips them. V5→V6 import defaults imported custom
  files to `enabled: false`.
- **`CustomJsManager.tsx`** — JS files exported to a `js/` folder. Default `enabled:
  false` (security: themes shouldn't auto-execute imported scripts).
- **`CustomFontsManager.tsx`** — `.woff2`/`.ttf` uploads. Stored as Blob + blob: URL
  for live preview; also emits `@font-face` rules for both preview (blob URLs) and
  export (relative paths). The page keeps blob URLs in sync via an effect, so legacy-
  imported fonts appear in the preview without the user opening the Fonts tab.
- **`CustomGraphicsManager.tsx`** — `gfx/` folder uploads (logos, SVGs). No CSS
  side-effects; just bundled in the zip.

### Editors
- **`CssClassesEditor.tsx`** — visual editor for `styles.xml`, which is the registry of
  utility classes the CMS exposes to editors. Outputs/parses
  `{ groups: [{ name, mode?, allowLinks?, classes: [{ name, className, allow?, deny? }] }] }`
  (type in `shared/schema.ts`).
- **`SimpleCodeEditor.tsx`** — lightweight textarea-based code editor used by the SCSS/
  JS managers. **Not** Monaco; deliberately small.

### Import / export modals
- **`LegacyImportModal.tsx`** (~900 lines) — drag-and-drop a V5 theme folder, see a
  preview of the V5→V6 mapping (which variables map cleanly, which clear V6 defaults,
  which need attention), then commit. The mapping logic lives in
  `client/src/lib/legacy-import*.ts`.
- **`BatchConvertModal.tsx`** — process many V5 themes at once via the File System
  Access API (Chrome only). Uses `client/src/lib/v5-batch-converter.ts`.
- **`ExportModal.tsx`** — final zip generation. Builds the
  `Clients/<client>/Themes/<theme>/` folder structure (see
  `theme-source-conventions.md` §1) with JSZip.

---

## 5. Key data flows

### 5.1 Loading a theme
1. On mount, the page calls `/api/sample-scss` (or, if a legacy import is in progress,
   reads the user's uploaded `_variables.scss` directly).
2. That SCSS is sent to `/api/parse-scss`, which:
   - strips comments,
   - finds `--*: …;` declarations in `:root` blocks,
   - infers the type from name/value patterns,
   - records the section/sub-section from the preceding `// === / // --- ` comments,
   - returns an array of `CSSVariable`.
3. The page stores that as both the working variables and a "defaults" baseline (so
   "modified" can be computed and Reset works per-variable, per-category, or globally).

### 5.2 Live preview update
1. User edits a variable → page state updates.
2. The page builds a tiny CSS string: `:root { --x: …; --y: …; }` plus the user's
   custom CSS, plus `@font-face` rules for custom fonts.
3. The CSS is **injected into the preview iframe** (see §6) — no server round-trip.

### 5.3 Export
1. User clicks Export → `ExportModal` collects a theme name + client slug.
2. The page:
   - re-emits `_variables.scss` from the variables array (preserving section comments),
   - assembles `theme.scss` with the correct `@import` for V6 baseStyles and the user's
     custom files (commenting out disabled ones),
   - serialises `styles.xml` from `cssClassesData`,
   - bundles fonts/graphics/js as raw bytes,
   - zips the lot via JSZip with paths matching the
     `Clients/<client>/Themes/<theme>/` convention,
   - triggers a browser download.

### 5.4 V5 → V6 conversion
This is the hardest part of the app. The mapping is **not** a flat rename; it is:

- Many V5 variables collapse into fewer V6 variables ("surface mixin" system).
- Some V5 variables have no V6 equivalent — they are dropped.
- Some V6 variables need to be **explicitly set to empty string** (`''`) to suppress the
  V6 default when the V5 theme had set them to `notset`. This is the
  "theme-explicit `notset` vs framework-default `notset`" distinction documented in
  §6 of the conventions doc. **The CMS port must preserve this**, otherwise V6 defaults
  silently leak in. Round-trip is guarded by `scripts/verify-v5-base-fallback.ts`
  fixtures J and K.
- A contrast-pair pass (`applyNavMainContrastPairs`) ensures dark-on-light/light-on-dark
  navigation variables stay consistent — this mirrors V5's compile-time `@if` overrides.

All of this is in `client/src/lib/legacy-import-apply.ts` (~600 lines). It is the
hottest file to read carefully during the port.

---

## 6. The preview pane

`PreviewPane.tsx` is large for a reason. It does the following:

1. **Fetches a real client page** via `/api/fetch-preview`, which:
   - downloads the HTML server-side (bypasses CORS),
   - rewrites `<link rel="stylesheet">` to absolute URLs,
   - removes the page's original theme stylesheet,
   - rewrites `<script src>` to go through `/api/proxy-js` (CORS).
2. **Injects the user's variables as inline `<style>` in `:root`** plus any custom CSS
   and `@font-face` rules. Updates incrementally on each edit (no full reload).
3. **Hosts an element inspector**: click-to-select an element in the preview, surfaces
   its computed CSS variables in the control panel and scrolls to them.
4. **Provides device/viewport switching** (mobile / tablet / desktop / custom) and
   **light/dark mode toggle** (toggles `data-theme` on the iframe `<html>`).
5. **Keeps the iframe mounted across left-panel tab switches** (`hidden` class instead
   of unmount) so the preview URL and scroll position are preserved.

**For the CMS port:** the preview can almost certainly be simplified. In the CMS, you
already control the page being rendered, you already control the stylesheet pipeline,
and you don't need a server-side proxy. The "inject a `:root` style block into the
iframe" trick is the only essential part — everything else is workarounds for
previewing pages from a different origin.

---

## 7. baseStylesV6 syncing

The V6 framework SCSS lives in `beru-org/Assets`, not in this repo. The customizer needs
it to compile full themes (when "Compile full SCSS" mode is used) and to know what the
V6 defaults are. To avoid pinning to a stale snapshot:

- `server/base-styles-fetch.ts` mirrors `GoBasic/baseStylesV6/` from GitHub on demand.
- `/api/refresh-base-styles` triggers a refresh; `/api/base-styles-status` reports
  when it was last refreshed.
- The header has a "Sync framework" button that calls refresh.

**For the CMS port:** if the CMS already has direct access to the Assets repo (it
should), this whole sync mechanism collapses to a filesystem read.

---

## 8. What you can drop or simplify in the port

| Current code | In the CMS port |
|---|---|
| Drizzle + `users` table | Drop. Not used. |
| Express server, route file (1650 lines) | Reduce to: SCSS compile endpoint + Assets-repo file reads. Most other endpoints become unnecessary inside the CMS. |
| `/api/fetch-preview`, `/api/proxy-js` | Drop. CMS renders its own pages; no CORS. |
| `/api/refresh-base-styles`, `base-styles-fetch.ts` | Replace with direct repo access. |
| Replit Vite plugins | Drop. |
| Wouter routing | Drop — there is one page. |
| JSZip-based export | Replace with whatever the CMS uses to write into the Assets repo (direct write, PR, etc.). |
| `LegacyImportModal` zip-upload UI | Keep the **mapping logic** (`legacy-import-apply.ts`); replace the UI if your CMS already has a theme-picker. |
| `BatchConvertModal` (File System Access API, Chrome-only) | Optional. Re-implement server-side if needed. |

### What you must keep faithfully
- The `CSSVariable` shape and the type-inference rules.
- `_variables.scss` round-trip: parse → edit → emit, with section/sub-section comments
  preserved.
- The V5→V6 mapping in `legacy-import-apply.ts`, **including the explicit-empty-string
  rule** for cleared V6 defaults.
- `styles.xml` round-trip (parse → edit → emit) with the
  `{ groups, classes, allow/deny }` schema in `shared/schema.ts`.
- The per-file `enabled` flag for custom SCSS/JS and its "comment out the @import"
  emit rule.
- The preview-time stylesheet injection (live edit without recompile).
- All the rules in `docs/theme-source-conventions.md` — those describe the *theme
  format*, not the app, and the format is the contract with the rest of the system.

---

## 9. File-level reading order for the porting team

If a developer is reading the codebase cold, here is the order that minimises
backtracking:

1. `docs/theme-source-conventions.md` — what a theme is.
2. `client/src/components/theme-customizer/types.ts` — the data model.
3. `client/src/pages/theme-customizer.tsx` — orchestrator; skim to see what callbacks
   exist and how state flows.
4. `server/routes.ts` (just the route signatures, not the bodies) — what the server
   actually does.
5. `client/src/lib/legacy-import-apply.ts` — V5→V6 mapping; the trickiest logic.
6. `client/src/components/theme-customizer/ExportModal.tsx` — how a theme is emitted.
7. `client/src/components/theme-customizer/PreviewPane.tsx` — live preview mechanics.
8. `client/src/components/theme-customizer/ColorPicker.tsx` — the most complex input
   (var() chain resolution, color-mix, contrast). Other input components are simpler
   variations of the same pattern.

Everything else is presentational and can be re-skinned freely in the CMS.

---

## 10. Known gotchas

- **Empty string ≠ unset.** A V6 variable explicitly set to `''` by the V5→V6 conversion
  must be suppressed from the emitted CSS (otherwise it overrides the framework default
  with an invalid value). This is enforced in three places: `PreviewPane` injection,
  server-side `generateCss`, and export-side `generateCssCustomProperties`. Keep all
  three.
- **`var()` chains.** A variable's value can point at another variable, which points at
  another, indefinitely. The color swatch resolver in `ColorPicker.tsx` walks the chain
  up to 8 hops with a self-reference guard. Any "what colour is this really?" logic in
  the CMS needs the same bounded recursion.
- **`color-mix(...)` transparency.** Derived color variables often look like
  `color-mix(in srgb, var(--color-brand-a) 60%, transparent)`. The picker parses this
  into `{ baseColor, percentage }` and re-emits it on slider changes. Round-trip parsing
  must be preserved.
- **`.DS_Store` files** must be filtered out everywhere — parse, validate, export, zip
  walk. The legacy importer already does this; do not regress.
- **Custom JS is disabled by default.** Both on legacy import and on new files. Do not
  flip this default — themes should never auto-execute scripts.
- **Section/sub-section comments in `_variables.scss` drive the UI grouping.** If the
  comments are missing or mangled, variables collapse into a single "Other" bucket.
  Preserve them when emitting; treat them as semantically meaningful, not decorative.

---

*Last updated: 2026-05-11.*
