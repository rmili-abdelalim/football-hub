// Modèle de données normalisé, partagé entre le serveur et le client.
// Règle : un champ inconnu reste absent (undefined). Aucune valeur n'est inventée.

export type ProviderId = 'fd' | 'tsdb' | 'af';

export type MatchStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'HALFTIME'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'UNKNOWN';

export interface TeamRef {
  id: string; // préfixé : "fd:524"
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

export interface Area {
  name: string;
  code?: string;
  flag?: string;
}

export interface CompetitionRef {
  id: string;
  name: string;
  code?: string;
  emblem?: string;
  area?: Area;
}

export interface Competition extends CompetitionRef {
  provider: ProviderId;
  /** Nom brut renvoyé par la source, quand le nom affiché est un nom officiel alternatif */
  officialName?: string;
  type?: 'LEAGUE' | 'CUP' | 'OTHER';
  currentSeason?: Season;
  seasons?: Season[];
  /** Fonctionnalités réellement fournies par la source pour cette compétition */
  features: {
    standings: boolean;
    scorers: boolean;
    matches: boolean;
    teams: boolean;
  };
}

export interface Season {
  id?: string;
  label: string; // "2026-2027" ou "2026"
  year: number; // année de début
  startDate?: string;
  endDate?: string;
  currentMatchday?: number;
}

export interface MatchEvent {
  minute?: number;
  extraMinute?: number;
  type: 'GOAL' | 'OWN_GOAL' | 'PENALTY_GOAL' | 'YELLOW' | 'RED' | 'SECOND_YELLOW' | 'SUB' | 'VAR' | 'OTHER';
  team: 'home' | 'away';
  player?: string;
  assist?: string; // passeur (but) ou joueur entrant (remplacement)
  detail?: string;
}

export interface LineupPlayer {
  id?: string;
  name: string;
  number?: number;
  position?: string;
}

export interface Lineup {
  formation?: string;
  coach?: string;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface StatPair {
  key: string; // clé normalisée : possession, shots, shotsOnTarget, corners, fouls, offsides, yellow, red, ...
  home: number | null;
  away: number | null;
  unit?: '%';
}

export interface Match {
  id: string;
  provider: ProviderId;
  competition: CompetitionRef;
  season?: string;
  matchday?: number;
  stage?: string;
  utcDate: string; // ISO 8601
  status: MatchStatus;
  minute?: number;
  venue?: string;
  referee?: string;
  home: TeamRef;
  away: TeamRef;
  score: {
    home: number | null;
    away: number | null;
    halfTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
  events?: MatchEvent[];
  lineups?: { home: Lineup; away: Lineup };
  stats?: StatPair[];
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form?: string; // "W,D,L,W,W"
}

export interface StandingTable {
  group?: string; // "Group A" pour les phases de groupes
  type?: string; // TOTAL / HOME / AWAY
  rows: StandingRow[];
}

export interface Scorer {
  player: { id: string; name: string; nationality?: string; position?: string };
  team: TeamRef;
  goals: number;
  assists?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
}

export interface SquadMember {
  id: string;
  name: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
  shirtNumber?: number;
}

export interface Team extends TeamRef {
  provider: ProviderId;
  area?: Area;
  founded?: number;
  venue?: string;
  website?: string;
  colors?: string;
  coach?: { name: string; nationality?: string };
  squad?: SquadMember[];
  runningCompetitions?: CompetitionRef[];
  description?: string;
}

export interface Player {
  id: string;
  provider: ProviderId;
  name: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  position?: string;
  shirtNumber?: number;
  currentTeam?: TeamRef;
}

/** Enveloppe de toutes les réponses de /api */
export interface ApiMeta {
  provider: ProviderId | ProviderId[];
  fetchedAt: string; // date de récupération auprès du fournisseur
  delayed: boolean; // la source fournit des scores différés
  stale: boolean; // copie de secours servie après une erreur ou un 429
  attribution: string[];
  warnings?: string[]; // "fd:quota", "tsdb:partial", ...
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export const ATTRIBUTION: Record<ProviderId, string> = {
  fd: 'Données football fournies par football-data.org',
  tsdb: 'Données : TheSportsDB.com',
  af: 'Données : API-Football (api-sports.io)',
};

export function isLiveStatus(s: MatchStatus): boolean {
  return s === 'LIVE' || s === 'HALFTIME';
}
