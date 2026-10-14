import { isLiveStatus, type Match } from './model';

export const TTL = {
  live: 60,
  today: 120,
  future: 60 * 60,
  past: 60 * 60 * 24,
  standings: 60 * 10,
  scorers: 60 * 30,
  reference: 60 * 60 * 24,
  team: 60 * 60 * 12,
} as const;

/** Durée de vie adaptée à l'état des matchs : priorité aux matchs en cours. */
export function ttlForMatches(matches: Match[], now = Date.now()): number {
  if (matches.some((m) => isLiveStatus(m.status))) return TTL.live;
  // Un match commence dans moins de 15 min ou a commencé il y a moins de 2h30 sans être terminé
  const soon = matches.some((m) => {
    const t = Date.parse(m.utcDate);
    return m.status !== 'FINISHED' && t - now < 15 * 60e3 && now - t < 150 * 60e3;
  });
  if (soon) return TTL.live;
  const allFinished = matches.length > 0 && matches.every((m) => ['FINISHED', 'CANCELLED', 'POSTPONED'].includes(m.status));
  if (allFinished) {
    const last = Math.max(...matches.map((m) => Date.parse(m.utcDate)));
    return now - last > 6 * 3600e3 ? TTL.past : TTL.today;
  }
  const first = matches.length ? Math.min(...matches.map((m) => Date.parse(m.utcDate))) : Infinity;
  if (first - now > 24 * 3600e3) return TTL.future;
  return TTL.today;
}
