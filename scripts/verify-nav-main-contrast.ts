/**
 * Fixture-driven verification for the V5 → V6 nav-main contrast-pair fix.
 *
 * Run with:  npx tsx scripts/verify-nav-main-contrast.ts
 *
 * The project has no test runner wired up, so this stand-alone script acts
 * as the regression check. It exercises `applyNavMainContrastPairs`
 * against synthetic V5 SCSS variable maps that mirror what the in-app
 * legacy importer would parse out of a real V5 theme zip. Both the
 * in-app importer (`LegacyImportModal`) and any future bulk-convert CLI
 * call `applyMapping`, which delegates to this same helper at the end —
 * so verifying the helper here covers both surfaces.
 *
 * Imports come from `legacy-import-contrast.ts` directly (not from
 * `legacy-import.ts`) because the latter pulls in a Vite-specific `?raw`
 * CSV import that node/tsx can't resolve on its own.
 */
import {
  applyNavMainContrastPairs,
  sassLightness,
} from '../client/src/lib/legacy-import-contrast';
import type { ParsedScssVariables } from '../client/src/lib/legacy-import-utils';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── sassLightness sanity ──────────────────────────────────────────────
console.log('sassLightness');
check('white → 100', Math.round(sassLightness('#ffffff') ?? -1) === 100);
check('black → 0', Math.round(sassLightness('#000000') ?? -1) === 0);
check('white keyword → 100', Math.round(sassLightness('white') ?? -1) === 100);
check(
  'dark teal #1E4F5C → ~24 (dark, ≤55)',
  (() => {
    const l = sassLightness('#1E4F5C') ?? -1;
    return l > 23 && l < 25;
  })(),
);
check(
  'pale yellow #F4F1D6 → ~89 (light, >55)',
  (() => {
    const l = sassLightness('#F4F1D6') ?? -1;
    return l > 88 && l < 91;
  })(),
);
check('garbage → null', sassLightness('not-a-color') === null);
check('empty → null', sassLightness('') === null);
check('3-digit hex #fff → 100', Math.round(sassLightness('#fff') ?? -1) === 100);
check('hex with alpha #1E4F5CFF → ~24', (() => {
  const l = sassLightness('#1E4F5CFF') ?? -1;
  return l > 23 && l < 25;
})());

// ── Fixture A: dark background (the EM-style trigger case) ────────────
console.log('\nFixture A — dark nav background ($color-a #1E4F5C)');
const darkTheme: ParsedScssVariables = {
  '$color-a': '#1E4F5C',
  '$color-gray-a': '#252525',
  '$nav-main-background-color': '$color-a',
  '$nav-main-link-color': '$color-gray-a',
  '$nav-main-active-state-color': '$color-a',
  // Theme does NOT override $color-alternate / *-alternate — must fall
  // back to V5 master defaults (white).
};

// Simulate the output of the CSV mapping pass — the values that would
// have been written if we did NOTHING about the contrast `@if`.
const darkMapped = [
  { name: '--nav-main-background-color', value: 'var(--color-brand-a)' },
  { name: '--nav-main-link-color', value: '#252525' },
  { name: '--nav-main-active-state-color', value: 'var(--color-brand-a)' },
];

const darkResult = applyNavMainContrastPairs(darkMapped, darkTheme);
const darkLink = darkResult.find((v) => v.name === '--nav-main-link-color');
const darkActive = darkResult.find(
  (v) => v.name === '--nav-main-active-state-color'
);
check(
  '--nav-main-link-color overridden to white token',
  darkLink?.value === 'var(--color-neutral-f)',
  `got ${JSON.stringify(darkLink)}`
);
check(
  '--nav-main-active-state-color overridden to white token',
  darkActive?.value === 'var(--color-neutral-f)',
  `got ${JSON.stringify(darkActive)}`
);

// ── Fixture B: light background (no override) ─────────────────────────
console.log('\nFixture B — light nav background (#F4F1D6)');
const lightTheme: ParsedScssVariables = {
  '$color-a': '#1E4F5C',
  '$color-gray-a': '#252525',
  '$nav-main-background-color': '#F4F1D6',
  '$nav-main-link-color': '$color-gray-a',
  '$nav-main-active-state-color': '$color-a',
};
const lightMapped = [
  { name: '--nav-main-background-color', value: '#F4F1D6' },
  { name: '--nav-main-link-color', value: '#252525' },
  { name: '--nav-main-active-state-color', value: 'var(--color-brand-a)' },
];
const lightResult = applyNavMainContrastPairs(lightMapped, lightTheme);
const lightLink = lightResult.find((v) => v.name === '--nav-main-link-color');
const lightActive = lightResult.find(
  (v) => v.name === '--nav-main-active-state-color'
);
check(
  '--nav-main-link-color preserved on light bg',
  lightLink?.value === '#252525',
  `got ${JSON.stringify(lightLink)}`
);
check(
  '--nav-main-active-state-color preserved on light bg',
  lightActive?.value === 'var(--color-brand-a)',
  `got ${JSON.stringify(lightActive)}`
);

// ── Fixture C: missing $nav-main-background-color ─────────────────────
console.log('\nFixture C — bg unset, helper bails out cleanly');
const noBgTheme: ParsedScssVariables = {
  '$color-a': '#1E4F5C',
  '$nav-main-link-color': '#aabbcc',
};
const noBgMapped = [{ name: '--nav-main-link-color', value: '#aabbcc' }];
const noBgResult = applyNavMainContrastPairs(noBgMapped, noBgTheme);
const noBgLink = noBgResult.find((v) => v.name === '--nav-main-link-color');
check(
  '--nav-main-link-color left as the mapped source value',
  noBgLink?.value === '#aabbcc',
  `got ${JSON.stringify(noBgLink)}`
);

// ── Fixture D: theme overrides $color-alternate ───────────────────────
console.log('\nFixture D — theme overrides $color-alternate');
const altTheme: ParsedScssVariables = {
  '$color-a': '#1E4F5C',
  '$color-gray-a': '#252525',
  '$color-alternate': '#fafafa',
  '$nav-main-background-color': '$color-a',
  '$nav-main-link-color': '$color-gray-a',
  '$nav-main-active-state-color': '$color-a',
};
const altMapped = [
  { name: '--nav-main-link-color', value: '#252525' },
  { name: '--nav-main-active-state-color', value: 'var(--color-brand-a)' },
];
const altResult = applyNavMainContrastPairs(altMapped, altTheme);
const altLink = altResult.find((v) => v.name === '--nav-main-link-color');
check(
  '--nav-main-link-color uses the theme-overridden $color-alternate hex',
  altLink?.value === '#fafafa',
  `got ${JSON.stringify(altLink)}`
);

// ── Fixture E: missing token entry — helper appends it ────────────────
console.log('\nFixture E — paired token absent from mapped output, helper appends');
const sparseMapped = [
  { name: '--nav-main-background-color', value: 'var(--color-brand-a)' },
  // No --nav-main-link-color row at all.
];
const sparseResult = applyNavMainContrastPairs(sparseMapped, darkTheme);
const sparseLink = sparseResult.find((v) => v.name === '--nav-main-link-color');
check(
  'helper appends --nav-main-link-color when absent on dark bg',
  sparseLink?.value === 'var(--color-neutral-f)',
  `got ${JSON.stringify(sparseLink)}`
);

// ── Fixture F: idempotence ────────────────────────────────────────────
console.log('\nFixture F — running the helper twice changes nothing');
const twice = applyNavMainContrastPairs(darkResult, darkTheme);
const twiceLink = twice.find((v) => v.name === '--nav-main-link-color');
check(
  'second pass leaves --nav-main-link-color stable',
  twiceLink?.value === darkLink?.value
);

// ── Fixture boundary: locks the `> 55` semantic of V5's @if ───────────
// V5: `@if (lightness($bg) > $contrast-ratio)` — strictly greater than 55
// is "light". Hex math can't land on exactly 55, so we use the closest
// integer values either side of it.
console.log('\nFixture boundary — `lightness > 55` is strict');
const justAboveTheme: ParsedScssVariables = {
  '$nav-main-background-color': '#8C8D8C', // lightness ≈ 55.098 → light
  '$nav-main-link-color': '#252525',
};
const justAboveResult = applyNavMainContrastPairs(
  [{ name: '--nav-main-link-color', value: '#252525' }],
  justAboveTheme
);
const justAboveLink = justAboveResult.find(
  (v) => v.name === '--nav-main-link-color'
);
check(
  'lightness 55.098 (just above) treated as light bg — no override',
  justAboveLink?.value === '#252525',
  `got ${JSON.stringify(justAboveLink)}`
);

const justBelowTheme: ParsedScssVariables = {
  '$nav-main-background-color': '#8C8C8C', // lightness ≈ 54.902 → dark
  '$nav-main-link-color': '#252525',
};
const justBelowResult = applyNavMainContrastPairs(
  [{ name: '--nav-main-link-color', value: '#252525' }],
  justBelowTheme
);
const justBelowLink = justBelowResult.find(
  (v) => v.name === '--nav-main-link-color'
);
check(
  'lightness 54.902 (just below) treated as dark bg — override fires',
  justBelowLink?.value === 'var(--color-neutral-f)',
  `got ${JSON.stringify(justBelowLink)}`
);

// ── Fixture G: indirect bg reference chain ────────────────────────────
console.log('\nFixture G — $nav-main-background-color: $brand → $color-a → hex');
const chainTheme: ParsedScssVariables = {
  '$color-a': '#1E4F5C',
  '$brand': '$color-a',
  '$nav-main-background-color': '$brand',
};
const chainMapped = [{ name: '--nav-main-link-color', value: '#252525' }];
const chainResult = applyNavMainContrastPairs(chainMapped, chainTheme);
const chainLink = chainResult.find((v) => v.name === '--nav-main-link-color');
check(
  'multi-step ref chain still triggers dark-bg override',
  chainLink?.value === 'var(--color-neutral-f)',
  `got ${JSON.stringify(chainLink)}`
);

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All nav-main contrast checks passed.');
