/**
 * Local persistence of the theme customizer working state.
 *
 * The app used to hold *everything* in React `useState` alone, so any
 * page reload (Chrome discarding an inactive tab, a Vite HMR full
 * reload, an OS suspend) wiped the user's work back to the bundled
 * sample. This module round-trips the text-only parts of that state
 * through `localStorage` so the working session survives reloads.
 *
 * Not persisted here: `customFonts` and `customGraphics` (Blob-backed
 * — need IndexedDB, tracked as Level 2).
 */
import type { CSSVariable } from '@/components/theme-customizer/types';
import type { CssClassesData } from '@shared/schema';
import type { ScssFile } from '@/components/theme-customizer/CustomCssManager';
import type { JsFile } from '@/components/theme-customizer/CustomJsManager';

const STORAGE_KEY = 'theme-customizer-state:v1';
const DEBOUNCE_MS = 400;

export interface PersistedState {
  variables: CSSVariable[];
  scssFiles: ScssFile[];
  jsFiles: JsFile[];
  cssClassesData: CssClassesData;
  originalDefaults: [string, string][]; // Map serialized as entries
  baseScss: string;
  savedAt: string;
}

export function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Minimal sanity check — anything malformed → fall back to sample.
    if (!Array.isArray(parsed.variables)) return null;
    return parsed;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersistedSave(state: Omit<PersistedState, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const payload: PersistedState = { ...state, savedAt: new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Quota exceeded or private mode — surface once, don't spam.
      console.warn('theme-customizer: could not persist state', err);
    }
  }, DEBOUNCE_MS);
}

export function clearPersistedState(): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
