// Petit magasin persistant (localStorage) partagé entre composants et onglets.
import { useSyncExternalStore } from 'react';

export function createStore<T>(key: string, initial: T, validate: (v: unknown) => T) {
  let state: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = validate(JSON.parse(raw));
  } catch {
    state = initial;
  }
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  window.addEventListener('storage', (e) => {
    if (e.key !== key) return;
    try {
      state = e.newValue ? validate(JSON.parse(e.newValue)) : initial;
    } catch {
      state = initial;
    }
    emit();
  });

  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* stockage plein ou désactivé : l'état reste en mémoire */
      }
      emit();
    },
    reset() {
      state = initial;
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      emit();
    },
    use(): T {
      return useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => state,
      );
    },
  };
}
