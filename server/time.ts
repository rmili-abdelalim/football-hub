export function validTimeZone(tz: string | null | undefined): string {
  if (!tz || tz.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz)) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Date locale (AAAA-MM-JJ) d'un instant ISO dans un fuseau donné */
export function localDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

export function isValidDay(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
}

export function addDays(d: string, n: number): string {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
}

/** Décalage en minutes du fuseau par rapport à UTC, à midi du jour donné */
export function tzOffsetMinutes(day: string, tz: string): number {
  const at = new Date(day + 'T12:00:00Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - at.getTime()) / 60000);
}
