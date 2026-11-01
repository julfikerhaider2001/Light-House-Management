import { useSyncExternalStore } from 'react';
import { isNative } from './native';

// Colour theme: light/dark mode plus an accent preset, remembered per device.
// Applied as data-theme / data-accent on <html>; tokens.css does the rest.

export type ThemeMode = 'system' | 'dark' | 'light';
export type AccentId = 'emerald' | 'ocean' | 'sunset' | 'violet' | 'rose' | 'gold';

export interface ThemePrefs {
  mode: ThemeMode;
  accent: AccentId;
}

/** Premade colour setups. `dark` / `light` are the accent in each mode (for swatches). */
export const ACCENTS: { id: AccentId; name: string; dark: string; light: string }[] = [
  { id: 'emerald', name: 'Emerald', dark: '#22e07a', light: '#0f9d58' },
  { id: 'ocean', name: 'Ocean', dark: '#4fb3ff', light: '#1f6fd1' },
  { id: 'sunset', name: 'Sunset', dark: '#ff9f43', light: '#c2620a' },
  { id: 'violet', name: 'Violet', dark: '#a78bfa', light: '#6d4ed8' },
  { id: 'rose', name: 'Rose', dark: '#ff6b9a', light: '#c62f66' },
  { id: 'gold', name: 'Gold', dark: '#f5c542', light: '#9a7400' },
];

const KEY = 'lh-theme';
const DEFAULTS: ThemePrefs = { mode: 'dark', accent: 'emerald' };
const BG = { dark: '#050807', light: '#f3f6f4' } as const;

const listeners = new Set<() => void>();
let prefs: ThemePrefs = read();

function read(): ThemePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ThemePrefs> | null;
    const mode = raw?.mode;
    const accent = raw?.accent;
    return {
      mode: mode === 'system' || mode === 'light' || mode === 'dark' ? mode : DEFAULTS.mode,
      accent: ACCENTS.some((a) => a.id === accent) ? (accent as AccentId) : DEFAULTS.accent,
    };
  } catch {
    return DEFAULTS;
  }
}

const systemQuery = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

/** The mode actually shown: 'system' follows the device. */
export function resolvedMode(p: ThemePrefs = prefs): 'dark' | 'light' {
  if (p.mode !== 'system') return p.mode;
  return systemQuery()?.matches ? 'light' : 'dark';
}

function apply() {
  const mode = resolvedMode();
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.accent = prefs.accent;
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[mode]);
  if (isNative()) {
    void import('@capacitor/status-bar').then(({ StatusBar, Style }) =>
      Promise.all([
        StatusBar.setStyle({ style: mode === 'light' ? Style.Light : Style.Dark }),
        StatusBar.setBackgroundColor({ color: BG[mode] }),
      ]).catch(() => undefined),
    );
  }
}

export function setTheme(next: Partial<ThemePrefs>) {
  prefs = { ...prefs, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  apply();
  for (const l of listeners) l();
}

/** Flips between light and dark (the universal toggle). */
export function toggleMode() {
  setTheme({ mode: resolvedMode() === 'dark' ? 'light' : 'dark' });
}

/** Call once before the first render. */
export function initTheme() {
  apply();
  systemQuery()?.addEventListener('change', () => {
    if (prefs.mode !== 'system') return;
    apply();
    for (const l of listeners) l();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => `${prefs.mode}|${prefs.accent}|${resolvedMode()}`;

export function useTheme(): ThemePrefs & { resolved: 'dark' | 'light' } {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return { ...prefs, resolved: resolvedMode() };
}
