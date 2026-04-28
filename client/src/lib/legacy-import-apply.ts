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
  isNotSetSentinel,
  resolveVariableReference,
  wrapScssArithmeticInCalc,
} from './legacy-import-utils';
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
    return scssVar;
  });
}

export function applyMapping(
  scssVariables: ParsedScssVariables,
  mappings: ScssVariableMapping[],
): { name: string; value: string }[] {
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

  const result: { name: string; value: string }[] = [];

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

    // V5 `notset` sentinel — drop the V6 declaration entirely so the V6
    // cascade default takes effect (mirrors V5's compiled-CSS behavior).
    // Check both before and after reference resolution: a theme can
    // either set a var directly to `notset` or chain to another var that
    // resolves to `notset` (e.g. via a framework default). See
    // `isNotSetSentinel` for the full rule.
    if (isNotSetSentinel(rawValue)) continue;
    rawValue = resolveVariableReference(rawValue, scssVariables);
    if (isNotSetSentinel(rawValue)) continue;

    let finalValue = rawValue;

    // If the value still contains SCSS variable references, convert them to CSS variables
    if (finalValue.includes('$')) {
      finalValue = convertValueScssVarsToCss(finalValue, scssToCssMap);
    }

    if (mapping.note.toLowerCase().includes('take only hex value')) {
      finalValue = extractHexValue(rawValue);
    }

    // Convert arrow appearance / link style values
    if (
      mapping.note.toLowerCase().includes('arrow appearance') ||
      mapping.cssVariable.includes('link-style')
    ) {
      const cleanValue = rawValue.toLowerCase().replace(/^['"]|['"]$/g, '');
      if (cleanValue === 'left' || cleanValue === 'right') {
        finalValue = 'Left';
      } else if (cleanValue === 'underline') {
        finalValue = 'Underline';
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

    finalValue = wrapScssArithmeticInCalc(finalValue);

    result.push({
      name: mapping.cssVariable,
      value: finalValue,
    });
  }

  // Resolve V5's compile-time contrast `@if` for nav-main link/underline
  // once here, against the merged V5 sources (theme + base defaults), so
  // V6 ends up with the visually-correct value baked in. See
  // `applyNavMainContrastPairs` for the full rationale.
  return applyNavMainContrastPairs(result, scssVariables);
}
