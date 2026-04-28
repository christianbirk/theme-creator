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

/**
 * Convert SCSS arithmetic expressions to CSS calc() expressions.
 * SCSS allows bare math like `24px - 4px` or `$var * 1.5`, but CSS requires calc().
 * Also handles parenthesized sub-expressions like `24px 0 (24px - 4px)`.
 *
 * Lives here (not in legacy-import.ts) so both the in-app importer and
 * the node-only verification scripts in `scripts/` can call it without
 * pulling in Vite-specific imports.
 */
export function wrapScssArithmeticInCalc(value: string): string {
  if (!value || value.startsWith('calc(') || value.startsWith('var(')) return value;

  let result = value;

  const isCalcOperand = (s: string) => /[\d.]/.test(s) || s.startsWith('var(');

  result = result.replace(/\(([^()]+)\)/g, (match, inner) => {
    const trimmed = inner.trim();
    if (/(?:[\d.]+[a-z%]*|var\([^)]+\))\s*[+\-*/]\s*(?:[\d.]+|var\()/.test(trimmed) && !trimmed.startsWith('calc(')) {
      return `calc(${trimmed})`;
    }
    return match;
  });

  if (!/\bcalc\(/.test(result)) {
    const parts = result.split(/\s+/);
    if (parts.length >= 3) {
      const rebuilt: string[] = [];
      let i = 0;
      while (i < parts.length) {
        if (i + 2 < parts.length && /^[+\-*/]$/.test(parts[i + 1]) &&
            isCalcOperand(parts[i]) && isCalcOperand(parts[i + 2])) {
          let exprParts = [parts[i], parts[i + 1], parts[i + 2]];
          i += 3;
          while (i + 1 < parts.length && /^[+\-*/]$/.test(parts[i]) && isCalcOperand(parts[i + 1])) {
            exprParts.push(parts[i], parts[i + 1]);
            i += 2;
          }
          rebuilt.push(`calc(${exprParts.join(' ')})`);
        } else {
          rebuilt.push(parts[i]);
          i++;
        }
      }
      result = rebuilt.join(' ');
    }
  }

  return result;
}

/**
 * Parse the contents of a .scss file, extracting every top-level
 * `$var-name: value;` declaration into a ParsedScssVariables map. Handles:
 *  - `!default` flags (stripped)
 *  - inline `// …` comments after the value
 *  - trailing semicolons
 *  - multi-line values are NOT supported (V5 themes don't use them)
 *
 * Lives here (not in legacy-import.ts) because the V5-base-defaults
 * snapshot generator script needs to call it from a node-only context.
 */
export function parseScssFile(content: string): ParsedScssVariables {
  const variables: ParsedScssVariables = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || !trimmed.includes(':')) continue;

    const match = trimmed.match(/^\$([a-zA-Z0-9_-]+)\s*:\s*(.+?);?\s*(?:\/\/.*)?$/);
    if (match) {
      const [, name, value] = match;
      const cleanValue = value.replace(/!default\s*$/, '').replace(/;$/, '').trim();
      variables[`$${name}`] = cleanValue;
    }
  }

  return variables;
}
