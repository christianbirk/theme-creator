/**
 * Snapshot every `$var: value !default;` in the V5 baseStyles framework
 * (beru-org/Assets:GoBasic/baseStyles/css/variables/**) into
 * `client/src/lib/v5-base-defaults.json`.
 *
 * The V5 → V6 converter merges this snapshot *under* the user's chosen
 * V5 theme so any V5 source variable the theme doesn't override still
 * resolves to the value V5 would have used at compile time. See
 * `docs/theme-source-conventions.md` for the full rule.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx npx tsx scripts/fetch-v5-base-defaults.ts
 *
 * The token only needs read access to the public beru-org/Assets repo.
 * Re-run whenever the upstream V5 baseStyles framework adds, removes, or
 * changes `!default` values.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseScssFile } from '../client/src/lib/legacy-import-utils';

const REPO = 'beru-org/Assets';
const BRANCH = 'main';
const VARS_DIR = 'GoBasic/baseStyles/css/variables/';
const OUTPUT = resolve(process.cwd(), 'client/src/lib/v5-base-defaults.json');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error(
    'GITHUB_TOKEN not set. Provide a token with read access to ' + REPO,
  );
  process.exit(1);
}

const apiHeaders: Record<string, string> = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function main() {
  const treeRes = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: apiHeaders },
  );
  if (!treeRes.ok) {
    throw new Error(
      `GitHub tree fetch failed: ${treeRes.status} ${treeRes.statusText}`,
    );
  }
  const tree = (await treeRes.json()) as {
    tree: { path: string; type: string }[];
  };

  const files = tree.tree.filter(
    (e) =>
      e.type === 'blob' && e.path.startsWith(VARS_DIR) && e.path.endsWith('.scss'),
  );
  console.log(`Found ${files.length} .scss files under ${VARS_DIR}`);

  const fetched = await Promise.all(
    files.map(async (f) => {
      const res = await fetch(
        `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${f.path}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { path: f.path, content: await res.text() };
    }),
  );

  const merged: Record<string, string> = {};
  let conflicts = 0;
  for (const f of fetched) {
    const parsed = parseScssFile(f.content);
    for (const [k, v] of Object.entries(parsed)) {
      if (k in merged && merged[k] !== v) conflicts++;
      merged[k] = v;
    }
  }

  const sortedKeys = Object.keys(merged).sort();
  const sorted: Record<string, string> = {};
  for (const k of sortedKeys) sorted[k] = merged[k];

  writeFileSync(OUTPUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(
    `Wrote ${OUTPUT} — ${sortedKeys.length} variables (${conflicts} conflicts; last write wins)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
