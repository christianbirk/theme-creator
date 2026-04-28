/**
 * V5 → V6 contrast-pair resolution.
 *
 * V5's `_nav-main.scss` picks the link/underline color at compile time:
 *
 *   @if (lightness($nav-main-background-color) > $contrast-ratio) {
 *     color: $nav-main-link-color !important;
 *   } @else {
 *     color: $color-alternate !important;
 *   }
 *
 * V6 has no equivalent runtime mechanism — `--nav-main-link-color` and
 * `--nav-main-active-state-color` are flat CSS variables. The default
 * mapping pass copies `$nav-main-link-color` straight through, which makes
 * links invisible whenever the theme paints the nav background with the
 * brand color (the trigger case for this fix, e.g. the EM theme).
 *
 * `applyNavMainContrastPairs` resolves that conditional once, against the
 * parsed V5 SCSS variables, and overrides the V6 token with the
 * visually-correct value. It's a one-shot transform: the resulting V6
 * theme lives entirely in V6 land, so later edits to the background do
 * NOT auto-recompute these tokens.
 *
 * This module has no Vite-specific imports so it can also be loaded
 * directly by a node-only verification script.
 */
import {
  ParsedScssVariables,
  extractHexValue,
  resolveVariableReference,
} from './legacy-import-utils';

/** V5 `$contrast-ratio: 55 !default;` — the dark/light cutoff in HSL%. */
export const NAV_MAIN_CONTRAST_THRESHOLD = 55;

interface NavMainContrastPair {
  /** V6 token to override. */
  cssVariable: string;
  /** SCSS source to read when bg lightness > threshold. */
  lightBgSource: string;
  /** SCSS source to read when bg lightness ≤ threshold. */
  darkBgSource: string;
}

const NAV_MAIN_BACKGROUND_VAR = '$nav-main-background-color';

const NAV_MAIN_PAIRS: NavMainContrastPair[] = [
  {
    cssVariable: '--nav-main-link-color',
    lightBgSource: '$nav-main-link-color',
    darkBgSource: '$color-alternate',
  },
  {
    cssVariable: '--nav-main-active-state-color',
    lightBgSource: '$nav-main-active-state-color',
    darkBgSource: '$nav-main-active-state-color-alternate',
  },
];

/**
 * Sass-equivalent `lightness()` — returns HSL lightness as a percentage in
 * the range 0..100, or `null` when the value can't be parsed as a hex color
 * (or the common `white`/`black` keywords).
 */
export function sassLightness(value: string): number | null {
  if (!value) return null;
  let token = value.trim().toLowerCase().replace(/^['"]|['"]$/g, '');
  if (token === 'white') token = '#ffffff';
  else if (token === 'black') token = '#000000';

  const m = token.match(/^#([0-9a-f]{3,8})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  else if (h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  else if (h.length === 8) h = h.slice(0, 6); // ignore alpha
  if (h.length !== 6) return null;

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return ((max + min) / 2) * 100;
}

/**
 * Translate the V5 source value into the same V6 form `applyMapping` would
 * produce for it (white → `var(--color-neutral-f)`, black →
 * `var(--color-neutral-a)`, hex passes through). Keeps overrides consistent
 * with the rest of the converted theme.
 */
function normalizeNavMainOverride(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/^['"]|['"]$/g, '');
  if (cleaned === 'white') return 'var(--color-neutral-f)';
  if (cleaned === 'black') return 'var(--color-neutral-a)';
  return value.trim();
}

export function applyNavMainContrastPairs(
  mappedVariables: { name: string; value: string }[],
  scssVariables: ParsedScssVariables
): { name: string; value: string }[] {
  const bgRaw = scssVariables[NAV_MAIN_BACKGROUND_VAR];
  if (!bgRaw) return mappedVariables;

  const bgResolved = resolveVariableReference(bgRaw, scssVariables);
  const bgHex = extractHexValue(bgResolved);
  const lightness = sassLightness(bgHex);
  if (lightness === null) return mappedVariables;
  if (lightness > NAV_MAIN_CONTRAST_THRESHOLD) return mappedVariables;

  // Dark background — pick the dark-bg source for each paired token.
  const overrides = new Map<string, string>();
  for (const pair of NAV_MAIN_PAIRS) {
    const darkSrc = scssVariables[pair.darkBgSource];
    let value: string;
    if (darkSrc) {
      value = resolveVariableReference(darkSrc, scssVariables);
    } else {
      // V5 master defaults: `$color-alternate: white` and
      // `$nav-main-active-state-color-alternate: $color-alternate`.
      value = 'white';
    }
    overrides.set(pair.cssVariable, normalizeNavMainOverride(value));
  }

  const seen = new Set<string>();
  const result = mappedVariables.map((v) => {
    if (overrides.has(v.name)) {
      seen.add(v.name);
      return { name: v.name, value: overrides.get(v.name)! };
    }
    return v;
  });
  Array.from(overrides.entries()).forEach(([name, value]) => {
    if (!seen.has(name)) result.push({ name, value });
  });
  return result;
}
