import type {
  Competition,
  Match,
  Player,
  ProviderId,
  Scorer,
  StandingTable,
  Team,
  TeamRef,
} from '../model';

/**
 * Contrat commun à tous les adaptateurs. Les identifiants reçus sont « bruts »
 * (sans préfixe) ; les identifiants renvoyés sont préfixés par l'adaptateur.
 * Une méthode absente = donnée non fournie par la source.
 */
export interface SportsProvider {
  id: ProviderId;
  /** Scores différés sur l'offre utilisée */
  delayed: boolean;
  enabled(): boolean;

  competitions?(): Promise<Competition[]>;
  competition?(id: string): Promise<Competition>;
  standings?(competitionId: string, season?: number): Promise<StandingTable[]>;
  competitionMatches?(competitionId: string, season?: number): Promise<Match[]>;
  scorers?(competitionId: string, season?: number): Promise<Scorer[]>;
  competitionTeams?(competitionId: string, season?: number): Promise<TeamRef[]>;

  /** Matchs entre deux dates UTC incluses (AAAA-MM-JJ) */
  matchesBetween?(fromUtc: string, toUtc: string): Promise<Match[]>;
  match?(id: string): Promise<Match>;
  headToHead?(id: string): Promise<Match[]>;

  team?(id: string): Promise<Team>;
  teamMatches?(id: string): Promise<Match[]>;
  person?(id: string): Promise<Player>;
}

export class NotSupportedError extends Error {
  constructor(what: string) {
    super(`Donnée non fournie par la source : ${what}`);
    this.name = 'NotSupportedError';
  }
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

/** N'accepte que des URL https d'images (pas de javascript:, data:, etc.) */
export function safeImg(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
