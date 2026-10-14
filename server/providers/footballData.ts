// Adaptateur football-data.org (API v4) — offre gratuite.
import type { Competition, Match, MatchStatus, Player, Scorer, StandingTable, Team, TeamRef } from '../model';
import { quotaFetch } from '../quota';
import { num, safeImg, str, type SportsProvider } from './types';

const BASE = 'https://api.football-data.org/v4';
// 10 appels/min autorisés : on garde une marge
const RULE = { perMinute: 9 };

/** Les 12 compétitions de l'offre gratuite (codes officiels football-data.org) */
export const FD_FREE_CODES = ['PL', 'ELC', 'FL1', 'PD', 'SA', 'BL1', 'DED', 'PPL', 'BSA', 'CL', 'WC', 'EC'] as const;

const P = (id: unknown) => `fd:${id}`;

function token() {
  return process.env.FOOTBALL_DATA_TOKEN?.trim() || '';
}

async function get(path: string) {
  const { json } = await quotaFetch('fd', RULE, `${BASE}${path}`, { 'X-Auth-Token': token() });
  return json;
}

export function mapStatus(s: unknown): MatchStatus {
  switch (s) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'SCHEDULED';
    case 'IN_PLAY':
    case 'LIVE':
      return 'LIVE';
    case 'PAUSED':
      return 'HALFTIME';
    case 'FINISHED':
    case 'AWARDED':
      return 'FINISHED';
    case 'POSTPONED':
      return 'POSTPONED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    default:
      return 'UNKNOWN';
  }
}

export function mapTeamRef(t: any): TeamRef {
  return {
    id: P(t?.id),
    name: str(t?.name) ?? str(t?.shortName) ?? '—',
    shortName: str(t?.shortName),
    tla: str(t?.tla),
    crest: safeImg(t?.crest),
  };
}

export function mapMatch(m: any, competitionFallback?: any): Match {
  const comp = m.competition ?? competitionFallback ?? {};
  const area = m.area ?? comp.area;
  const ft = m.score?.fullTime ?? {};
  const ht = m.score?.halfTime;
  const pen = m.score?.penalties;
  const referee = Array.isArray(m.referees) ? m.referees.find((r: any) => r?.type === 'REFEREE') : undefined;
  const match: Match = {
    id: P(m.id),
    provider: 'fd',
    competition: {
      id: P(comp.code ?? comp.id),
      name: str(comp.name) ?? '—',
      code: str(comp.code),
      emblem: safeImg(comp.emblem),
      area: area ? { name: str(area.name) ?? '', code: str(area.code), flag: safeImg(area.flag) } : undefined,
    },
    season: m.season?.startDate ? String(m.season.startDate).slice(0, 4) : undefined,
    matchday: num(m.matchday) ?? undefined,
    stage: str(m.stage),
    utcDate: String(m.utcDate),
    status: mapStatus(m.status),
    minute: num(m.minute) ?? undefined,
    venue: str(m.venue),
    referee: str(referee?.name),
    home: mapTeamRef(m.homeTeam),
    away: mapTeamRef(m.awayTeam),
    score: { home: num(ft.home), away: num(ft.away) },
  };
  if (ht && (ht.home !== null || ht.away !== null)) match.score.halfTime = { home: num(ht.home), away: num(ht.away) };
  if (pen && (pen.home !== null || pen.away !== null)) match.score.penalties = { home: num(pen.home), away: num(pen.away) };

  // Sur l'offre gratuite ces tableaux sont normalement absents ; on les mappe s'ils existent.
  if (Array.isArray(m.goals) && m.goals.length) {
    const homeId = m.homeTeam?.id;
    match.events = m.goals.map((g: any) => ({
      minute: num(g.minute) ?? undefined,
      extraMinute: num(g.injuryTime) ?? undefined,
      type: g.type === 'OWN' ? 'OWN_GOAL' : g.type === 'PENALTY' ? 'PENALTY_GOAL' : 'GOAL',
      team: g.team?.id === homeId ? 'home' : 'away',
      player: str(g.scorer?.name),
      assist: str(g.assist?.name),
    }));
  }
  return match;
}

function mapCompetition(c: any): Competition {
  const cs = c.currentSeason;
  return {
    id: P(c.code ?? c.id),
    provider: 'fd',
    name: str(c.name) ?? '—',
    code: str(c.code),
    emblem: safeImg(c.emblem),
    area: c.area ? { name: str(c.area.name) ?? '', code: str(c.area.code), flag: safeImg(c.area.flag) } : undefined,
    type: c.type === 'LEAGUE' ? 'LEAGUE' : c.type === 'CUP' ? 'CUP' : 'OTHER',
    currentSeason: cs
      ? {
          id: String(cs.id),
          label: seasonLabel(cs.startDate, cs.endDate),
          year: Number(String(cs.startDate).slice(0, 4)),
          startDate: str(cs.startDate),
          endDate: str(cs.endDate),
          currentMatchday: num(cs.currentMatchday) ?? undefined,
        }
      : undefined,
    seasons: Array.isArray(c.seasons)
      ? c.seasons.slice(0, 6).map((s: any) => ({
          id: String(s.id),
          label: seasonLabel(s.startDate, s.endDate),
          year: Number(String(s.startDate).slice(0, 4)),
          startDate: str(s.startDate),
          endDate: str(s.endDate),
        }))
      : undefined,
    features: { standings: true, scorers: true, matches: true, teams: true },
  };
}

function seasonLabel(start?: string, end?: string) {
  const a = String(start ?? '').slice(0, 4);
  const b = String(end ?? '').slice(0, 4);
  return a && b && a !== b ? `${a}-${b}` : a;
}

function assertFreeCode(code: string) {
  if (!(FD_FREE_CODES as readonly string[]).includes(code)) {
    throw Object.assign(new Error(`Compétition ${code} non incluse dans l'offre gratuite`), { status: 404 });
  }
}
const seasonQ = (season?: number) => (season ? `?season=${season}` : '');

export const footballData: SportsProvider = {
  id: 'fd',
  delayed: true,
  enabled: () => token().length > 0,

  async competitions() {
    const json = await get('/competitions');
    return (json.competitions ?? [])
      .filter((c: any) => (FD_FREE_CODES as readonly string[]).includes(c.code))
      .map(mapCompetition);
  },

  async competition(code) {
    assertFreeCode(code);
    return mapCompetition(await get(`/competitions/${code}`));
  },

  async standings(code, season) {
    assertFreeCode(code);
    const json = await get(`/competitions/${code}/standings${seasonQ(season)}`);
    return (json.standings ?? []).map(
      (s: any): StandingTable => ({
        group: str(s.group)?.replace(/_/g, ' '),
        type: str(s.type),
        rows: (s.table ?? []).map((r: any) => ({
          position: num(r.position) ?? 0,
          team: mapTeamRef(r.team),
          played: num(r.playedGames) ?? 0,
          won: num(r.won) ?? 0,
          draw: num(r.draw) ?? 0,
          lost: num(r.lost) ?? 0,
          goalsFor: num(r.goalsFor) ?? 0,
          goalsAgainst: num(r.goalsAgainst) ?? 0,
          goalDiff: num(r.goalDifference) ?? 0,
          points: num(r.points) ?? 0,
          form: str(r.form),
        })),
      }),
    );
  },

  async competitionMatches(code, season) {
    assertFreeCode(code);
    const json = await get(`/competitions/${code}/matches${seasonQ(season)}`);
    return (json.matches ?? []).map((m: any) => mapMatch(m, json.competition));
  },

  async scorers(code, season) {
    assertFreeCode(code);
    const q = season ? `?season=${season}&limit=30` : '?limit=30';
    const json = await get(`/competitions/${code}/scorers${q}`);
    return (json.scorers ?? []).map(
      (s: any): Scorer => ({
        player: {
          id: P(s.player?.id),
          name: str(s.player?.name) ?? '—',
          nationality: str(s.player?.nationality),
          position: str(s.player?.position ?? s.player?.section),
        },
        team: mapTeamRef(s.team),
        goals: num(s.goals) ?? 0,
        assists: num(s.assists),
        penalties: num(s.penalties),
        playedMatches: num(s.playedMatches),
      }),
    );
  },

  async competitionTeams(code, season) {
    assertFreeCode(code);
    const json = await get(`/competitions/${code}/teams${seasonQ(season)}`);
    return (json.teams ?? []).map(mapTeamRef);
  },

  async matchesBetween(from, to) {
    const json = await get(`/matches?dateFrom=${from}&dateTo=${to}&competitions=${FD_FREE_CODES.join(',')}`);
    return (json.matches ?? []).map((m: any) => mapMatch(m));
  },

  async match(id) {
    return mapMatch(await get(`/matches/${id}`));
  },

  async headToHead(id) {
    const json = await get(`/matches/${id}/head2head?limit=10`);
    return (json.matches ?? []).map((m: any) => mapMatch(m));
  },

  async team(id) {
    const t = await get(`/teams/${id}`);
    const team: Team = {
      ...mapTeamRef(t),
      provider: 'fd',
      area: t.area ? { name: str(t.area.name) ?? '', code: str(t.area.code), flag: safeImg(t.area.flag) } : undefined,
      founded: num(t.founded) ?? undefined,
      venue: str(t.venue),
      website: str(t.website)?.startsWith('http') ? str(t.website) : undefined,
      colors: str(t.clubColors),
      coach: str(t.coach?.name) ? { name: t.coach.name, nationality: str(t.coach.nationality) } : undefined,
      squad: Array.isArray(t.squad)
        ? t.squad.map((p: any) => ({
            id: P(p.id),
            name: str(p.name) ?? '—',
            position: str(p.position),
            dateOfBirth: str(p.dateOfBirth),
            nationality: str(p.nationality),
            shirtNumber: num(p.shirtNumber) ?? undefined,
          }))
        : undefined,
      runningCompetitions: Array.isArray(t.runningCompetitions)
        ? t.runningCompetitions.map((c: any) => ({
            id: P(c.code ?? c.id),
            name: str(c.name) ?? '—',
            code: str(c.code),
            emblem: safeImg(c.emblem),
          }))
        : undefined,
    };
    return team;
  },

  async teamMatches(id) {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 864e5).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 60 * 864e5).toISOString().slice(0, 10);
    const json = await get(`/teams/${id}/matches?dateFrom=${from}&dateTo=${to}`);
    return (json.matches ?? []).map((m: any) => mapMatch(m));
  },

  async person(id) {
    const p = await get(`/persons/${id}`);
    const player: Player = {
      id: P(p.id),
      provider: 'fd',
      name: str(p.name) ?? '—',
      firstName: str(p.firstName),
      lastName: str(p.lastName),
      dateOfBirth: str(p.dateOfBirth),
      nationality: str(p.nationality),
      position: str(p.position ?? p.section),
      shirtNumber: num(p.shirtNumber) ?? undefined,
      currentTeam: p.currentTeam ? mapTeamRef(p.currentTeam) : undefined,
    };
    return player;
  },
};
