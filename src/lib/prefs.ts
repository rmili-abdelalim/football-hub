import { createStore } from './store';

export type Theme = 'light' | 'dark' | 'system';

export interface Prefs {
  theme: Theme;
  /** null = fuseau de l'appareil */
  timeZone: string | null;
  lang?: string;
}

const DEFAULT: Prefs = { theme: 'system', timeZone: null };

function validate(v: unknown): Prefs {
  const o = (v ?? {}) as Partial<Prefs>;
  return {
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'system',
    timeZone: typeof o.timeZone === 'string' && isTz(o.timeZone) ? o.timeZone : null,
    lang: typeof o.lang === 'string' ? o.lang : undefined,
  };
}

export function isTz(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const prefs = createStore<Prefs>('fh:prefs', DEFAULT, validate);

export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function useTimeZone() {
  const p = prefs.use();
  return p.timeZone ?? deviceTimeZone();
}

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && mq.matches);
  document.documentElement.classList.toggle('dark', dark);
}

mq.addEventListener('change', () => applyTheme(prefs.get().theme));
