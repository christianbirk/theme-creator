/**
 * The V5 → V6 conversion pass: takes parsed V5 SCSS variables + the CSV
 * mapping and produces an array of V6 CSS-variable assignments.
 *
 * Lives in its own module (separate from `legacy-import.ts`) because
 * `legacy-import.ts` carries a Vite-only top-level import for the
 * mapping CSV (`?raw`). Keeping `applyMapping` here means node-only
 * verification scripts in `scripts/` can import and exercise the real
 * conversion logic without needing a Vite loader.
 */

import {
  ParsedScssVariables,
  extractHexValue,
  firstTopLevelToken,
  isNotSetSentinel,
  resolveVariableReference,
  wrapScssArithmeticInCalc,
} from './legacy-import-utils';

/**
 * V6 variables whose values are consumed in a single-axis context
 * (e.g. `padding-top: var(--header-container-padding)`) but whose V5
 * counterparts were defined as multi-axis shorthands like `32px 0`. When
 * importing, we reduce those values to their first top-level token so
 * the V6 declaration receives a valid single value.
 *
 * Add a new entry whenever you find another V5 var that was a shorthand
 * but is split into separate axes in baseStylesV6. Verify by checking
 * how the variable is referenced in `server/sample-scss/variables.scss`
 * and the corresponding V6 SCSS partials.
 */
const SINGLE_AXIS_V6_VARS = new Set([
  '--header-container-padding',
]);

/**
 * V5 stored aspect-ratio values as space-separated numbers (`16 9`, `2 1`)
 * — a SCSS shorthand the framework converted at compile time. V6 uses the
 * native CSS `<ratio>` syntax with a slash (`16/9`). Normalize on import
 * so the V6 variable receives valid CSS:
 *   `16 9`         → `16/9`
 *   `2 / 1`        → `2/1`
 *   `calc(16 / 9)` → `16/9`
 *   `16/9`         → `16/9` (unchanged)
 * Single-number ratios (`1.778`) and anything containing `var(…)` or
 * non-numeric tokens are passed through untouched.
 */
function normalizeAspectRatio(value: string): string {
  const v = value.trim();
  // Already slash form, possibly with stray whitespace around the slash.
  let m = v.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (m) return `${m[1]}/${m[2]}`;
  // Space-separated V5 shorthand.
  m = v.match(/^([\d.]+)\s+([\d.]+)$/);
  if (m) return `${m[1]}/${m[2]}`;
  // calc(N / M) form.
  m = v.match(/^calc\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)$/);
  if (m) return `${m[1]}/${m[2]}`;
  return value;
}

const RATIO_VAR_RE = /-ratio($|-)/i;

/**
 * V6 variable names whose values are CSS lengths. Used to decide whether
 * a bare `0` from V5 should be emitted as `0px` so it stays a valid
 * length token in `calc(...)` and other contexts where mixing units
 * with unitless numbers is illegal CSS.
 *
 * Intentionally narrow — covers the common length-bearing suffixes but
 * leaves `weight`, `opacity`, `z-index`, and ratios alone (those are
 * legitimately unitless).
 */
const LENGTH_VAR_NAME_RE =
  /-(height|width|size|padding|margin|radius|spacing|gap|inset|offset|top|bottom|left|right)($|-)/i;

/**
 * V6 has hardcoded `var(--foo, <fallback>)` fallbacks in its CSS — for
 * example `border-color: var(--label-border-color, var(--color-neutral-d))`.
 * That means simply leaving the var empty doesn't suppress the visual
 * (the fallback fires). When V5's source said `notset` for a
 * border-color (semantically: "no border"), we have to actively emit
 * `transparent` so the var() lookup succeeds and the fallback is
 * bypassed. For non-color-shorthand borders the right value would be
 * different (`0 solid transparent`), so this regex deliberately covers
 * only the bare *-color names.
 */
const BORDER_COLOR_VAR_NAME_RE = /-border(-color(-bg-dark)?)$/i;

/**
 * Decide how to clear a V6 variable when the V5 source resolved to
 * notset. Most variables go into the `cleared` list (the consumer
 * blanks them in the UI and skips them at preview-injection time),
 * but border-color vars need an explicit `transparent` so they
 * defeat V6's inline `var(…, fallback)` defaults.
 */
function clearOrSuppress(
  cssVariable: string,
  result: { name: string; value: string }[],
  cleared: string[],
): void {
  if (BORDER_COLOR_VAR_NAME_RE.test(cssVariable)) {
    result.push({ name: cssVariable, value: 'transparent' });
  } else {
    cleared.push(cssVariable);
  }
}

/**
 * V5 hero-split-box ratios that flowed through the `maintain-after-ratio`
 * mixin, whose formula is `padding-top = (H / W * 2) * 100%`. That doubles
 * the height relative to the width, so a V5 ratio of `(W H)` actually
 * produces a CSS aspect-ratio of `W / (2H)`. The V5 mobile split-box
 * ratio uses the regular `maintain-ratio` mixin (no doubling), and the
 * non-split hero ratios use the `aspect-ratio` mixin (also no doubling).
 *
 * Source: GoBasic/baseStyles/css/misc/mixins/_aspect-ratio.scss
 */
const SPLIT_BOX_DOUBLED_V5_VARS = new Set([
  '$hero-split-box-ratio',
  '$hero-split-box-ratio-full-width',
]);
import { applyNavMainContrastPairs } from './legacy-import-contrast';
import v5BaseDefaultsJson from './v5-base-defaults.json';

/**
 * Snapshot of every `$var: value !default;` from the V5 baseStyles
 * framework (beru-org/Assets:GoBasic/baseStyles/css/variables/**). The
 * `applyMapping` pass merges this map *under* the user's chosen V5 theme
 * so any V5 source variable not overridden by the theme still resolves
 * to the value V5 would have used at compile time. Regenerate via
 * `npx tsx scripts/fetch-v5-base-defaults.ts`.
 */
export const V5_BASE_DEFAULTS: ParsedScssVariables =
  v5BaseDefaultsJson as ParsedScssVariables;

export interface ScssVariableMapping {
  cssVariable: string;
  scssVariable: string;
  note: string;
}

/**
 * Convert SCSS variable references in a value to CSS variable references.
 * Used for values that couldn't be resolved to literals (e.g. multi-token
 * shorthands like `1px solid $color-a`).
 */
export function convertValueScssVarsToCss(
  value: string,
  scssToCssMap: Map<string, string>,
): string {
  return value.replace(/\$[a-zA-Z0-9_-]+/g, (scssVar) => {
    const cssVar = scssToCssMap.get(scssVar);
    if (cssVar) {
      return `var(${cssVar})`;
    }
    // Same V5-spacing-convention fallback as in resolveVariableReference,
    // applied here for compound values (e.g. `$space-40 24px 32px 24px`).
    // resolveVariableReference short-circuits on values containing spaces,
    // so the per-token replacement below is the only place where tokens
    // inside a compound value get a chance to be normalised.
    const spaceMatch = scssVar.match(/^\$space-(\d+)$/);
    if (spaceMatch) return `${spaceMatch[1]}px`;
    return scssVar;
  });
}

export interface ApplyMappingResult {
  mapped: { name: string; value: string }[];
  /**
   * V6 CSS-variable names that were explicitly cleared by the V5 theme
   * (the theme set the source variable to `notset`, or chained to a value
   * that resolves to `notset`). Distinct from variables that simply
   * inherited a `notset` framework default while the theme stayed silent
   * — those just fall through to the V6 cascade default and are not
   * surfaced here. Consumers should use this list to override their own
   * V6 defaults with empty values so the user sees the variable as
   * intentionally unset rather than a leftover V6 default.
   */
  cleared: string[];
}

export function applyMapping(
  scssVariables: ParsedScssVariables,
  mappings: ScssVariableMapping[],
): ApplyMappingResult {
  // Capture which SCSS variables the theme explicitly set BEFORE we merge
  // in V5 base defaults. We use this below to suppress emission of certain
  // V6 variables that have known-better defaults than V5's literal values
  // — e.g. `$button-outline-border-color: $color-gray-d` (V5 framework
  // default = #ddd light gray) was always overridden at compile time by
  // V5's surface mixin (which baked the surface contrast color into
  // `.bg-color-* .btn-outline { box-shadow: inset 0 0 0 1px <color> }`).
  // V6 has no such compile-time surface overrides — instead it relies on
  // CSS-variable-driven surface tokens, with `--button-outline-border-color`
  // defaulting to `var(--color-brand-a)`. Re-emitting V5's #ddd literal
  // overrides V6's smarter default and produces an almost-invisible border.
  const userOverrides: Set<string> = new Set(Object.keys(scssVariables));

  // Merge V5 base defaults UNDER the user's chosen theme so any V5 source
  // variable not overridden in the theme still resolves to the value V5
  // would have used at compile time. Theme entries always win on key
  // collision. The merged set is used everywhere below — for reference
  // chain resolution, hex collection, and the per-mapping pass — so a V5
  // theme that's silent on (e.g.) `$nav-main-border-top` still produces
  // a valid V6 `0 solid var(--color-neutral-d)` instead of an empty
  // value. See docs/theme-source-conventions.md.
  const merged: ParsedScssVariables = { ...V5_BASE_DEFAULTS, ...scssVariables };
  scssVariables = merged;

  // V6 vars whose framework default is preferable to V5's literal default
  // when the theme is silent. See `userOverrides` block above.
  const PREFER_V6_DEFAULT_WHEN_SILENT: Set<string> = new Set([
    '--button-outline-border-color',
    // V5 default `$hero-aspect-ratio-full-width: $hero-aspect-ratio` (=
    // calc(16/7)) was just an alias of the desktop ratio. V6 redesigned
    // full-width heroes with a wider 16/5 default — keep that when the
    // theme didn't explicitly set the V5 var.
    '--hero-ratio-full-width',
    // V5 default `$icon-font-size: 50px` was sized for the older circle
    // icon design; V6 redesigned it tighter at 32px. Themes that didn't
    // explicitly customise the V5 var should adopt the V6 default.
    '--icon-default-font-size',
  ]);

  const result: { name: string; value: string }[] = [];
  const cleared: string[] = [];

  // Build a map from SCSS variable names to CSS variable names for reference conversion
  // Use the FIRST match found (most direct/generic mapping) rather than the last
  // e.g., $color-a should map to --color-brand-a, not --label-color-bg-dark
  const scssToCssMap: Map<string, string> = new Map();
  for (const mapping of mappings) {
    if (!scssToCssMap.has(mapping.scssVariable)) {
      scssToCssMap.set(mapping.scssVariable, mapping.cssVariable);
    }
  }

  // First pass: collect all color variables (--color-brand-*) and their HEX values
  // This allows us to replace hardcoded HEX values with variable references
  const hexToColorVar: Map<string, string> = new Map();
  for (const mapping of mappings) {
    if (mapping.cssVariable.startsWith('--color-brand-')) {
      let rawValue = scssVariables[mapping.scssVariable];
      if (!rawValue) continue;

      rawValue = resolveVariableReference(rawValue, scssVariables);
      const hexValue = extractHexValue(rawValue);
      if (hexValue && hexValue.startsWith('#')) {
        hexToColorVar.set(hexValue.toLowerCase(), mapping.cssVariable);
      }
    }
  }

  for (const mapping of mappings) {
    let rawValue = scssVariables[mapping.scssVariable];

    if (!rawValue) continue;

    // Skip variables containing "span" - these are internal/deprecated
    if (mapping.cssVariable.toLowerCase().includes('span')) {
      continue;
    }

    // Suppress vars where V6's framework default is preferable to V5's
    // literal default, when the theme didn't explicitly override the V5
    // variable. See PREFER_V6_DEFAULT_WHEN_SILENT for the rationale.
    if (
      !userOverrides.has(mapping.scssVariable) &&
      PREFER_V6_DEFAULT_WHEN_SILENT.has(mapping.cssVariable)
    ) {
      continue;
    }

    // V5 `notset` sentinel — fall back to the V5 framework base default
    // when one exists with a real value (so a theme that explicitly says
    // notset uses V5's base, mirroring what V5 would have compiled).
    // When the base default is also notset (or absent), V5's intent is
    // "this variable is intentionally unset" — and we honour that even
    // if the theme itself was silent (i.e. only the framework default
    // says notset). Otherwise V6's framework default would silently
    // appear (e.g. `--label-border-color: var(--color-neutral-d)` when
    // V5's `$label-border: notset !default` meant "no border").
    if (isNotSetSentinel(rawValue)) {
      const baseDefault = V5_BASE_DEFAULTS[mapping.scssVariable];
      if (baseDefault && !isNotSetSentinel(baseDefault)) {
        rawValue = baseDefault;
        // Fall through to normal processing using the V5 base default
      } else {
        clearOrSuppress(mapping.cssVariable, result, cleared);
        continue;
      }
    }
    // If the V5 value is a single SCSS variable that has its own V6
    // mapping, preserve it as var(--v6) instead of resolving to the V5
    // literal. Keeps the theme's references intact: e.g. a theme that
    // wrote `$nav-main-link-font-size: $font-normal` lands in V6 as
    // `--nav-main-link-font-size: var(--font-normal)`, so adjusting
    // --font-normal in the customizer still updates the nav font size.
    const trimmed = rawValue.trim();
    const directRef = /^\$[a-zA-Z0-9_-]+$/.test(trimmed) ? scssToCssMap.get(trimmed) : undefined;
    if (directRef) {
      rawValue = `var(${directRef})`;
    } else {
      rawValue = resolveVariableReference(rawValue, scssVariables);
      if (isNotSetSentinel(rawValue)) {
        // Same reasoning as above: if the resolved value is notset
        // (via a reference chain), V5's intent is "unset" — clear the
        // V6 var instead of letting V6's default leak through.
        clearOrSuppress(mapping.cssVariable, result, cleared);
        continue;
      }
    }

    let finalValue = rawValue;

    // If the value still contains SCSS variable references, convert them to CSS variables
    if (finalValue.includes('$')) {
      finalValue = convertValueScssVarsToCss(finalValue, scssToCssMap);
    }

    // SCSS allowed `rgba($color-or-hex, 0.1)` — Sass parsed the color
    // at compile time and produced a literal rgba(R, G, B, A) for CSS.
    // After our $-to-var conversion the same expression survives as
    // `rgba(var(--…), 0.1)` (or `rgba(#…, 0.1)`), which is **invalid
    // CSS** — the browser silently drops the declaration. Rewrite both
    // forms to `color-mix(in srgb, <color> <pct>%, transparent)`, which
    // is the modern CSS equivalent and works with var() colors.
    finalValue = finalValue.replace(
      /rgba\(\s*(var\(\s*--[a-zA-Z0-9_-]+\s*\)|#[0-9a-fA-F]{3,8})\s*,\s*(\d*\.?\d+%?)\s*\)/g,
      (_, color: string, alpha: string) => {
        const pct = alpha.endsWith('%')
          ? alpha
          : `${(parseFloat(alpha) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
        return `color-mix(in srgb, ${color} ${pct}, transparent)`;
      },
    );

    // SCSS `lighten($color, X%)` / `darken($color, X%)` were compile-time
    // operations in V5 that don't have CSS equivalents. Translate them
    // into `color-mix()` so the V6 export still renders. Approximation:
    // `lighten(c, X%)` ≈ blend X% white into c; `darken(c, X%)` ≈ blend
    // X% black into c. Uses oklab so the perceived shift roughly tracks
    // Sass's HSL-based lightness adjustment without round-tripping through
    // a colour parser.
    finalValue = finalValue.replace(
      /\b(lighten|darken)\(\s*(var\(\s*--[a-zA-Z0-9_-]+\s*\)|#[0-9a-fA-F]{3,8})\s*,\s*(\d*\.?\d+%?)\s*\)/g,
      (_, fn: string, color: string, amount: string) => {
        const pct = amount.endsWith('%') ? amount : `${amount}%`;
        const mixWith = fn === 'lighten' ? 'white' : 'black';
        return `color-mix(in oklab, ${color}, ${mixWith} ${pct})`;
      },
    );

    if (mapping.note.toLowerCase().includes('take only hex value')) {
      finalValue = extractHexValue(rawValue);
    }

    // V5's `$arrow-appearance` had three values: 'left', 'right',
    // 'underline'. V6 collapses these to two — `arrow` (the side is
    // configured separately via positioning vars) or `underline`.
    // Map left/right → arrow; underline stays the same. V6 expects
    // lowercase, unquoted.
    if (
      mapping.note.toLowerCase().includes('arrow appearance') ||
      mapping.cssVariable.includes('link-style')
    ) {
      const cleanValue = rawValue.toLowerCase().replace(/^['"]|['"]$/g, '');
      if (cleanValue === 'left' || cleanValue === 'right') {
        finalValue = 'arrow';
      } else if (cleanValue === 'underline') {
        finalValue = 'underline';
      }
    }

    if (
      mapping.note.toLowerCase().includes("if 'true' use") ||
      mapping.note.toLowerCase().includes('if true use')
    ) {
      // Strip quotes from boolean values
      const cleanValue = rawValue.toLowerCase().replace(/^['"]|['"]$/g, '');
      if (cleanValue === 'true') {
        const useMatch = mapping.note.match(/use\s+(--[a-zA-Z0-9-]+)/i);
        if (useMatch) {
          finalValue = `var(${useMatch[1]})`;
        }
      } else if (cleanValue === 'false') {
        // If false, leave empty (inherit from default)
        finalValue = 'inherit';
      }
    }

    // For non-color variables, check if the HEX value matches a color variable
    // and use the variable reference instead of hardcoded HEX
    if (!mapping.cssVariable.startsWith('--color-brand-')) {
      const hexMatch = finalValue.match(/#[a-fA-F0-9]{3,8}/);
      if (hexMatch) {
        const normalizedHex = hexMatch[0].toLowerCase();
        const colorVar = hexToColorVar.get(normalizedHex);
        if (colorVar) {
          finalValue = finalValue.replace(hexMatch[0], `var(${colorVar})`);
        }
      }
    }

    // Convert color keywords to CSS variable references
    const colorKeywordMap: Record<string, string> = {
      white: 'var(--color-neutral-f)',
    };
    const cleanColorKeyword = finalValue.toLowerCase().replace(/^['"]|['"]$/g, '');
    if (colorKeywordMap[cleanColorKeyword]) {
      finalValue = colorKeywordMap[cleanColorKeyword];
    }

    // Convert font size keywords to CSS variable references
    const fontSizeMap: Record<string, string> = {
      'x-small': 'var(--font-xsmall)',
      small: 'var(--font-small)',
      normal: 'var(--font-normal)',
      'x-normal': 'var(--font-xnormal)',
      medium: 'var(--font-medium)',
      'x-medium': 'var(--font-xmedium)',
      large: 'var(--font-large)',
      'x-large': 'var(--font-xlarge)',
      'xx-large': 'var(--font-xxlarge)',
      'xxx-large': 'var(--font-xxxlarge)',
    };
    const cleanFontSize = finalValue.toLowerCase().replace(/^['"]|['"]$/g, '');
    if (fontSizeMap[cleanFontSize]) {
      finalValue = fontSizeMap[cleanFontSize];
    }

    // Normalize aspect-ratio values to V6 slash form *before* the calc
    // wrapper runs — otherwise `2 / 1` would be wrapped as `calc(2 / 1)`
    // and emitted that way, which is uglier than the canonical `2/1`.
    if (RATIO_VAR_RE.test(mapping.cssVariable)) {
      finalValue = normalizeAspectRatio(finalValue);
      // V5 split-box ratios that ran through `maintain-after-ratio` had
      // a built-in `* 2` height multiplier, so V5 `W/H` corresponds to
      // V6 `W/(2H)`. Apply the doubling so the V6 CSS aspect-ratio
      // matches what V5 actually rendered.
      if (SPLIT_BOX_DOUBLED_V5_VARS.has(mapping.scssVariable)) {
        const m = finalValue.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
        if (m) {
          let w = parseFloat(m[1]);
          let h = parseFloat(m[2]) * 2;
          // Simplify integer fractions (2/2 → 1/1, 4/2 → 2/1).
          if (Number.isInteger(w) && Number.isInteger(h)) {
            const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
            const g = gcd(w, h);
            w /= g; h /= g;
          }
          finalValue = `${w}/${h}`;
        }
      }
    }

    finalValue = wrapScssArithmeticInCalc(finalValue);

    // Reduce multi-axis V5 shorthands (e.g. `32px 0`) to their first
    // top-level token when the V6 var is consumed in a single-axis
    // context. See SINGLE_AXIS_V6_VARS above for the list and rationale.
    if (SINGLE_AXIS_V6_VARS.has(mapping.cssVariable)) {
      finalValue = firstTopLevelToken(finalValue);
    }

    // (Note: an earlier version of this importer pinned every imported
    // `rem` value to absolute `px` via `× 16` to "freeze" V5-compiled
    // sizes. We don't do that anymore — themes keep their original
    // `rem` units. Be aware that V6's baseStyles applies
    // `html { font-size: var(--font-normal) }`, so an imported
    // `--font-normal: 0.9375rem` rebases the root and other `rem`
    // values scale relative to that, not relative to the browser
    // default 16px. Adjust `--font-normal` after import if you want
    // the original V5 sizes.)

    // Append `px` to a bare `0` for length-typed V6 variables. SCSS lets
    // unitless 0 participate in length arithmetic (it inherits the other
    // operand's unit at compile time), but CSS `calc(16px - 0)` is
    // invalid — the whole declaration is rejected and the property
    // falls back to its initial value. HER's V5 sets
    // `$nav-main-active-state-height: 0` and that flows through into
    // `calc(16px - var(--nav-main-active-state-height))`, killing the
    // nav-main link padding entirely. Emitting `0px` for length-named
    // vars keeps the calc valid.
    if (/^\s*0\s*$/.test(finalValue) && LENGTH_VAR_NAME_RE.test(mapping.cssVariable)) {
      finalValue = '0px';
    }

    result.push({
      name: mapping.cssVariable,
      value: finalValue,
    });
  }

  // V5 themes commonly used the shorthand `$button-outline-border:
  // 1px solid $color-a` instead of the separate -size / -color vars.
  // The shorthand isn't in the CSV mapping, so its size/color values
  // would otherwise be lost (and worse: `$button-border: 0` — meant for
  // the regular filled button — gets routed into --button-outline-border-size
  // by the CSV, zeroing out V6's outline border). Parse the shorthand
  // here and overwrite the V6 outline size/color so the visible result
  // matches what V5 actually rendered.
  const outlineShorthand = scssVariables['$button-outline-border'];
  if (outlineShorthand && !isNotSetSentinel(outlineShorthand)) {
    const resolved = resolveVariableReference(outlineShorthand, scssVariables);
    const tokens = resolved.trim().split(/\s+/);
    let size: string | undefined;
    let color: string | undefined;
    for (const t of tokens) {
      if (/^\d+(?:\.\d+)?(px|rem|em|%)?$/.test(t)) size = size ?? t;
      else if (/^(solid|dashed|dotted|double|groove|ridge|inset|outset|none)$/i.test(t)) {
        // style — ignore (V6 box-shadow inset has no style component)
      } else color = color ?? t;
    }
    const upsert = (name: string, value: string) => {
      const idx = result.findIndex(r => r.name === name);
      if (idx >= 0) result[idx] = { name, value };
      else result.push({ name, value });
    };
    if (size) {
      // Pass the parsed size through verbatim — rem stays rem, the
      // preview pins root font-size to 16px so values render correctly.
      upsert('--button-outline-border-size', size);
    }
    if (color) {
      let colorVal = color;
      if (color.startsWith('$')) {
        colorVal = scssToCssMap.get(color)
          ? `var(${scssToCssMap.get(color)})`
          : resolveVariableReference(color, scssVariables);
      }
      upsert('--button-outline-border-color', colorVal);
    }
  }

  // V5 had two layered backgrounds for the breadcrumb area:
  //   $tool-section-bg-color   — the wrapping section's background
  //   $breadcrumb-background-color — the breadcrumb element itself
  // V6 collapsed these into a single `--breadcrumb-bg-color` (the
  // `.tool-section` CSS reads it directly). The CSV only maps the
  // breadcrumb-side variable, so themes that customised the tool-section
  // wrapper (HOK does — `$tool-section-bg-color: lighten($color-e, 3%)`)
  // would lose that value while V5's default breadcrumb-bg `transparent`
  // gets emitted instead. Detect and prefer the tool-section value when
  // the user actually set it.
  const toolSectionBgRaw = scssVariables['$tool-section-bg-color'];
  if (
    userOverrides.has('$tool-section-bg-color') &&
    toolSectionBgRaw &&
    !isNotSetSentinel(toolSectionBgRaw)
  ) {
    let resolved = resolveVariableReference(toolSectionBgRaw, scssVariables);
    if (!isNotSetSentinel(resolved)) {
      if (resolved.includes('$')) {
        resolved = convertValueScssVarsToCss(resolved, scssToCssMap);
      }
      // Reuse the same rgba/lighten/darken rewrites the main loop does so
      // the value is valid CSS in the export.
      resolved = resolved.replace(
        /rgba\(\s*(var\(\s*--[a-zA-Z0-9_-]+\s*\)|#[0-9a-fA-F]{3,8})\s*,\s*(\d*\.?\d+%?)\s*\)/g,
        (_, color: string, alpha: string) => {
          const pct = alpha.endsWith('%')
            ? alpha
            : `${(parseFloat(alpha) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
          return `color-mix(in srgb, ${color} ${pct}, transparent)`;
        },
      );
      resolved = resolved.replace(
        /\b(lighten|darken)\(\s*(var\(\s*--[a-zA-Z0-9_-]+\s*\)|#[0-9a-fA-F]{3,8})\s*,\s*(\d*\.?\d+%?)\s*\)/g,
        (_, fn: string, color: string, amount: string) => {
          const pct = amount.endsWith('%') ? amount : `${amount}%`;
          const mixWith = fn === 'lighten' ? 'white' : 'black';
          return `color-mix(in oklab, ${color}, ${mixWith} ${pct})`;
        },
      );
      const idx = result.findIndex((r) => r.name === '--breadcrumb-bg-color');
      if (idx >= 0) result[idx] = { name: '--breadcrumb-bg-color', value: resolved };
      else result.push({ name: '--breadcrumb-bg-color', value: resolved });
    }
  }

  // V5 had no `$lead-font-size`/`$lead-line-height` variables — its `.lead`
  // rule used `@include font-medium` directly (i.e. `$font-medium` +
  // `$line-height-medium`). V6 defaults `--lead-font-size` to
  // `var(--font-xnormal)` (one step smaller). When importing a V5 theme
  // we don't get an explicit lead-size override, so V6's default wins
  // and lead text shrinks. Force the V5 mapping (`font-medium`) when the
  // theme didn't explicitly provide a lead-size override.
  const upsertResult = (name: string, value: string) => {
    const idx = result.findIndex((r) => r.name === name);
    if (idx >= 0) result[idx] = { name, value };
    else result.push({ name, value });
  };
  if (!userOverrides.has('$lead-font-size')) {
    upsertResult('--lead-font-size', 'var(--font-medium)');
  }
  if (!userOverrides.has('$lead-line-height')) {
    upsertResult('--lead-font-line-height', 'var(--font-medium-line-height)');
  }

  // Resolve V5's compile-time contrast `@if` for nav-main link/underline
  // once here, against the merged V5 sources (theme + base defaults), so
  // V6 ends up with the visually-correct value baked in. See
  // `applyNavMainContrastPairs` for the full rationale.
  const mapped = applyNavMainContrastPairs(result, scssVariables);
  return { mapped, cleared };
}
