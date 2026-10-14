import { useTranslation } from 'react-i18next';
import { useTimeZone } from './prefs';

function locale(lng: string) {
  // Chiffres latins en arabe : plus lisibles pour les scores et usuels au Maghreb
  return lng.startsWith('ar') ? 'ar-MA-u-nu-latn' : lng.startsWith('en') ? 'en-GB' : 'fr-FR';
}

export function useFormat() {
  const { i18n } = useTranslation();
  const tz = useTimeZone();
  const loc = locale(i18n.resolvedLanguage ?? 'fr');
  return {
    tz,
    time: (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
    date: (iso: string) =>
      new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)),
    longDate: (iso: string) =>
      new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)),
    dayLabel: (day: string) =>
      new Intl.DateTimeFormat(loc, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(day + 'T12:00:00Z')),
    birth: (d: string) => new Intl.DateTimeFormat(loc, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)),
    localDay: (iso: string) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)),
  };
}

export function todayIn(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(day: string, n: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
}

export function ageFrom(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
