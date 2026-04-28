/**
 * Pure helpers shared between `legacy-import.ts` and `legacy-import-contrast.ts`.
 *
 * Nothing in this file depends on Vite-specific imports (no `?raw`, no
 * `@assets/...`), which lets node-only callers (like the
 * `scripts/verify-nav-main-contrast.ts` fixture) load it directly.
 */

export interface ParsedScssVariables {
  [variableName: string]: string;
}

/** Predefined SCSS variables with fixed values that the V5 themes assume. */
const PREDEFINED_SCSS_VALUES: Record<string, string> = {
  '$space-4': '4px',
  '$space-8': '8px',
  '$space-12': '12px',
  '$space-16': '16px',
  '$space-24': '24px',
  '$space-32': '32px',
};

export function extractHexValue(value: string): string {
  const hexMatch = value.match(/#[a-fA-F0-9]{3,8}/);
  return hexMatch ? hexMatch[0] : value;
}

/**
 * Replace all predefined SCSS variables in a value with their fixed values.
 * Handles compound values like "$space-12 0" -> "12px 0".
 */
export function replacePredefinedVariables(value: string): string {
  return value.replace(/\$[a-zA-Z0-9_-]+/g, (scssVar) => {
    const predefined = PREDEFINED_SCSS_VALUES[scssVar];
    return predefined || scssVar;
  });
}

/**
 * Resolve an SCSS value that may itself reference another SCSS variable.
 * Recurses through `$foo: $bar; $bar: #fff;` chains so callers see the
 * final literal.
 */
export function resolveVariableReference(
  value: string,
  allVariables: ParsedScssVariables
): string {
  value = replacePredefinedVariables(value);

  // Single SCSS variable reference → look it up and recurse.
  if (value.startsWith('$') && !value.includes(' ')) {
    const refValue = allVariables[value];
    if (refValue) {
      return resolveVariableReference(refValue, allVariables);
    }
  }
  return value;
}
