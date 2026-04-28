# baseStyles Theme Source Conventions

> **Source of truth:** `beru-org/Assets` (private GitHub repo, default branch `main`).
> Extracted from `.cursor/rules/basestyles-conventions.mdc`, the V6 template at
> `Clients/template/Themes/blank-v6/`, the V6 master at
> `GoBasic/baseStylesV6/css/_variables.scss`, and a survey of all 113 themes
> across ~50 clients.
>
> This document is the contract the **Theme Customizer app** must understand,
> validate, and produce. When a customizer rule conflicts with anything here,
> this document wins.

---

## 1. Repository layout

```
beru-org/Assets/
├── .cursor/rules/basestyles-conventions.mdc   ← upstream conventions
├── GoBasic/
│   ├── baseStyles/        ← V5 framework (still imported by many themes)
│   ├── baseStylesV6/      ← V6 framework (current)
│   ├── 4SITGlobalDesign/  ← shared global stylesheets
│   ├── Applications/      ← shared JS modules
│   └── Plugins/
├── Clients/
│   └── <clientSlug>/
│       └── Themes/
│           └── <themeName>/
│               ├── css/
│               ├── fonts/
│               ├── gfx/        (optional)
│               ├── release/    (V6 only — production output, gitignored)
│               └── styles.xml
├── Makefile                 ← `make clean-themes <client>`
├── scripts/clean-themes.{sh,ps1}
└── README.md
```

Every theme lives at exactly:

```
Clients/<clientSlug>/Themes/<themeName>/
```

Two-segment depth under `Clients/`. The customizer's zip importer/exporter
must match this depth.

### Mac noise to ignore
Every directory in the repo contains `.DS_Store` files. The legacy importer
already filters these — keep them filtered everywhere (parse, validate,
export, search).

---

## 2. Three theme generations

The repo currently contains three coexisting generations. The customizer must
detect and handle all three, but should treat **V6 as the target** for all new
work.

| Generation | Identifier | Master file | Variable layout | Status |
|---|---|---|---|---|
| **V6** | folder name often ends in `-v6`/`V6`; `--theme-version: 6` in `:root` | `GoBasic/baseStylesV6/css/_variables.scss` | Single `css/_variables.scss` per theme | **Current. Use for new themes.** |
| **V5 (migrated)** | folder ends in `-v5` or no suffix; imports from `GoBasic/baseStyles/...` | `GoBasic/baseStyles/css/variables/_variables.scss` | Split: `css/variables/_overwritable-variables.scss` + many `css/variables/_<topic>.scss` | Legacy, supported. |
| **Pre-V5** | imports from `GoBasicV5/GoBasic.Web/Themes/_base-v5.1/...` (a *different* repo) | external | same split layout as V5 | Deprecated. Migrate. |

Detection priority for the customizer: read `css/theme.scss`, look at the
import paths.

* `GoBasic/baseStylesV6/` → V6
* `GoBasic/baseStyles/`   → V5 (migrated)
* `GoBasicV5/`            → pre-V5

If `css/_variables.scss` exists at the theme root and `css/variables/`
does **not** exist → V6.
If `css/variables/_overwritable-variables.scss` exists → V5/legacy.

---

## 3. V6 theme contract (target)

### Folder shape (template = `Clients/template/Themes/blank-v6/`)

```
<theme>/
├── css/
│   ├── theme.scss                       ← entry point
│   ├── _variables.scss                  ← THE customizable surface
│   └── fonts/
│       └── _fontAwesomev6.scss          ← FA loader (DO NOT include in client themes — see §3.4)
├── fonts/
│   ├── <font-family>/                   ← e.g. Zodiak-Variable.ttf, FiraSans-*, etc.
│   └── fontAwesomev6/                   ← optional; usually absent in V6 client themes
│       ├── fa-light-300.ttf
│       └── fa-light-300.woff2
└── styles.xml                           ← module-class registry
```

### 3.1 `css/theme.scss` (V6 canonical form)

```scss
// Theme: <Name>

// Importing Fundamentals Variables
@import '../../../../../GoBasic/baseStylesV6/css/variables.scss';

// Importing Theme Specific Variables
@import 'variables.scss';

// Importing Fundamentals Styles
@import '../../../../../GoBasic/baseStylesV6/css/imports.scss';
@import '../../../../../GoBasic/baseStylesV6/css/import-html-publication.scss';
```

* Five `../` segments from `<theme>/css/` reach repo root.
* SCSS partial syntax: file is `_variables.scss` on disk, imported as
  `variables.scss`.
* Order is significant: master variables first, then overrides, then styles.

### 3.2 `css/_variables.scss` (V6 customizable surface)

The single file every customizable token lives in. The V6 baseline is **~150
CSS variables** plus a handful of SCSS bridge variables.

**Required structure:**

```scss
/* --- Color by SCSS --- */
$color-brand-a: #342BA2;
$color-brand-b: #1B184D;
$color-brand-c: #FF9E7E;
$color-brand-d: #F2EEEC;
$color-brand-e: #FFF1EB;
$color-brand-f: #eeeef7;
$color-brand-g: #ffffff;

$grid-max-width: 1240px;

:root {
    --theme-version: 6;

    /* --- Colors --- */
    /* Identity Colors */
    --color-brand-a: #{$color-brand-a};
    /* … */

    /* Neutral Colors */
    --color-neutral-a: #252525;   /* darkest */
    /* … */
    --color-neutral-f: #ffffff;   /* lightest */

    /* … all other tokens (see §4) … */
}
```

**Hard rules (from upstream conventions doc):**

1. New variables must be added to **both** `GoBasic/baseStylesV6/css/_variables.scss`
   **and** `Clients/template/Themes/blank-v6/css/_variables.scss`. Variable
   counts must stay in sync.
2. SCSS bridge variables (`$color-brand-a`, etc.) exist **only** for
   `color-mix()` computations inside `:root`. They must not be used in
   component styles.
3. Use empty value with fallback when the default should inherit:
   `--var: ;` paired with `var(--var, inherit)` at the use-site.
4. `--theme-version: 6;` is required as the first declaration in `:root` for
   V6 themes.

### 3.3 `styles.xml` (module-class registry)

XML mapping CSS class names → which module types may use them.

```xml
<?xml version="1.0" encoding="utf-8"?>
<style>
  <classes>
    <group name="Design options">
      <class name="Hero with a text box" allow="HeroModule">text-in-box</class>
      <class name="Make the whole module link…" allow="MultiBoxModule">link-box</class>
    </group>
    <group name="Layouts options">
      <class name="Show as horizontal list" allow="LinkListModule">horizontal-list</class>
      <class name="Hide in mobile" allow="InnerGridModule,HeroModule">hide-in-mobile</class>
    </group>
    <!-- Color options, Media/icon options, Grid/spacing options,
         Typography options, Align options, Rich text link/button classes -->
  </classes>
</style>
```

* `allow` is a comma-separated whitelist of module types (`HeroModule`,
  `MultiBoxModule`, `LinkListModule`, `AccordionAndTabsModule`,
  `SpacerModule`, `InnerGridModule`, `WebPage*`, etc.).
* When a custom class is added in the customizer, it **needs an entry here**
  to be selectable in the CMS. The XML editor must enforce well-formed XML
  and prevent duplicate class names within a `<group>`.
* Changing a class affects every module listed in `allow` — surface this
  warning in the UI.

### 3.4 Font Awesome (V6)

* In V6, FA is provided centrally — **client themes must not bundle it**.
* Removal checklist when migrating a theme to V6:
  * Delete `@import "fonts/fontAwesomev6.scss";` from the theme.
  * Delete `<theme>/css/fonts/_fontAwesomev6.scss`.
  * Delete `<theme>/fonts/fontAwesomev6/` folder.
* The customizer's font management UI must hide / refuse to add Font Awesome
  for V6 themes.

### 3.5 nova-icons (V6)

`$include-nova-icons: 'true' | 'false';` is **not supported in V6**. The
customizer must strip it on V5→V6 conversion.

---

## 4. The V6 variable taxonomy

These are the categories that exist in the V6 master `_variables.scss` and the
template. The customizer's left-panel grouping should mirror these section
headers (they appear as `/* --- <Heading> --- */` comments in the SCSS).

### Colors
* **Identity** — `--color-brand-a` … `--color-brand-g` (7 brand slots).
* **Neutral** — `--color-neutral-a` (darkest) … `--color-neutral-f` (lightest).
  `--color-neutral-d/e` are derived via `color-mix(in oklch, …)` against
  `--main-bg-color`. `--color-neutral-e-hover` is a derived hover tint.

### Color combinations
Two parallel sets — **Light Background Tones** (default) and **Dark
Background Tones** (suffix `-bg-dark`). Every dark-tone variable has a
matching light-tone variable. Examples:
* `--font-base-color` ↔ `--font-base-color-bg-dark`
* `--button-background-color` ↔ `--button-background-color-bg-dark`
* `--icon-color` ↔ `--icon-color-bg-dark`
* `--label-background` ↔ `--label-background-bg-dark`
* `--module-heading-border-color` ↔ `--module-heading-border-color-bg-dark`
* `--universal-accent-color` ↔ `--universal-accent-color-on-bg-dark`

The customizer's contrast-checker should pair these and validate WCAG against
both surfaces.

### Typography
* **Sizes** — tokens `xsmall, small, normal, xnormal, medium, xmedium, large,
  xlarge, xxlarge`. Each token has both a `--font-<token>` size and a
  `--font-<token>-line-height` (pre-multiplied, e.g.
  `calc(var(--font-normal) * 1.5)`).
* **Always set together via `@include font-size($token)`** — do NOT set
  `font-size` and `line-height` separately.
* `xlarge`/`xxlarge` use `clamp()` for responsive sizing.
* Span-aware overrides: `--font-xlarge-size-span-1-9`,
  `--font-xxlarge-size-span-1-9` (used inside narrow grid spans).
* **Base** — `--font-base-family`, `--font-base-weight`.
* **Headings** — `--font-heading-family`, `--font-heading-weight`,
  `--font-heading-hyphens`. Per-level `--h1-font-family` … `--h6-font-family`,
  `--h1-font-weight` … `--h6-font-weight`, `--h1-text-transform` …
  `--h6-text-transform`. Defaulted to the heading family/weight; empty value
  for transform.
* **Pre-Heading**, **Lead**, **Links** — own family/weight/size set.

### Layout & Spacing
* `--grid-gutter-desktop`, `--grid-gutter-mobile`,
  `--grid-container-max-width` (mirrors SCSS `$grid-max-width`),
  `--grid-header-container-width`, `--grid-box-padding`,
  `--grid-box-padding-mobile`.
* `--universal-border-radius` (default `16px`).
* `--boxed-border-width`, `--highlighted-box-shadow`,
  `--module-heading-border-width`.

### Header / Body / Footer
`--header-container-padding`, `--header-background-color`,
`--body-bg-color`, `--main-bg-color`,
`--footer-background-color`, `--footer-heading-font-size`,
`--footer-heading-text-transform`, `--footer-heading-font-family`,
`--footer-heading-font-weight`.

### Navigation
* **Main** — alignment, background, container background, padding,
  borders, active-state height/color, font family/size/weight/transform/color,
  link gap and padding.
* **Burger** — background (+ hover), label/icon color (+ hover), border (+
  hover), dropdown link alignment/font-size/font-family.
* **Mega menu** — `--nav-mega-menu-heading-size`.
* **Service** — color, font weight/family/size/transform, plus button color
  set mirroring the universal button tokens.
* **Breadcrumb** — bg, padding, link color, label color, active color,
  divider color.
* **Left menu** — box shadow, border radius.
* **Search** — `--search-btn-border-radius`,
  `--search-btn-background-color` (+ hover via `color-mix`),
  `--search-text-color` (+ hover), `--search-icon-color` (+ hover).

### Buttons
`--button-universal-padding`, `--button-universal-text-transform`,
`--button-universal-font-size`, `--button-universal-font-weight`,
`--button-universal-font-family`, `--button-universal-border-radius`,
`--button-outline-border-size`, plus the `--link-arrow-text-*` set.

### Icons
`--icon-default-font-family` (`'Font Awesome 6 Pro'`),
`--icon-alternate-font-family` (`'Font Awesome 6 Sharp'`),
`--icon-default-font-size`, `--icon-font-weight`,
`--icon-small-font-size`, `--icon-background-size`,
`--icon-background-border-radius`.

### Labels, Forms, Multi-Section, Hero, HTML Publications
Each has its own bracketed group (see template file). Hero exposes ratio
tokens (`--hero-ratio-full-width`, `--hero-ratio-desktop`,
`--hero-ratio-mobile`, plus `--hero-split-box-ratio-*`) and headline clamps
(`--hero-h1-font-size: clamp(3rem, 7cqw, 6rem)`, etc.).

---

## 5. Mixins & framework rules (from `.cursor/rules`)

These constrain what the customizer may emit / accept inside any custom CSS
panel (e.g. expert-mode SCSS or the CSS-classes XML editor).

### Breakpoints
`@include breakpoint($point)` — defined in
`misc/mixins/_breakpoints-container.scss`.

| Token | Range |
|---|---|
| `xlarge` | ≥ 1240px |
| `large` | ≥ 1024px |
| `medium` | **768–1023px ONLY** (tablet only — *not* "tablet and below") |
| `small` | ≤ 767px |
| `xsmall` | ≤ 480px |
| `xxsmall` | ≤ 360px |
| `medium-small` | ≤ 1023px |
| `medium-xlarge` | ≥ 768px |

The customizer's expert-mode hint UI should call out the `medium` gotcha.

### Font sizes
Always `@include font-size($token)` — never raw `font-size` + `line-height`.
Tokens listed in §4.

### Color usage on background surfaces
When emitting `color` or `background-color` on any selector that may sit on a
colored surface, the value **must** come from a surface-aware variable
(`--text`, `--icon-fg`, `--heading`, `--border`, etc.) — never a hardcoded
literal. The framework's `surface-components()` mixin in
`baseStylesV6/css/misc/classes/_background-colors.scss` handles theme-aware
overrides; new components must register themselves there.

### Icons
The `small-icon()` mixin only handles sizing/layout — it does NOT set color.
Color rules need `background-color: transparent` and `color: var(--color-brand-a)`
as defaults. `circle-icon()` is the default for `.media i`.

### Transitions / animations
Use `@include transition(...)` and `@include transform(...)` from
`misc/mixins/_animations.scss` (they emit vendor prefixes for consistency).
`@include animate-all` = `transition: all 0.1s ease-in`.
Keyframes need WebKit duplicates (`@-webkit-keyframes` alongside `@keyframes`).

### Grid
* Structure: `.container > .row > .span-1` … `.span-12`.
* Gutters: `--grid-gutter-desktop`, `--grid-gutter-mobile`.
* At `medium-small`: every `.span-*` collapses to `width: 100% !important`.
* Nested grids must follow selector patterns in `misc/_grid.scss` or width
  rules silently fail.

### Cookie gating
Modules with `[required-cookies]` are `display: none` until `.cookieVisible`
is added (see `components/_module.scss`).

### Buttons in rich text
`<p>:has(> [class*='btn'])` becomes `display: flex; flex-wrap: wrap; gap` (in
`components/_buttons.scss`). Because `<p>` is now a flex container,
`text-align: center` does **not** work — alignment must use
`justify-content`. The customizer's rich-text alignment controls must emit
the flex form when targeting these `<p>` containers.

---

## 6. V5 / legacy theme contract

Kept here for round-trip support (parse → display → re-export without loss).

### Folder shape

```
<theme>/
├── css/
│   ├── theme.scss
│   ├── _imports.scss                      (V5; some themes use it as "barrel")
│   ├── _import-variables.scss             (newer "V5+" themes — barrel for variables/)
│   ├── _import-overwritable-variables.scss
│   ├── variables/
│   │   ├── _overwritable-variables.scss   ← user-facing customizable surface
│   │   ├── _colors.scss
│   │   ├── _typography.scss
│   │   ├── _grid.scss
│   │   ├── _header.scss
│   │   ├── _logo.scss
│   │   ├── _navigation-main.scss
│   │   ├── _navigation-service.scss
│   │   ├── _buttons.scss
│   │   ├── _search.scss
│   │   ├── _footer.scss
│   │   ├── _rounded-corners.scss
│   │   ├── _hero.scss            (some themes)
│   │   ├── _body.scss            (some themes)
│   │   ├── _boxed.scss           (some themes)
│   │   ├── _breadcrumb.scss      (some themes)
│   │   ├── _flowchart.scss       (some themes)
│   │   ├── _forms.scss           (some themes)
│   │   ├── _tool-section.scss    (some themes)
│   │   └── _best-variables.scss  (some themes — newer pattern)
│   └── custom/                   (optional, theme-specific overrides)
│       ├── _fonts.scss
│       ├── _identity-elements.scss
│       └── _link-list.scss
├── fonts/
│   ├── <font-family>/            (eot, ttf, woff, woff2 — all four)
│   └── fontAwesomev6/            (V5 keeps this locally; V6 doesn't)
├── gfx/                          (optional)
└── styles.xml
```

Webfonts in legacy themes ship in **all four formats**: `.eot`, `.ttf`,
`.woff`, `.woff2`.

### V5 `theme.scss` canonical form

```scss
// Theme: <Name>

@import "import-overwritable-variables.scss";
@import "import-variables.scss";

@import "../../../../../GoBasic/baseStyles/css/variables/variables.scss";
@import "../../../../../GoBasic/baseStyles/css/imports.scss";
@import "../../../../../GoBasic/baseStyles/css/import-html-publication.scss";

// then theme-specific custom rules / overrides
```

### `_overwritable-variables.scss` — the V5 customizable surface

Every customizable variable is an **SCSS variable** (not a CSS custom
property) with a `//CUSTOM DESCRIPTION:` trailing comment that the
customizer surfaces as the field label.

```scss
$color-a: #1E4F5C; //CUSTOM DESCRIPTION: Primary color
$color-b: #FFD596; //CUSTOM DESCRIPTION: Secondary background color

$font-base: 'Fira Sans', Sans-Serif; //CUSTOM DESCRIPTION: Body text fonts
$font-headings: 'General Sans', Sans-Serif; //CUSTOM DESCRIPTION: Heading fonts
$font-base-weight: 400; //CUSTOM DESCRIPTION: Font weight body text
$font-headings-weight: 600; //CUSTOM DESCRIPTION: Font weight headings

$universal-border-radius: 16px; //CUSTOM DESCRIPTION: Amount of rounded corners

$header-background-color: #F7F5F5; //CUSTOM DESCRIPTION: Header background color
$nav-main-background-color: #1E4F5C; //CUSTOM DESCRIPTION: Main navigation background color
$footer-background-color: #1E4F5C; //CUSTOM DESCRIPTION: Footer background color
```

**Rules for the customizer's V5 parser/exporter:**

1. The `//CUSTOM DESCRIPTION:` marker is the **only** thing that makes a
   variable user-editable. Variables without the marker are internal and must
   not appear in the UI.
2. The marker text becomes the field label. Trim whitespace; preserve case.
3. SCSS variable names use the `$color-a`–`$color-g` brand convention (legacy
   parallel of V6's `--color-brand-a`–`g`).
4. Round-trip: when re-exporting, preserve the original file order, blank
   lines, and section comments. Do not reorder.

### V5 → V6 migration rules (from README)

The customizer's "Convert to V6" action must:

1. Replace import path `../../../../../../GoBasicV5/GoBasic.Web/Themes/_base-v5.1`
   → `../../../../../GoBasic/baseStyles` (drops one `../` and changes folder).
2. Replace import path `../../../../../4SITGlobalDesign`
   → `../../../../../GoBasic/4SITGlobalDesign`.
3. Update Plugins paths: `Plugins/Src/<File>.js` → `Plugins/<File>.js`.
4. Delete `@import "fonts/fontAwesomev6.scss";`.
5. Delete `<theme>/css/fonts/_fontAwesomev6.scss` and the
   `<theme>/fonts/fontAwesomev6/` folder.
6. Strip any `$include-nova-icons: …;` line.
7. Collapse `variables/_*.scss` and `_overwritable-variables.scss` into a
   single `css/_variables.scss` using the V6 token names (map
   `$color-a`→`--color-brand-a`, `$font-base`→`--font-base-family`, etc.).
8. Add `--theme-version: 6;` as the first declaration inside `:root`.
9. Switch theme.scss imports to the V6 form (§3.1).

#### Contrast-pair resolution (one-shot, at conversion time)

V5 picked some surface colors at compile time using a Sass conditional:

```scss
@if (lightness($nav-main-background-color) > $contrast-ratio) {
  color: $nav-main-link-color !important;
} @else {
  color: $color-alternate !important;
}
```

`$contrast-ratio` defaults to `55`, and `$color-alternate` defaults to white.
V6 uses flat runtime CSS variables and has no equivalent — copying
`$nav-main-link-color` straight through makes links invisible whenever the
theme paints the nav background with the brand color (the EM theme is the
trigger case).

The converter resolves this conditional **once during V5 → V6 import**, in
`applyNavMainContrastPairs` (`client/src/lib/legacy-import-contrast.ts`,
re-exported from `legacy-import.ts` for back-compat), and writes
the visually-correct value into the V6 token. The currently-resolved pairs
are:

| V6 token                          | Light bg (`> 55`)               | Dark bg (`≤ 55`)                              |
| --------------------------------- | ------------------------------- | --------------------------------------------- |
| `--nav-main-link-color`           | `$nav-main-link-color`          | `$color-alternate` (default: white)           |
| `--nav-main-active-state-color`   | `$nav-main-active-state-color`  | `$nav-main-active-state-color-alternate`      |

This is **explicitly one-shot** — once the theme is in V6 it lives entirely
in V6 land, so editing `--nav-main-background-color` later in the customizer
does **not** auto-recompute the paired link/underline colors. A live "paired
token" affordance is a separate, future feature.

#### V5 base-defaults fallback (theme silence ≠ no value)

A V5 theme is allowed to be **silent** on any framework variable — the
upstream Sass build resolves silent variables to the `!default` value
declared in `GoBasic/baseStyles/css/variables/**`. The customizer, which
parses SCSS without invoking Sass, has to replicate that semantics or it
silently produces empty V6 values for anything the chosen theme didn't
restate.

The motivating example is the EM blank theme:

```scss
// beru-org/Assets:GoBasic/baseStyles/css/variables/_navigation.scss
$nav-main-border-top: 0 solid $color-gray-d !default;
// beru-org/Assets:GoBasic/baseStyles/css/variables/_colors.scss
$color-gray-d:        #ddd                  !default;
// blank theme overrides neither
```

A naive parse of the blank theme finds no `$nav-main-border-top`, so the
V6 output for `--nav-main-border-top` would be empty. The framework
default is what V5 actually shipped, and V6 must ship the same.

**Rule:** the converter merges every `!default` from the V5 baseStyles
framework UNDER the user's chosen V5 theme. Theme entries always win on
key collision; framework defaults only fill silence. Implementation:

* Snapshot lives in `client/src/lib/v5-base-defaults.json` (930 entries
  at time of writing — every `$var: value !default;` in
  `beru-org/Assets:GoBasic/baseStyles/css/variables/**`).
* Regenerate with
  `GITHUB_TOKEN=… npx tsx scripts/fetch-v5-base-defaults.ts` whenever
  the upstream framework changes.
* The merge happens once at the top of `applyMapping` in
  `client/src/lib/legacy-import-apply.ts`:
  `{ ...V5_BASE_DEFAULTS, ...themeVariables }`.
* `applyNavMainContrastPairs` (above) sees the merged map too, so the
  contrast-pair resolution also benefits from framework fallbacks.
* If a variable is genuinely absent from BOTH the theme and the
  framework, the converter still skips it — no junk emitted.
* Locked in by `scripts/verify-v5-base-fallback.ts`.

##### `notset` sentinel

131 of the 930 V5 framework defaults are the literal string `notset` —
V5's compiled CSS leaves the corresponding declaration out entirely so
the cascade default takes effect. The customizer mirrors that: a value
of `notset` (with or without surrounding quotes, including nested forms
like `"'notset'"`) drops the V6 declaration instead of emitting the
literal word `notset`. Themes can also explicitly set a variable to
`notset` to clear an override. The check is implemented in
`isNotSetSentinel` (`client/src/lib/legacy-import-utils.ts`) and is
applied:

* in `applyMapping` per-mapping pass — drops the variable if either the
  raw or the reference-resolved value is `notset`;
* in `applyNavMainContrastPairs` — bails on the bg check if the nav
  background resolves to `notset`, and skips `notset` entries in the
  contrast-pair fallback chain so the chain keeps walking.

---

## 7. Build & deploy pipeline

* Themes are committed as source SCSS only. Compilation happens in the CDN
  pipeline (Harbor image → `.replit.app` is not in play here).
* Local helper: `make clean-themes <clientName>` runs
  `scripts/clean-themes.sh` (or `.ps1` on Windows). Runs after pulling a
  client's themes off a server and before committing.
* CI workflows at `.github/workflows/Deploy{POC,Test,Silver,Gold}.yml` and
  `assets-docker-deployment.yml` package and ship.
* `.gitignore` excludes:
  * `**/node_modules/`
  * `Clients/**/Themes/*/Release/`
  * `**/theme.css`
  * `Clients/**/Themes/*/charts/`
  * `Clients/**/Themes/gruntfile.js`
* Commit message including `#image` triggers the image-build action.

The customizer's **export** must produce only source SCSS + `styles.xml` +
`fonts/` + (optional) `gfx/`. It must never include compiled `.css` or any
`Release/` folder.

---

## 8. What the customizer must enforce

These are the **app-level rules** derived from §1–§7. Each one maps to a
concrete behavior or test in this codebase.

### Parsing / import
1. Detect generation (V6 / V5 / pre-V5) from `theme.scss` import paths and
   from presence of `css/_variables.scss` vs. `css/variables/`.
2. For V5: only surface variables with a `//CUSTOM DESCRIPTION:` marker.
3. For V6: surface every CSS custom property declared in `:root` of
   `css/_variables.scss`, grouped by the `/* --- Section --- */` comments.
4. Always strip `.DS_Store`. Always preserve the
   `Clients/<client>/Themes/<theme>/` two-segment depth.

### Validation
5. Refuse to add Font Awesome to V6 themes.
6. Refuse to write `$include-nova-icons` in any theme.
7. Refuse a V6 theme that has no `--theme-version: 6;`.
8. `styles.xml`: well-formed XML, unique `<class>` text per `<group>`, valid
   module names in `allow`.
9. Variable counts in V6 themes should match the master count from
   `GoBasic/baseStylesV6/css/_variables.scss` — flag missing/extra tokens but
   do not auto-add (the upstream rules say new vars require a master update).

### UI grouping
10. Mirror the section headers (`/* --- Colors --- */`,
    `/* --- Typography --- */`, etc.) as the left-panel accordion groups, in
    the order they appear in the source file.
11. Pair every `*-bg-dark` variable with its non-dark sibling for the
    contrast checker.
12. Group typography token sets so changing a `--font-<token>` value visibly
    updates its paired `--font-<token>-line-height`.

### Export
13. Emit V6 themes in the canonical layout of §3 (`css/theme.scss`,
    `css/_variables.scss`, `styles.xml`, `fonts/` if any custom).
14. Preserve original file order, blank lines, and section comments on
    round-trip — the SCSS must remain human-diffable against `git`.
15. Never emit a `Release/`, `theme.css`, or `gruntfile.js`.
16. Default zip root layout: `Clients/<client>/Themes/<theme>/...` (allow
    overriding the client/theme names via the export modal).

### Conversion
17. The V5 → V6 converter must follow the eight steps in §6.
18. Round-trip a V6 theme through "convert legacy → re-export" should be a
    no-op (idempotent).

### Expert-mode hints
19. Surface the breakpoint-`medium` gotcha as a tooltip whenever a user
    types `@include breakpoint(medium)`.
20. Warn when a user writes a literal color in `color:` / `background-color:`
    on a selector that the framework's `surface-components()` mixin already
    covers — suggest the surface-aware variable instead.

---

## 9. Open questions for the upstream maintainer

These came up during extraction and may need confirmation:

* `Clients/cpr/Themes/CPR-V6` is named "V6" but its `theme.scss` still
  imports from `GoBasic/baseStyles` (V5) — is this an in-flight migration?
  Should the customizer label it as V5 or V6?
* `_best-variables.scss` appears in newer V5 themes (Alleroed-V2). Is this an
  intermediate "V5.5" pattern, or a one-off?
* The README's V5→V6 instruction says "point to v6 `baseStyles` folder"
  while the V6 template actually imports from `baseStylesV6`. Which is
  authoritative?
* `release/` folder appears in some V6 themes (e.g. `demo/blank-v6/`) but is
  excluded by `.gitignore`. Is it ever expected to be committed?
