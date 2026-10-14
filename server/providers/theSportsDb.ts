// Adaptateur TheSportsDB (API v1). Clé publique gratuite "123" par défaut.
// Données communautaires : listes tronquées sur l'offre gratuite, pas de direct.
import type { Competition, Match, MatchStatus, StandingTable, Team, TeamRef } from '../model';
import { quotaFetch } from '../quota';
import { num, safeImg, str, type SportsProvider } from './types';

const RULE = { perMinute: 25 };

/** Nom officiel à afficher quand la source utilise un libellé générique.
 *  Justifié par strLeagueAlternate de la source (« Botola Pro Inwi, Botola Pro »). */
const DISPLAY_NAMES: Record<string, string> = { '4520': 'Botola Pro' };

/** La clé publique tronque les listes (5 lignes de classement, 15 matchs par saison). */
export function tsdbIsFreeKey() {
  const k = process.env.THESPORTSDB_KEY?.trim();
  return !k || k === '123' || k === '3';
}
const P = (id: unknown) => `tsdb:${id}`;

function base() {
  const key = process.env.THESPORTSDB_KEY?.trim() || '123';
  return `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}`;
}

async function get(path: string) {
  const { json } = await quotaFetch('tsdb', RULE, `${base()}${path}`);
  return json ?? {};
}

export function mapStatus(s: unknown, home: unknown, away: unknown, utc: string): MatchStatus {
  const v = String(s ?? '').toLowerCase();
  if (['match finished', 'ft', 'aet', 'pen', 'awd', 'wo', 'aot'].includes(v)) return 'FINISHED';
  if (['1h', '2h', 'et', 'p', 'bt', 'live', 'in progress'].includes(v)) return 'LIVE';
  if (v === 'ht') return 'HALFTIME';
  if (v.includes('postponed') || v === 'pst') return 'POSTPONED';
  if (v.includes('cancel') || v === 'canc' || v === 'abd' || v.includes('abandon')) return 'CANCELLED';
  if (v === 'ns' || v === 'not started' || v === 'tbd' || v === '') {
    // Statut absent : si un score existe et que la date est passée, on ne conclut rien de plus
    // que « terminé » lorsque le coup d'envoi date de plus de 3 heures.
    if (num(home) !== null && num(away) !== null && Date.now() - Date.parse(utc) > 3 * 3600e3) return 'FINISHED';
    return 'SCHEDULED';
  }
  return 'UNKNOWN';
}

function utcOf(e: any): string {
  const ts = str(e.strTimestamp);
  if (ts) return ts.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(ts) ? new Date(ts).toISOString() : new Date(ts + 'Z').toISOString();
  const d = str(e.dateEvent);
  const t = str(e.strTime) ?? '00:00:00';
  return d ? new Date(`${d}T${t.slice(0, 8)}Z`).toISOString() : new Date(0).toISOString();
}

export function mapEvent(e: any): Match {
  const utcDate = utcOf(e);
  return {
    id: P(e.idEvent),
    provider: 'tsdb',
    competition: {
      id: P(e.idLeague),
      name: DISPLAY_NAMES[String(e.idLeague)] ?? str(e.strLeague) ?? '—',
      emblem: safeImg(e.strLeagueBadge),
      area: str(e.strCountry) ? { name: e.strCountry } : undefined,
    },
    season: str(e.strSeason),
    matchday: num(e.intRound) ?? undefined,
    utcDate,
    status: mapStatus(e.strStatus, e.intHomeScore, e.intAwayScore, utcDate),
    venue: str(e.strVenue),
    home: { id: P(e.idHomeTeam), name: str(e.strHomeTeam) ?? '—', crest: safeImg(e.strHomeTeamBadge) },
    away: { id: P(e.idAwayTeam), name: str(e.strAwayTeam) ?? '—', crest: safeImg(e.strAwayTeamBadge) },
    score: { home: num(e.intHomeScore), away: num(e.intAwayScore) },
  };
}

function mapLeague(l: any): Competition {
  const label = str(l.strCurrentSeason);
  return {
    id: P(l.idLeague),
    provider: 'tsdb',
    name: DISPLAY_NAMES[String(l.idLeague)] ?? str(l.strLeague) ?? '—',
    officialName: str(l.strLeague),
    emblem: safeImg(l.strBadge),
    area: str(l.strCountry) ? { name: l.strCountry } : undefined,
    type: 'LEAGUE',
    currentSeason: label ? { label, year: Number(label.slice(0, 4)) } : undefined,
    features: { standings: true, scorers: false, matches: true, teams: true },
  };
}

function seasonParam(comp: Competition | null, season?: number) {
  if (!season) return comp?.currentSeason?.label;
  // Les saisons européennes s'écrivent "2026-2027", les saisons civiles "2026"
  const cur = comp?.currentSeason?.label ?? '';
  return cur.includes('-') ? `${season}-${season + 1}` : String(season);
}

export const theSportsDb: SportsProvider = {
  id: 'tsdb',
  delayed: true,
  enabled: () => true,

  async competition(id) {
    const json = await get(`/lookupleague.php?id=${id}`);
    const l = (json.leagues ?? [])[0];
    if (!l) throw Object.assign(new Error('Compétition introuvable'), { status: 404 });
    const c = mapLeague(l);
    c.seasons = undefined;
    return c;
  },

  async standings(id, season) {
    const comp = await theSportsDb.competition!(id).catch(() => null);
    const s = seasonParam(comp, season);
    const json = await get(`/lookuptable.php?l=${id}${s ? `&s=${encodeURIComponent(s)}` : ''}`);
    const rows = (json.table ?? []).map((r: any) => ({
      position: num(r.intRank) ?? 0,
      team: { id: P(r.idTeam), name: str(r.strTeam) ?? '—', crest: safeImg(r.strBadge ?? r.strTeamBadge) } as TeamRef,
      played: num(r.intPlayed) ?? 0,
      won: num(r.intWin) ?? 0,
      draw: num(r.intDraw) ?? 0,
      lost: num(r.intLoss) ?? 0,
      goalsFor: num(r.intGoalsFor) ?? 0,
      goalsAgainst: num(r.intGoalsAgainst) ?? 0,
      goalDiff: num(r.intGoalDifference) ?? 0,
      points: num(r.intPoints) ?? 0,
      form: str(r.strForm)?.split('').join(','),
    }));
    return rows.length ? [{ rows } as StandingTable] : [];
  },

  async competitionMatches(id, season) {
    const comp = await theSportsDb.competition!(id).catch(() => null);
    const s = seasonParam(comp, season);
    if (!s) return [];
    const json = await get(`/eventsseason.php?id=${id}&s=${encodeURIComponent(s)}`);
    return (json.events ?? []).map(mapEvent);
  },

  async competitionTeams(id) {
    const json = await get(`/lookup_all_teams.php?id=${id}`);
    return (json.teams ?? []).map((t: any) => ({
      id: P(t.idTeam),
      name: str(t.strTeam) ?? '—',
      shortName: str(t.strTeamShort),
      crest: safeImg(t.strBadge),
    }));
  },

  async match(id) {
    const json = await get(`/lookupevent.php?id=${id}`);
    const e = (json.events ?? [])[0];
    if (!e) throw Object.assign(new Error('Match introuvable'), { status: 404 });
    return mapEvent(e);
  },

  async team(id) {
    const json = await get(`/lookupteam.php?id=${id}`);
    const t = (json.teams ?? [])[0];
    if (!t) throw Object.assign(new Error('Équipe introuvable'), { status: 404 });
    const team: Team = {
      id: P(t.idTeam),
      provider: 'tsdb',
      name: str(t.strTeam) ?? '—',
      shortName: str(t.strTeamShort),
      crest: safeImg(t.strBadge),
      area: str(t.strCountry) ? { name: t.strCountry } : undefined,
      founded: num(t.intFormedYear) ?? undefined,
      venue: str(t.strStadium),
      website: str(t.strWebsite) ? `https://${String(t.strWebsite).replace(/^https?:\/\//, '')}` : undefined,
      description: str(t.strDescriptionFR) ?? str(t.strDescriptionEN),
      runningCompetitions: str(t.idLeague) ? [{ id: P(t.idLeague), name: DISPLAY_NAMES[String(t.idLeague)] ?? str(t.strLeague) ?? '—' }] : undefined,
    };
    return team;
  },

  async teamMatches(id) {
    const [past, next] = await Promise.all([
      get(`/eventslast.php?id=${id}`).catch(() => ({})),
      get(`/eventsnext.php?id=${id}`).catch(() => ({})),
    ]);
    return [...(past.results ?? []), ...(next.events ?? [])].map(mapEvent);
  },
};

/** Matchs d'une ligue TheSportsDB pour une date (AAAA-MM-JJ). */
export async function tsdbEventsOnDay(leagueId: string, day: string): Promise<Match[]> {
  const json = await get(`/eventsday.php?d=${day}&l=${leagueId}`);
  return (json.events ?? []).map(mapEvent);
}
