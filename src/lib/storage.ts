// Per-device conveniences only (remembered mess, last tab). Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

export function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Not persisted; the app still works.
  }
}
