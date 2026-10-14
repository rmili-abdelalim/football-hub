// Registre des compétitions et du fournisseur à utiliser pour chacune.
// Pour éviter les doublons, une compétition « supplémentaire » n'est servie que par UNE source :
// la première de sa liste qui est activée ET dont l'identifiant est validé (nom attendu).
// Aucune fusion d'entités n'est faite entre fournisseurs.
import { cached } from './cache';
import type { Competition, ProviderId } from './model';
import { afLeague, apiFootball } from './providers/apiFootball';
import { theSportsDb } from './providers/theSportsDb';

// Chaque identifiant est vérifié à l'exécution : si le nom renvoyé ne correspond pas,
// la compétition n'est pas affichée (on ne présente jamais une autre ligue à sa place).
type Source = { p: 'af' | 'tsdb'; id: string; expect: RegExp };

export interface ExtraCompetition {
  key: string;
  sources: Source[];
}

/** Compétitions mises en avant hors des 12 compétitions gratuites de football-data.org */
export const EXTRAS: ExtraCompetition[] = [
  {
    key: 'botola',
    sources: [
      { p: 'af', id: '200', expect: /^Botola Pro$/i },
      // TheSportsDB nomme la Botola Pro « Moroccan Championship » (id 4520, vérifié le 14/10/2026).
      // Attention : « Moroccan Botola 2 » (id 4657) est la 2e division.
      { p: 'tsdb', id: '4520', expect: /^Moroccan Championship$|^Botola Pro$/i },
    ],
  },
  { key: 'europa-league', sources: [{ p: 'af', id: '3', expect: /^UEFA Europa League$/i }] },
  { key: 'caf-champions-league', sources: [{ p: 'af', id: '12', expect: /CAF Champions League/i }] },
  { key: 'afcon', sources: [{ p: 'af', id: '6', expect: /^Africa Cup of Nations$/i }] },
];

export interface ResolvedExtra {
  key: string;
  provider: ProviderId;
  rawId: string;
  competition: Competition;
}

async function resolveOne(extra: ExtraCompetition): Promise<ResolvedExtra | null> {
  for (const s of extra.sources) {
    try {
      if (s.p === 'af') {
        if (!apiFootball.enabled()) continue;
        const c = await afLeague(s.id);
        if (!s.expect.test(c.name)) continue; // identifiant configuré invalide : on n'affiche rien
        return { key: extra.key, provider: 'af', rawId: s.id, competition: c };
      }
      if (s.p === 'tsdb') {
        const c = await theSportsDb.competition!(s.id);
        if (!s.expect.test(c.officialName ?? c.name)) continue;
        return { key: extra.key, provider: 'tsdb', rawId: s.id, competition: c };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveExtras(): Promise<{ extras: ResolvedExtra[]; fetchedAt: string; stale: boolean }> {
  const afOn = apiFootball.enabled() ? 'af' : 'noaf';
  const r = await cached(
    `registry:extras:v2:${afOn}`,
    (v: ResolvedExtra[]) => (v.length ? 60 * 60 * 24 : 60 * 30),
    async () => {
      const out: ResolvedExtra[] = [];
      for (const e of EXTRAS) {
        const x = await resolveOne(e);
        if (x) out.push(x);
      }
      return out;
    },
  );
  return { extras: r.value, fetchedAt: r.fetchedAt, stale: r.stale };
}
