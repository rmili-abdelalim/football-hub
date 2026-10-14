// Adaptateur API-Football (v3) — optionnel, activé seulement si API_FOOTBALL_KEY est défini.
// Offre gratuite : 100 requêtes/jour. Un budget journalier strict est appliqué côté serveur.
import type { Competition, Lineup, Match, MatchEvent, MatchStatus, Scorer, StandingTable, StatPair, Team } from '../model';
import { quotaFetch, UpstreamError } from '../quota';
import { num, safeImg, str, type SportsProvider } from './types';

const BASE = 'https://v3.football.api-sports.io';
const P = (id: unknown) => `af:${id}`;

function key() {
  return process.env.API_FOOTBALL_KEY?.trim() || '';
}
function rule() {
  const budget = Number(process.env.API_FOOTBALL_DAILY_BUDGET ?? 90);
  return { perMinute: 8, perDay: Number.isFinite(budget) ? Math.min(Math.max(budget, 1), 100) : 90 };
}

async function get(path: string) {
  const { json } = await quotaFetch('af', rule(), `${BASE}${path}`, { 'x-apisports-key': key() });
  const errors = json?.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    // Ex. : « Free plans do not have access to this season » → on remonte une erreur explicite
    const msg = Array.isArray(errors) ? errors.join(' ') : Object.values(errors).join(' ');
    throw new UpstreamError('af', 403, `API-Football : ${msg}`);
  }
  return json;
}

export function mapStatus(short: unknown): MatchStatus {
  switch (short) {
    case 'TBD':
    case 'NS':
      return 'SCHEDULED';
    case '1H':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
    case 'INT':
      return 'LIVE';
    case 'HT':
      return 'HALFTIME';
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
    case 'WO':
      return 'FINISHED';
    case 'PST':
      return 'POSTPONED';
    case 'CANC':
    case 'ABD':
      return 'CANCELLED';
    case 'SUSP':
      return 'SUSPENDED';
    default:
      return 'UNKNOWN';
  }
}

const STAT_KEYS: Record<string, { key: string; unit?: '%' }> = {
  'Ball Possession': { key: 'possession', unit: '%' },
  'Total Shots': { key: 'shots' },
  'Shots on Goal': { key: 'shotsOnTarget' },
  'Shots off Goal': { key: 'shotsOffTarget' },
  'Blocked Shots': { key: 'blockedShots' },
  'Corner Kicks': { key: 'corners' },
  Fouls: { key: 'fouls' },
  Offsides: { key: 'offsides' },
  'Yellow Cards': { key: 'yellow' },
  'Red Cards': { key: 'red' },
  'Goalkeeper Saves': { key: 'saves' },
  'Total passes': { key: 'passes' },
  'Passes %': { key: 'passAccuracy', unit: '%' },
  expected_goals: { key: 'xg' },
};

function statValue(v: unknown): number | null {
  if (typeof v === 'string') return num(v.replace('%', ''));
  return num(v);
}

export function mapFixture(f: any): Match {
  const homeId = f.teams?.home?.id;
  const m: Match = {
    id: P(f.fixture?.id),
    provider: 'af',
    competition: {
      id: P(f.league?.id),
      name: str(f.league?.name) ?? '—',
      emblem: safeImg(f.league?.logo),
      area: str(f.league?.country) ? { name: f.league.country, flag: safeImg(f.league?.flag) } : undefined,
    },
    season: f.league?.season ? String(f.league.season) : undefined,
    stage: str(f.league?.round),
    utcDate: new Date(String(f.fixture?.date)).toISOString(),
    status: mapStatus(f.fixture?.status?.short),
    minute: num(f.fixture?.status?.elapsed) ?? undefined,
    venue: [str(f.fixture?.venue?.name), str(f.fixture?.venue?.city)].filter(Boolean).join(', ') || undefined,
    referee: str(f.fixture?.referee),
    home: { id: P(f.teams?.home?.id), name: str(f.teams?.home?.name) ?? '—', crest: safeImg(f.teams?.home?.logo) },
    away: { id: P(f.teams?.away?.id), name: str(f.teams?.away?.name) ?? '—', crest: safeImg(f.teams?.away?.logo) },
    score: { home: num(f.goals?.home), away: num(f.goals?.away) },
  };
  const ht = f.score?.halftime;
  if (ht && (ht.home !== null || ht.away !== null)) m.score.halfTime = { home: num(ht.home), away: num(ht.away) };
  const pen = f.score?.penalty;
  if (pen && (pen.home !== null || pen.away !== null)) m.score.penalties = { home: num(pen.home), away: num(pen.away) };

  if (Array.isArray(f.events) && f.events.length) {
    m.events = f.events.map((e: any): MatchEvent => {
      const detail = String(e.detail ?? '');
      const t = String(e.type ?? '').toLowerCase();
      let type: MatchEvent['type'] = 'OTHER';
      if (t === 'goal') type = detail === 'Own Goal' ? 'OWN_GOAL' : detail === 'Penalty' ? 'PENALTY_GOAL' : detail === 'Missed Penalty' ? 'OTHER' : 'GOAL';
      else if (t === 'card') type = detail === 'Red Card' ? 'RED' : detail === 'Second Yellow card' ? 'SECOND_YELLOW' : 'YELLOW';
      else if (t === 'subst') type = 'SUB';
      else if (t === 'var') type = 'VAR';
      return {
        minute: num(e.time?.elapsed) ?? undefined,
        extraMinute: num(e.time?.extra) ?? undefined,
        type,
        team: e.team?.id === homeId ? 'home' : 'away',
        player: str(e.player?.name),
        assist: str(e.assist?.name),
        detail: str(e.detail),
      };
    });
  }

  if (Array.isArray(f.lineups) && f.lineups.length === 2) {
    const mapL = (l: any): Lineup => ({
      formation: str(l.formation),
      coach: str(l.coach?.name),
      startXI: (l.startXI ?? []).map((p: any) => ({ id: p.player?.id ? P(p.player.id) : undefined, name: str(p.player?.name) ?? '—', number: num(p.player?.number) ?? undefined, position: str(p.player?.pos) })),
      substitutes: (l.substitutes ?? []).map((p: any) => ({ id: p.player?.id ? P(p.player.id) : undefined, name: str(p.player?.name) ?? '—', number: num(p.player?.number) ?? undefined, position: str(p.player?.pos) })),
    });
    const h = f.lineups.find((l: any) => l.team?.id === homeId) ?? f.lineups[0];
    const a = f.lineups.find((l: any) => l !== h) ?? f.lineups[1];
    m.lineups = { home: mapL(h), away: mapL(a) };
  }

  if (Array.isArray(f.statistics) && f.statistics.length === 2) {
    const hs = f.statistics.find((s: any) => s.team?.id === homeId) ?? f.statistics[0];
    const as = f.statistics.find((s: any) => s !== hs) ?? f.statistics[1];
    const stats: StatPair[] = [];
    for (const item of hs.statistics ?? []) {
      const def = STAT_KEYS[item.type];
      if (!def) continue;
      const other = (as.statistics ?? []).find((x: any) => x.type === item.type);
      const home = statValue(item.value);
      const away = statValue(other?.value);
      if (home === null && away === null) continue;
      stats.push({ key: def.key, home, away, unit: def.unit });
    }
    if (stats.length) m.stats = stats;
  }
  return m;
}

/** Infos d'une ligue + saison courante (sert aussi à valider l'identifiant configuré). */
export async function afLeague(id: string): Promise<Competition> {
  const json = await get(`/leagues?id=${id}`);
  const r = (json.response ?? [])[0];
  if (!r) throw Object.assign(new Error('Ligue introuvable'), { status: 404 });
  const seasons: any[] = r.seasons ?? [];
  const cur = seasons.find((s) => s.current) ?? seasons[seasons.length - 1];
  const cov = cur?.coverage ?? {};
  return {
    id: P(r.league?.id),
    provider: 'af',
    name: str(r.league?.name) ?? '—',
    emblem: safeImg(r.league?.logo),
    area: r.country ? { name: str(r.country.name) ?? '', code: str(r.country.code), flag: safeImg(r.country.flag) } : undefined,
    type: r.league?.type === 'Cup' ? 'CUP' : 'LEAGUE',
    currentSeason: cur ? { label: String(cur.year), year: Number(cur.year), startDate: str(cur.start), endDate: str(cur.end) } : undefined,
    seasons: seasons.slice(-6).reverse().map((s) => ({ label: String(s.year), year: Number(s.year), startDate: str(s.start), endDate: str(s.end) })),
    features: {
      standings: cov.standings !== false,
      scorers: cov.top_scorers !== false,
      matches: true,
      teams: true,
    },
  };
}

async function seasonOf(id: string, season?: number) {
  if (season) return season;
  const c = await afLeague(id);
  if (!c.currentSeason) throw new UpstreamError('af', 404, 'Saison inconnue');
  return c.currentSeason.year;
}

export const apiFootball: SportsProvider = {
  id: 'af',
  delayed: false,
  enabled: () => key().length > 0,

  competition: afLeague,

  async standings(id, season) {
    const s = await seasonOf(id, season);
    const json = await get(`/standings?league=${id}&season=${s}`);
    const groups: any[][] = json.response?.[0]?.league?.standings ?? [];
    return groups.map(
      (rows): StandingTable => ({
        group: rows.length && rows[0].group && groups.length > 1 ? str(rows[0].group) : undefined,
        rows: rows.map((r: any) => ({
          position: num(r.rank) ?? 0,
          team: { id: P(r.team?.id), name: str(r.team?.name) ?? '—', crest: safeImg(r.team?.logo) },
          played: num(r.all?.played) ?? 0,
          won: num(r.all?.win) ?? 0,
          draw: num(r.all?.draw) ?? 0,
          lost: num(r.all?.lose) ?? 0,
          goalsFor: num(r.all?.goals?.for) ?? 0,
          goalsAgainst: num(r.all?.goals?.against) ?? 0,
          goalDiff: num(r.goalsDiff) ?? 0,
          points: num(r.points) ?? 0,
          form: str(r.form)?.split('').join(','),
        })),
      }),
    );
  },

  async competitionMatches(id, season) {
    const s = await seasonOf(id, season);
    const json = await get(`/fixtures?league=${id}&season=${s}`);
    return (json.response ?? []).map(mapFixture);
  },

  async scorers(id, season) {
    const s = await seasonOf(id, season);
    const json = await get(`/players/topscorers?league=${id}&season=${s}`);
    return (json.response ?? []).map((r: any): Scorer => {
      const st = r.statistics?.[0] ?? {};
      return {
        player: { id: P(r.player?.id), name: str(r.player?.name) ?? '—', nationality: str(r.player?.nationality) },
        team: { id: P(st.team?.id), name: str(st.team?.name) ?? '—', crest: safeImg(st.team?.logo) },
        goals: num(st.goals?.total) ?? 0,
        assists: num(st.goals?.assists),
        penalties: num(st.penalty?.scored),
        playedMatches: num(st.games?.appearences),
      };
    });
  },

  async competitionTeams(id, season) {
    const s = await seasonOf(id, season);
    const json = await get(`/teams?league=${id}&season=${s}`);
    return (json.response ?? []).map((r: any) => ({ id: P(r.team?.id), name: str(r.team?.name) ?? '—', crest: safeImg(r.team?.logo) }));
  },

  async match(id) {
    const json = await get(`/fixtures?id=${id}`);
    const f = (json.response ?? [])[0];
    if (!f) throw Object.assign(new Error('Match introuvable'), { status: 404 });
    return mapFixture(f);
  },

  async team(id) {
    const json = await get(`/teams?id=${id}`);
    const r = (json.response ?? [])[0];
    if (!r) throw Object.assign(new Error('Équipe introuvable'), { status: 404 });
    const t: Team = {
      id: P(r.team?.id),
      provider: 'af',
      name: str(r.team?.name) ?? '—',
      tla: str(r.team?.code),
      crest: safeImg(r.team?.logo),
      area: str(r.team?.country) ? { name: r.team.country } : undefined,
      founded: num(r.team?.founded) ?? undefined,
      venue: [str(r.venue?.name), str(r.venue?.city)].filter(Boolean).join(', ') || undefined,
    };
    return t;
  },
};

/** Tous les matchs d'une date (un seul appel), filtrés sur les ligues autorisées. */
export async function afFixturesOnDay(day: string, leagueIds: string[], tz = 'UTC'): Promise<Match[]> {
  const json = await get(`/fixtures?date=${day}&timezone=${encodeURIComponent(tz)}`);
  const set = new Set(leagueIds.map(String));
  return (json.response ?? []).filter((f: any) => set.has(String(f.league?.id))).map(mapFixture);
}
