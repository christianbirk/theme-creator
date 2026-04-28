/**
 * Locks in the V5 base-defaults fallback rule (see Task #5 expansion and
 * `docs/theme-source-conventions.md`):
 *
 *   When converting V5 → V6, the customizer merges the V5 baseStyles
 *   framework defaults UNDER the user's chosen V5 theme. Theme entries
 *   always win on key collision, but any V5 source variable the theme
 *   doesn't override resolves to the value V5 would have used at
 *   compile time — so V6 never emits an empty value just because a
 *   blank theme didn't restate a framework default.
 *
 * The motivating example, observed in the wild on a blank theme:
 *   $nav-main-border-top: 0 solid $color-gray-d !default;   // framework
 *   $color-gray-d:        #ddd                  !default;   // framework
 *   (theme overrides neither)
 *   → V6 must emit `--nav-main-border-top: 0 solid var(--color-neutral-d);`
 *
 * Run with:  npx tsx scripts/verify-v5-base-fallback.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyMapping,
  V5_BASE_DEFAULTS,
  type ScssVariableMapping,
} from '../client/src/lib/legacy-import-apply';
import type { ParsedScssVariables } from '../client/src/lib/legacy-import-utils';

let failed = 0;
let passed = 0;
const ok = (msg: string) => {
  passed++;
  console.log(`  ok   ${msg}`);
};
const bad = (msg: string) => {
  failed++;
  console.log(`  FAIL ${msg}`);
};
const expect = (cond: boolean, msg: string) => (cond ? ok(msg) : bad(msg));

// --- Load the real CSV mapping the in-app importer uses --------------------
const csvText = readFileSync(
  resolve(process.cwd(), 'attached_assets/mapping-file_1768311744358.csv'),
  'utf-8',
);
function parseCsv(text: string): ScssVariableMapping[] {
  const lines = text.split('\n');
  const out: ScssVariableMapping[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^([^,]*),([^,]*),(.*)$/);
    if (!m) continue;
    const [, cssVar, scssVar, note] = m;
    const c = cssVar.trim();
    const s = scssVar.trim();
    const n = note.trim().replace(/^"|"$/g, '');
    if (c.startsWith('--') && s.startsWith('$')) {
      out.push({ cssVariable: c, scssVariable: s, note: n });
    }
  }
  return out;
}
const mappings = parseCsv(csvText);

const findVar = (
  out: { name: string; value: string }[],
  name: string,
): string | undefined => out.find((r) => r.name === name)?.value;

// === Sanity: the snapshot itself contains what we expect ===================
console.log('\nSanity — V5_BASE_DEFAULTS snapshot');
expect(
  Object.keys(V5_BASE_DEFAULTS).length > 800,
  `snapshot has ${Object.keys(V5_BASE_DEFAULTS).length} entries (expected > 800)`,
);
expect(
  V5_BASE_DEFAULTS['$nav-main-border-top'] === '0 solid $color-gray-d',
  '$nav-main-border-top default is `0 solid $color-gray-d`',
);
expect(
  V5_BASE_DEFAULTS['$color-gray-d'] === '#ddd',
  '$color-gray-d default is `#ddd`',
);

// === Fixture A — blank theme (no overrides) =================================
// The exact case Task #5 was reopened for. No theme variables at all → the
// merge must fall through to V5 framework defaults end-to-end.
console.log('\nFixture A — blank theme (no overrides)');
{
  const blankTheme: ParsedScssVariables = {};
  const out = applyMapping(blankTheme, mappings);

  const navBorderTop = findVar(out, '--nav-main-border-top');
  // Expect the multi-token shorthand `0 solid <hex-or-var>`. The hex `#ddd`
  // gets swapped to `var(--color-neutral-d)` because $color-d also resolves
  // to `#ddd` in the V5 framework defaults — this is exactly the
  // hex→brand-var consolidation the customizer is designed to do.
  expect(
    navBorderTop !== undefined && /^0 solid (var\(--|#)/.test(navBorderTop),
    `--nav-main-border-top emitted as "0 solid …" (got: ${navBorderTop})`,
  );

  // The framework defines $contrast-ratio = 55 — should land in V6 too.
  // Find a mapping that targets it (if any) — but more importantly, no
  // mapped variable should silently resolve to bare `$contrast-ratio`.
  const leakingScssRef = out.find((r) => /\$[a-zA-Z]/.test(r.value));
  expect(
    leakingScssRef === undefined,
    leakingScssRef
      ? `no mapped value should still contain a bare $-ref (leaked: ${leakingScssRef.name} = ${leakingScssRef.value})`
      : 'no mapped value contains a bare $-ref — all V5 refs resolved',
  );
}

// === Fixture B — theme overrides $nav-main-border-top =======================
// The user theme's value must win. Pre-existing theme content must NOT be
// silently replaced by the framework default.
console.log('\nFixture B — theme overrides $nav-main-border-top');
{
  const overridden: ParsedScssVariables = {
    '$nav-main-border-top': '4px dashed #ff00aa',
  };
  const out = applyMapping(overridden, mappings);
  const v = findVar(out, '--nav-main-border-top');
  expect(
    v !== undefined && v.startsWith('4px dashed '),
    `theme override wins for --nav-main-border-top (got: ${v})`,
  );
  expect(
    v !== undefined && !v.includes('solid'),
    'framework default `0 solid …` is NOT used when theme overrides',
  );
}

// === Fixture C — theme overrides $color-gray-d only =========================
// Theme silent on $nav-main-border-top, but overrides the colour it
// references. The fallback should resolve through the merged map and
// produce `0 solid #112233`.
console.log('\nFixture C — theme overrides only the referenced colour');
{
  const partial: ParsedScssVariables = {
    '$color-gray-d': '#112233',
  };
  const out = applyMapping(partial, mappings);
  const v = findVar(out, '--nav-main-border-top');
  expect(
    v !== undefined && v.startsWith('0 solid '),
    `--nav-main-border-top still uses framework shorthand (got: ${v})`,
  );
  expect(
    v !== undefined && (v.includes('#112233') || v.includes('var(--color-')),
    'the referenced colour resolves through the merged map',
  );
}

// === Fixture D — variable absent from BOTH theme and framework ==============
// If the V5 framework genuinely doesn't define a variable and the theme
// doesn't either, the converter must skip it (no junk emitted).
console.log('\nFixture D — variable absent from both theme and framework');
{
  // Pick a CSS var whose mapped SCSS variable doesn't exist anywhere.
  const fakeName = '$this-var-does-not-exist-anywhere-xyz';
  expect(
    !(fakeName in V5_BASE_DEFAULTS),
    `${fakeName} is not in the V5 framework snapshot`,
  );
  const fakeMappings: ScssVariableMapping[] = [
    {
      cssVariable: '--made-up-css-var',
      scssVariable: fakeName,
      note: '',
    },
  ];
  const out = applyMapping({}, fakeMappings);
  expect(
    findVar(out, '--made-up-css-var') === undefined,
    'truly absent variable is skipped (no empty value emitted)',
  );
}

// === Fixture E — merge does not mutate the caller's theme map ===============
console.log('\nFixture E — merge does not mutate caller');
{
  const themeIn: ParsedScssVariables = { '$only-key': 'only-val' };
  const beforeKeys = Object.keys(themeIn).length;
  applyMapping(themeIn, mappings);
  expect(
    Object.keys(themeIn).length === beforeKeys,
    `caller's theme map keeps ${beforeKeys} keys after applyMapping`,
  );
  expect(
    !('$nav-main-border-top' in themeIn),
    "caller's theme map is NOT polluted with framework defaults",
  );
}

// === Fixture F — V5 `notset` sentinel drops the V6 declaration ==============
// 131 of the V5 framework defaults are the literal string `notset` —
// V5's compile output omits the corresponding declaration so the cascade
// default takes over. The converter must do the same; otherwise V6
// inherits the literal word `notset` and overrides its own defaults
// with garbage. See `isNotSetSentinel` in legacy-import-utils.
console.log('\nFixture F — V5 `notset` sentinel drops the V6 declaration');
{
  // Sanity: the framework snapshot really does mark these as notset.
  expect(
    V5_BASE_DEFAULTS['$breadcrumb-link-color'] === 'notset',
    'snapshot has $breadcrumb-link-color = notset',
  );
  expect(
    V5_BASE_DEFAULTS['$nav-main-link-text-transform'] === 'notset',
    'snapshot has $nav-main-link-text-transform = notset',
  );

  const out = applyMapping({}, mappings);
  expect(
    findVar(out, '--breadcrumb-link-color') === undefined,
    "blank theme: --breadcrumb-link-color is dropped (V5 framework says 'notset')",
  );
  expect(
    findVar(out, '--nav-main-link-text-transform') === undefined,
    "blank theme: --nav-main-link-text-transform is dropped (V5 framework says 'notset')",
  );

  const leakingNotset = out.find((r) => /\bnotset\b/i.test(r.value));
  expect(
    leakingNotset === undefined,
    leakingNotset
      ? `no V6 value should contain the literal word 'notset' (leaked: ${leakingNotset.name} = ${leakingNotset.value})`
      : "no V6 value contains the literal word 'notset'",
  );
}

// === Fixture G — theme can also explicitly notset a variable ================
// A V5 theme that wants to clear an upstream override sets the variable
// to `notset` itself. Same semantics: drop the V6 declaration.
console.log('\nFixture G — theme explicitly sets a variable to `notset`');
{
  const themeNotset: ParsedScssVariables = {
    // The framework defines $color-a as a real hex; the theme clears it.
    '$color-a': 'notset',
  };
  const out = applyMapping(themeNotset, mappings);
  expect(
    findVar(out, '--color-brand-a') === undefined,
    'theme `notset` override drops --color-brand-a',
  );
}

// === Fixture H — `'notset'` (quoted) is also treated as the sentinel ========
// One framework default uses single-quoted form: `'notset'`. Plus a
// theme could write `"notset"`. The check normalises both.
console.log('\nFixture H — quoted `notset` variants also drop the declaration');
{
  expect(
    V5_BASE_DEFAULTS['$flex-list-img-size'] === "'notset'",
    "snapshot has $flex-list-img-size = 'notset' (single-quoted)",
  );
  const themeQuoted: ParsedScssVariables = {
    '$color-a': '"notset"',
  };
  const out = applyMapping(themeQuoted, mappings);
  expect(
    findVar(out, '--color-brand-a') === undefined,
    'double-quoted "notset" theme override also drops --color-brand-a',
  );
}

// === Fixture H2 — multi-layered quoting `"'notset'"` is also dropped ========
// A theme wrapping an already-quoted framework default could produce a
// double-layered quoted form. The sentinel detector must strip nested
// quotes before comparing.
console.log('\nFixture H2 — multi-layered quoting `"\'notset\'"` is also dropped');
{
  const themeDoubleQuoted: ParsedScssVariables = {
    '$color-a': `"'notset'"`,
  };
  const out = applyMapping(themeDoubleQuoted, mappings);
  expect(
    findVar(out, '--color-brand-a') === undefined,
    'multi-layered "\'notset\'" theme override drops --color-brand-a',
  );
}

// === Fixture I — chain ending in `notset` is also dropped ===================
// `$foo: $bar; $bar: notset;` — after resolveVariableReference, $foo
// resolves to `notset`, so it must be dropped too.
console.log('\nFixture I — chained reference resolving to `notset` is dropped');
{
  const themeChain: ParsedScssVariables = {
    '$color-a': '$some-other-var',
    '$some-other-var': 'notset',
  };
  const out = applyMapping(themeChain, mappings);
  expect(
    findVar(out, '--color-brand-a') === undefined,
    'chain that resolves to `notset` is dropped',
  );
}

// === Result =================================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('V5 base-defaults fallback verification FAILED');
  process.exit(1);
}
console.log('All V5 base-defaults fallback checks passed.');
