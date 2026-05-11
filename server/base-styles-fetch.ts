/**
 * Fetches the latest baseStylesV6 from beru-org/Assets via the GitHub
 * API (using the `gh` CLI for authentication) and writes it to a local
 * cache directory. The compile endpoint prefers this cache over the
 * bundled fallback in `attached_assets/baseStylesV6/`, so the customizer
 * always compiles against the most-recent framework as long as the
 * machine has network + valid `gh auth login`.
 *
 * Authentication: `gh` CLI must be installed and authenticated (run
 * `gh auth login`). Token scopes need at least `repo` for private repos.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const exec = promisify(execFile);

export const REPO = 'beru-org/Assets';
// `release` is the canonical "production-ready" branch the team
// publishes baseStylesV6 changes from; `main` lags behind it for
// integration. The customizer always pulls from release so a
// "Refresh baseStyles" click reflects what consumers will see.
export const REPO_BRANCH = 'release';
export const REPO_PATH = 'GoBasic/baseStylesV6';

export const CACHE_DIR = path.resolve(process.cwd(), 'server/.basestyles-cache');
const META_PATH = path.join(CACHE_DIR, '.meta.json');

interface CacheMeta {
  fetchedAt: string;        // ISO timestamp
  commitSha: string;        // upstream commit SHA at fetch time
  fileCount: number;
}

/** Path that the customizer's compile step should read baseStyles from. */
export function effectiveBaseStylesDir(bundledFallback: string): string {
  if (fs.existsSync(path.join(CACHE_DIR, 'css'))) return CACHE_DIR;
  return bundledFallback;
}

export function readCacheMeta(): CacheMeta | null {
  try {
    const raw = fs.readFileSync(META_PATH, 'utf-8');
    return JSON.parse(raw) as CacheMeta;
  } catch {
    return null;
  }
}

function ghPath(): string {
  // `gh` may live in PATH (when installed via Homebrew) or in
  // ~/.local/bin (when installed via the manual zip route used by this
  // project's setup). Probe both so the route works in either layout.
  const candidates = [
    'gh',
    path.join(os.homedir(), '.local', 'bin', 'gh'),
    '/usr/local/bin/gh',
    '/opt/homebrew/bin/gh',
  ];
  return candidates[0]; // resolved by execFile via PATH; explicit paths are tried in fallbacks
}

async function gh(args: string[]): Promise<string> {
  const candidates = [
    'gh',
    path.join(os.homedir(), '.local', 'bin', 'gh'),
    '/usr/local/bin/gh',
    '/opt/homebrew/bin/gh',
  ];
  let lastErr: unknown = null;
  for (const bin of candidates) {
    try {
      const { stdout } = await exec(bin, args, { maxBuffer: 50 * 1024 * 1024 });
      return stdout;
    } catch (err) {
      // Treat ENOENT as "this candidate isn't installed" and try the next;
      // any other failure is a real error (auth, network) — surface it.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `gh CLI not found in PATH or common install locations (${candidates.join(', ')}). ` +
    `Install gh and run 'gh auth login'.\n` +
    (lastErr ? String(lastErr) : ''),
  );
}

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/**
 * Walk the upstream baseStylesV6 directory and write every blob into
 * the local cache, mirroring the directory structure. Returns metadata
 * suitable for displaying a "last refreshed" timestamp.
 */
export async function refreshBaseStyles(): Promise<CacheMeta> {
  // Resolve the commit SHA for the branch HEAD so all blob fetches are
  // pinned to a consistent point in time (avoids races mid-walk).
  const refRaw = await gh(['api', `repos/${REPO}/git/refs/heads/${REPO_BRANCH}`]);
  const ref = JSON.parse(refRaw) as { object: { sha: string } };
  const commitSha = ref.object.sha;

  // Get the recursive tree at that commit.
  const treeRaw = await gh(['api', `repos/${REPO}/git/trees/${commitSha}?recursive=1`]);
  const tree = JSON.parse(treeRaw) as { tree: TreeItem[]; truncated?: boolean };
  if (tree.truncated) {
    throw new Error('Repository tree is truncated by GitHub (>100k files). Implement pagination.');
  }

  const prefix = REPO_PATH + '/';
  const blobs = tree.tree.filter(
    (item) => item.type === 'blob' && item.path.startsWith(prefix),
  );

  // Wipe the existing cache so removed files don't linger.
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Fetch blobs with bounded concurrency so we don't hammer the API.
  const CONCURRENCY = 8;
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= blobs.length) return;
      const blob = blobs[idx];
      const blobRaw = await gh(['api', `repos/${REPO}/git/blobs/${blob.sha}`]);
      const parsed = JSON.parse(blobRaw) as { content: string; encoding: string };
      const data =
        parsed.encoding === 'base64'
          ? Buffer.from(parsed.content, 'base64')
          : Buffer.from(parsed.content, 'utf-8');
      const relativePath = blob.path.slice(prefix.length);
      const localPath = path.join(CACHE_DIR, relativePath);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, data);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const meta: CacheMeta = {
    fetchedAt: new Date().toISOString(),
    commitSha,
    fileCount: blobs.length,
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

// Suppress unused-warning for the eager probe helper (kept for diagnostics).
void ghPath;
