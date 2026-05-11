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
 * Return the first whitespace-separated token at the top level of `value`.
 * Paren-aware: a `calc(…)` or `var(--foo, fallback)` containing internal
 * spaces still counts as one token. Used when a V5 multi-axis shorthand
 * (e.g. `32px 0`) needs to be reduced to a single value because the V6
 * variable is consumed in a single-axis context (e.g. `padding-top`).
 */
export function firstTopLevelToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && /\s/.test(c)) return trimmed.slice(0, i);
  }
  return trimmed;
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
    // Fallback for V5's spacing convention. The framework declares
    // $space-4/8/12/16/24/32/64 explicitly, but themes routinely use
    // values from the rest of the scale ($space-40, $space-48, $space-72…)
    // assuming the convention `$space-N → Npx`. Those tokens aren't in
    // the V5 base defaults snapshot, so without this fallback the literal
    // `$space-40` survives the import and shows up as raw text in the
    // customizer (e.g. `Grid Box Padding: $space-40 24px 32px 24px`).
    // Only fires when the theme didn't explicitly declare the token —
    // a real `$space-40: 50px` override above wins via allVariables.
    const spaceMatch = value.match(/^\$space-(\d+)$/);
    if (spaceMatch) return `${spaceMatch[1]}px`;
  }
  return value;
}

/**
 * V5 framework convention: a variable whose value is the literal string
 * `notset` (with or without surrounding quotes) is **intentionally
 * unset** — V5's compiled CSS leaves the corresponding declaration out
 * entirely so the cascade default takes effect. The customizer must
 * mirror that: when the V5 → V6 converter sees `notset`, it omits the
 * V6 variable instead of emitting the literal word `notset` (which
 * would override the V6 default with garbage).
 *
 * 131 entries in the V5 baseStyles framework defaults snapshot use this
 * sentinel — see `client/src/lib/v5-base-defaults.json`. Themes can
 * also explicitly set a variable to `notset` to clear an override; the
 * same drop-the-output semantics apply.
 */
export function isNotSetSentinel(value: string | undefined): boolean {
  if (!value) return false;
  // Strip *all* leading/trailing quote chars (single or double) so
  // multi-layered quoting like `"'notset'"` (which can happen when a
  // theme wraps an already-quoted framework default) still normalises
  // to `notset`. Outer whitespace is also tolerated.
  const cleaned = value.trim().replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
  return cleaned === 'notset';
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
  if (!value) return value;

  // Already a calc() — don't double-wrap.
  const trimmed = value.trim();
  if (trimmed.startsWith('calc(')) return value;

  // A *standalone* var() reference has nothing to wrap (e.g. `var(--foo)`
  // or `var(--foo, var(--bar))`). But we must NOT bail when there's
  // trailing arithmetic like `var(--grid-gutter-desktop) * 2` — that needs
  // to become `calc(var(--grid-gutter-desktop) * 2)` or Sass rejects the
  // declaration during the export compile. Find the balanced close of the
  // leading var() and check whether anything follows.
  if (trimmed.startsWith('var(')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      const tail = trimmed.slice(end + 1).trim();
      if (tail === '') return value; // pure single var() — nothing to wrap
      // Otherwise fall through to the parser below so any trailing
      // `* 2` / `- 4px` arithmetic gets wrapped in calc().
    }
  }

  let result = value;

  const isCalcOperand = (s: string) => /[\d.]/.test(s) || s.startsWith('var(');

  // Walk the string with a paren-depth counter and replace any balanced
  // `(…arithmetic…)` with `calc(…arithmetic…)`. Doing this with a regex
  // failed because `[^()]+` excludes the parens of nested `var(…)`, which
  // meant `(16px - var(--foo))` was never matched and the second pass
  // (whitespace-split) ended up wrapping the partial token `(16px` —
  // producing `calc((16px - var(--foo)))` with stray double parens.
  result = (() => {
    let out = '';
    let i = 0;
    while (i < result.length) {
      if (result[i] !== '(') {
        out += result[i++];
        continue;
      }
      // Find matching closing paren, tracking depth so nested var() is
      // skipped over rather than confusing the scanner.
      let depth = 1;
      let j = i + 1;
      while (j < result.length && depth > 0) {
        if (result[j] === '(') depth++;
        else if (result[j] === ')') depth--;
        if (depth > 0) j++;
      }
      if (depth !== 0) {
        // Unbalanced — leave the rest untouched and stop scanning.
        out += result.slice(i);
        break;
      }
      const inner = result.slice(i + 1, j).trim();
      // Already a function call like `calc(…)` or `var(…)` — leave alone.
      // Detect by whether `(` is preceded by an identifier character.
      const prevChar = i > 0 ? result[i - 1] : '';
      const isFunctionCall = /[a-zA-Z0-9_-]/.test(prevChar);
      if (isFunctionCall) {
        out += result.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      // Top-level paren group. Treat as arithmetic only if a standalone
      // operator token is present (so parens-wrapped color values like
      // `(rgba(0,0,0,0.5))` aren't mistaken for math).
      const tokens = inner.split(/\s+/);
      const hasOperator = tokens.some((t) => /^[+\-*/]$/.test(t));
      if (hasOperator) {
        out += `calc(${inner})`;
      } else {
        out += result.slice(i, j + 1);
      }
      i = j + 1;
    }
    return out;
  })();

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
