// Couche de service : choisit l'adaptateur selon le préfixe d'identifiant,
// applique le cache partagé et construit l'enveloppe { data, meta }.
import { cached, type CachedResult } from './cache';
import {
  ATTRIBUTION,
  type ApiMeta,
  type ApiResponse,
  type Competition,
  type Match,
  type ProviderId,
  type TeamRef,
} from './model';
import { afFixturesOnDay, apiFootball } from './providers/apiFootball';
import { FD_FREE_CODES, footballData } from './providers/footballData';
import { theSportsDb, tsdbEventsOnDay, tsdbIsFreeKey } from './providers/theSportsDb';
import { NotSupportedError, type SportsProvider } from './providers/types';
import { QuotaError, UpstreamError } from './quota';
import { resolveExtras } from './registry';
import { addDays, localDay, tzOffsetMinutes } from './time';
import { TTL, ttlForMatches } from './ttl';

const PROVIDERS: Record<ProviderId, SportsProvider> = { fd: footballData, tsdb: theSportsDb, af: apiFootball };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** "fd:PL" → { provider, raw: "PL" } ; refuse tout identifiant mal formé */
export function parseId(id: string): { provider: SportsProvider; raw: string } {
  const m = /^(fd|tsdb|af):([A-Za-z0-9]{1,12})$/.exec(id);
  if (!m) throw new HttpError(400, 'Identifiant invalide');
  const provider = PROVIDERS[m[1] as ProviderId];
  if (!provider.enabled()) throw new HttpError(503, `Source ${m[1]} non configurée`);
  return { provider, raw: m[2] };
}

class Meta {
  providers = new Set<ProviderId>();
  fetchedAt: string[] = [];
  stale = false;
  warnings: string[] = [];
  add(p: ProviderId, r: CachedResult<unknown>) {
    this.providers.add(p);
    this.fetchedAt.push(r.fetchedAt);
    if (r.stale) this.stale = true;
  }
  build(): ApiMeta {
    const ps = [...this.providers];
    return {
      provider: ps.length === 1 ? ps[0] : ps,
      // la donnée la plus ancienne fait foi pour l'affichage « mis à jour à »
      fetchedAt: this.fetchedAt.sort()[0] ?? new Date().toISOString(),
      delayed: ps.some((p) => PROVIDERS[p].delayed),
      stale: this.stale,
      attribution: ps.map((p) => ATTRIBUTION[p]),
      warnings: this.warnings.length ? this.warnings : undefined,
    };
  }
}

function friendly(e: unknown): string {
  if (e instanceof QuotaError) return 'quota';
  if (e instanceof UpstreamError) return e.status === 429 ? 'quota' : 'upstream';
  return 'error';
}

async function one<T>(
  p: SportsProvider,
  key: string,
  ttl: number | ((v: T) => number),
  fn: () => Promise<T>,
): Promise<ApiResponse<T>> {
  const meta = new Meta();
  try {
    const r = await cached(`${p.id}:${key}`, ttl, fn);
    meta.add(p.id, r);
    // Listes tronquées par la clé publique TheSportsDB : on le signale au lieu de les présenter comme complètes
    if (p.id === 'tsdb' && tsdbIsFreeKey() && /^(standings|cmatches|cteams|tmatches):/.test(key)) meta.warnings.push('tsdb:partial');
    return { data: r.value, meta: meta.build() };
  } catch (e) {
    if (e instanceof NotSupportedError) throw new HttpError(404, e.message);
    if ((e as any)?.status === 404) throw new HttpError(404, (e as Error).message);
    if (e instanceof UpstreamError && (e.status === 403 || e.status === 404)) throw new HttpError(404, e.message);
    if (e instanceof QuotaError || (e instanceof UpstreamError && e.status === 429))
      throw new HttpError(503, 'Quota de la source atteint, réessayez dans un instant');
    throw new HttpError(502, 'Source de données indisponible');
  }
}

function need<K extends keyof SportsProvider>(p: SportsProvider, k: K): NonNullable<SportsProvider[K]> {
  const f = p[k];
  if (!f) throw new HttpError(404, `Donnée non fournie par la source (${String(k)})`);
  return (f as any).bind(p);
}

// ---------- Compétitions ----------

export async function listCompetitions(): Promise<ApiResponse<Competition[]>> {
  const meta = new Meta();
  const out: Competition[] = [];
  if (footballData.enabled()) {
    try {
      const r = await cached('fd:competitions', TTL.reference, () => footballData.competitions!());
      meta.add('fd', r);
      const order = FD_FREE_CODES as readonly string[];
      out.push(...r.value.sort((a, b) => order.indexOf(a.code ?? '') - order.indexOf(b.code ?? '')));
    } catch (e) {
      meta.warnings.push(`fd:${friendly(e)}`);
    }
  } else {
    meta.warnings.push('fd:not-configured');
  }
  try {
    const x = await resolveExtras();
    for (const e of x.extras) {
      meta.providers.add(e.provider);
      meta.fetchedAt.push(x.fetchedAt);
      if (x.stale) meta.stale = true;
      out.push({ ...e.competition });
    }
  } catch (e) {
    meta.warnings.push(`extras:${friendly(e)}`);
  }
  return { data: out, meta: meta.build() };
}

export async function getCompetition(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `competition:${raw}`, TTL.reference, () => need(provider, 'competition')(raw));
}

export async function getStandings(id: string, season?: number) {
  const { provider, raw } = parseId(id);
  return one(provider, `standings:${raw}:${season ?? 'cur'}`, season ? TTL.past : TTL.standings, () =>
    need(provider, 'standings')(raw, season),
  );
}

export async function getCompetitionMatches(id: string, season?: number) {
  const { provider, raw } = parseId(id);
  return one(provider, `cmatches:${raw}:${season ?? 'cur'}`, (v: Match[]) => (season ? TTL.past : Math.min(ttlForMatches(v), TTL.standings)), () =>
    need(provider, 'competitionMatches')(raw, season),
  );
}

export async function getScorers(id: string, season?: number) {
  const { provider, raw } = parseId(id);
  return one(provider, `scorers:${raw}:${season ?? 'cur'}`, TTL.scorers, () => need(provider, 'scorers')(raw, season));
}

export async function getCompetitionTeams(id: string, season?: number) {
  const { provider, raw } = parseId(id);
  return one(provider, `cteams:${raw}:${season ?? 'cur'}`, TTL.reference, () =>
    need(provider, 'competitionTeams')(raw, season),
  );
}

// ---------- Matchs ----------

export async function getMatchesForDay(day: string, tz: string): Promise<ApiResponse<Match[]>> {
  const meta = new Meta();
  const all: Match[] = [];
  const tasks: Promise<void>[] = [];

  if (footballData.enabled()) {
    // Une journée locale peut chevaucher deux jours UTC : on prend J-1..J+1 puis on filtre.
    const from = addDays(day, -1);
    const to = addDays(day, 1);
    tasks.push(
      cached(`fd:matches:${from}:${to}`, (v: Match[]) => ttlForMatches(v), () => footballData.matchesBetween!(from, to))
        .then((r) => {
          meta.add('fd', r);
          all.push(...r.value);
        })
        .catch((e) => {
          meta.warnings.push(`fd:${friendly(e)}`);
        }),
    );
  } else {
    meta.warnings.push('fd:not-configured');
  }

  tasks.push(
    resolveExtras()
      .then(async ({ extras }) => {
        const afIds = extras.filter((e) => e.provider === 'af').map((e) => e.rawId);
        const tsdbIds = extras.filter((e) => e.provider === 'tsdb').map((e) => e.rawId);
        const sub: Promise<void>[] = [];
        if (afIds.length) {
          // Un seul appel par date (paramètre timezone) pour toutes les ligues API-Football
          sub.push(
            cached(`af:day:${day}:${tz}:${afIds.join('-')}`, (v: Match[]) => afDayTtl(day, v), () =>
              afFixturesOnDayTz(day, tz, afIds),
            )
              .then((r) => {
                meta.add('af', r);
                all.push(...r.value);
              })
              .catch((e) => {
                meta.warnings.push(`af:${friendly(e)}`);
              }),
          );
        }
        const off = tzOffsetMinutes(day, tz);
        const utcDays = off > 0 ? [addDays(day, -1), day] : off < 0 ? [day, addDays(day, 1)] : [day];
        for (const id of tsdbIds) {
          for (const d of utcDays) {
            sub.push(
              cached(`tsdb:day:${id}:${d}`, (v: Match[]) => ttlForMatches(v), () => tsdbEventsOnDay(id, d))
                .then((r) => {
                  meta.add('tsdb', r);
                  all.push(...r.value);
                })
                .catch((e) => {
                  meta.warnings.push(`tsdb:${friendly(e)}`);
                }),
            );
          }
        }
        await Promise.all(sub);
      })
      .catch((e) => {
        meta.warnings.push(`extras:${friendly(e)}`);
      }),
  );

  await Promise.all(tasks);

  const seen = new Set<string>();
  const data = all
    .filter((m) => localDay(m.utcDate, tz) === day)
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))) // doublons stricts (même identifiant)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate) || a.competition.name.localeCompare(b.competition.name));
  meta.warnings = [...new Set(meta.warnings)];
  return { data, meta: meta.build() };
}

function afDayTtl(day: string, v: Match[]) {
  // Budget de 100 appels/jour : on espace davantage qu'avec football-data.org
  const today = new Date().toISOString().slice(0, 10);
  if (v.some((m) => m.status === 'LIVE' || m.status === 'HALFTIME')) return 5 * 60;
  if (day === today) return 20 * 60;
  return day < today ? TTL.past : 6 * 3600;
}

async function afFixturesOnDayTz(day: string, tz: string, ids: string[]) {
  // Le paramètre timezone renvoie directement les matchs de la journée locale : un seul appel
  return afFixturesOnDay(day, ids, tz);
}

export async function getMatch(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `match:${raw}`, (m: Match) => ttlForMatches([m]), () => need(provider, 'match')(raw));
}

export async function getHeadToHead(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `h2h:${raw}`, TTL.team, () => need(provider, 'headToHead')(raw));
}

// ---------- Équipes et joueurs ----------

export async function getTeam(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `team:${raw}`, TTL.team, () => need(provider, 'team')(raw));
}

export async function getTeamMatches(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `tmatches:${raw}`, (v: Match[]) => Math.min(ttlForMatches(v), TTL.future), () =>
    need(provider, 'teamMatches')(raw),
  );
}

export async function getPerson(id: string) {
  const { provider, raw } = parseId(id);
  return one(provider, `person:${raw}`, TTL.team, () => need(provider, 'person')(raw));
}

// ---------- Recherche ----------

export interface SearchResult {
  competitions: Competition[];
  teams: (TeamRef & { competition?: string })[];
}

/**
 * Recherche dans les compétitions et dans un index d'équipes construit
 * à partir des listes d'équipes déjà en cache (aucune rafale d'appels).
 */
export async function search(q: string): Promise<ApiResponse<SearchResult>> {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const needle = norm(q.trim());
  const comps = await listCompetitions();
  const meta = new Meta();
  for (const p of [comps.meta.provider].flat()) meta.providers.add(p);
  meta.fetchedAt.push(comps.meta.fetchedAt);

  const teams = new Map<string, TeamRef & { competition?: string }>();
  // L'index se remplit progressivement : on tente quelques listes par recherche, les autres viennent du cache.
  let budget = 3;
  for (const c of comps.data) {
    if (!c.features.teams) continue;
    try {
      const { provider, raw } = parseId(c.id);
      const key = `${provider.id}:cteams:${raw}:cur`;
      const fn = () => need(provider, 'competitionTeams')(raw, undefined);
      const r = await cachedOnlyOr(key, TTL.reference, fn, budget > 0);
      if (!r) continue;
      if (!r.fromCache) budget--;
      for (const t of r.value) if (!teams.has(t.id)) teams.set(t.id, { ...t, competition: c.name });
    } catch {
      /* index partiel : on continue */
    }
  }
  const data: SearchResult = {
    competitions: comps.data.filter((c) => norm(c.name).includes(needle) || norm(c.area?.name ?? '').includes(needle)),
    teams: [...teams.values()]
      .filter((t) => norm(t.name).includes(needle) || norm(t.shortName ?? '').includes(needle) || norm(t.tla ?? '') === needle)
      .slice(0, 30),
  };
  return { data, meta: meta.build() };
}

async function cachedOnlyOr<T>(key: string, ttl: number, fn: () => Promise<T>, allowFetch: boolean) {
  if (allowFetch) return cached(key, ttl, fn).catch(() => null);
  const { getKV } = await import('./cache');
  const kv = await getKV();
  const e = (await kv.get(key)) as { value: T; storedAt: number } | null;
  return e ? { value: e.value, fromCache: true } : null;
}

export function status() {
  return {
    providers: {
      fd: { configured: footballData.enabled(), delayed: true },
      tsdb: { configured: theSportsDb.enabled(), delayed: true },
      af: { configured: apiFootball.enabled(), delayed: false },
    },
  };
}
