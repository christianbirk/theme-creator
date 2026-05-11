import { useCallback, useEffect, useState } from 'react';

/**
 * Lightweight light/dark mode hook.
 *
 * - First load uses the value persisted in localStorage. Falls back to
 *   the OS preference (`prefers-color-scheme: dark`) when nothing is
 *   stored, so first-time visitors with a dark-mode OS setup don't get
 *   blasted with a white interface.
 * - Toggles the `.dark` class on `<html>` (the selector our index.css
 *   uses for dark-mode tokens).
 * - Persists every change so the choice sticks across reloads.
 *
 * Exposed `toggle()` flips between light and dark; the explicit setter
 * is also returned for the rare case a consumer wants to lock to one
 * mode without round-tripping through the toggle.
 */
type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-creator-color-scheme';

function readInitial(): ColorScheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw in private/incognito modes — silently fall
    // through to the OS preference.
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function useColorScheme(): {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
  toggle: () => void;
} {
  const [scheme, setSchemeState] = useState<ColorScheme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (scheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      // Ignore storage failures — the in-memory state still drives the UI.
    }
  }, [scheme]);

  const toggle = useCallback(() => {
    setSchemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { scheme, setScheme: setSchemeState, toggle };
}
