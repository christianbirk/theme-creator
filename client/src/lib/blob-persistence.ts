/**
 * IndexedDB persistence for the Blob-backed slices of the working
 * session — custom fonts and custom graphics. localStorage can't hold
 * these efficiently (they'd need base64 encoding and would blow past
 * the 5 MB quota after a couple of TTFs), so they live here instead.
 *
 * This is the Level 2 companion to `theme-persistence.ts`, which
 * handles the text-only slices (variables, custom SCSS/JS, styles.xml
 * classes). Both are cleared together by `handleResetEverything`.
 *
 * Blob URLs are NOT persisted — they're transient per-page-load
 * handles. The main page's font-blob-URL effect regenerates them
 * from the raw `data` bytes on mount, so restored fonts still
 * appear in the live preview without any extra bookkeeping here.
 */
import type { FontFile } from '@/components/theme-customizer/CustomFontsManager';
import type { GraphicFile } from '@/components/theme-customizer/CustomGraphicsManager';

const DB_NAME = 'theme-customizer';
const DB_VERSION = 1;
const FONTS_STORE = 'fonts';
const GRAPHICS_STORE = 'graphics';
const DEBOUNCE_MS = 400;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FONTS_STORE)) {
        db.createObjectStore(FONTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(GRAPHICS_STORE)) {
        db.createObjectStore(GRAPHICS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

async function replaceAll<T>(store: string, items: T[]): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    os.clear();
    for (const item of items) os.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).finally(() => db.close());
}

// Fonts and graphics share the same shape (id + name + Uint8Array data
// + type + size + optional metadata), so one strip/rehydrate pass works
// for both. Blob URLs are page-lifetime handles — we deliberately do
// not persist them; the main page regenerates them on load.
function stripTransient<T extends { blobUrl?: string }>(items: T[]): Omit<T, 'blobUrl'>[] {
  return items.map(({ blobUrl: _blobUrl, ...rest }) => rest);
}

export async function loadPersistedFonts(): Promise<FontFile[]> {
  try {
    return await readAll<FontFile>(FONTS_STORE);
  } catch {
    return [];
  }
}

export async function loadPersistedGraphics(): Promise<GraphicFile[]> {
  try {
    return await readAll<GraphicFile>(GRAPHICS_STORE);
  } catch {
    return [];
  }
}

let fontsTimer: ReturnType<typeof setTimeout> | null = null;
let graphicsTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleFontsSave(fonts: FontFile[]): void {
  if (fontsTimer) clearTimeout(fontsTimer);
  fontsTimer = setTimeout(() => {
    replaceAll(FONTS_STORE, stripTransient(fonts)).catch((err) => {
      console.warn('theme-customizer: could not persist fonts', err);
    });
  }, DEBOUNCE_MS);
}

export function scheduleGraphicsSave(graphics: GraphicFile[]): void {
  if (graphicsTimer) clearTimeout(graphicsTimer);
  graphicsTimer = setTimeout(() => {
    replaceAll(GRAPHICS_STORE, stripTransient(graphics)).catch((err) => {
      console.warn('theme-customizer: could not persist graphics', err);
    });
  }, DEBOUNCE_MS);
}

export async function clearPersistedBlobs(): Promise<void> {
  if (fontsTimer) { clearTimeout(fontsTimer); fontsTimer = null; }
  if (graphicsTimer) { clearTimeout(graphicsTimer); graphicsTimer = null; }
  try {
    await Promise.all([
      replaceAll(FONTS_STORE, []),
      replaceAll(GRAPHICS_STORE, []),
    ]);
  } catch {
    /* ignore — best-effort */
  }
}
