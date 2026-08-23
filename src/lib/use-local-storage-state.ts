"use client";

import { useSyncExternalStore } from "react";

type Entry<T> = { raw: string | null; value: T };
const cache = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const cb of listeners.get(key) ?? []) cb();
}

/**
 * A localStorage-backed piece of state that's safe to read during SSR and
 * hydration: the server snapshot is always `fallback`, so the first client
 * render matches the server-rendered markup exactly, and the persisted
 * value (if any) is picked up on the very next render via
 * useSyncExternalStore — no `useState` + restore-on-mount `useEffect`,
 * which reads localStorage synchronously during hydration too and trips a
 * hydration mismatch the moment the stored value differs from the default.
 *
 * `parse` takes the raw stored string and returns the value, or null if it
 * isn't valid (falls back to `fallback`). `serialize` controls how a value
 * is written back; defaults to JSON.stringify.
 */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string = (v) => JSON.stringify(v),
): [T, (value: T) => void] {
  const subscribe = (cb: () => void) => {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(cb);
    return () => set.delete(cb);
  };

  const getSnapshot = (): T => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return fallback;
    }
    const cached = cache.get(key) as Entry<T> | undefined;
    if (cached && cached.raw === raw) return cached.value;
    let value = fallback;
    if (raw !== null) {
      try {
        const parsed = parse(raw);
        if (parsed !== null) value = parsed;
      } catch {
        /* corrupt storage — fall back */
      }
    }
    cache.set(key, { raw, value });
    return value;
  };

  const getServerSnapshot = () => fallback;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = (next: T) => {
    const raw = serialize(next);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* storage unavailable */
    }
    cache.set(key, { raw, value: next });
    notify(key);
  };

  return [value, setValue];
}
