// Client de l'API interne /api (jamais d'appel direct aux fournisseurs depuis le navigateur).
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type {
  ApiResponse,
  Competition,
  Match,
  Player,
  Scorer,
  StandingTable,
  Team,
  TeamRef,
} from '../../server/model';
import { isLiveStatus } from '../../server/model';

export type * from '../../server/model';
export { isLiveStatus };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getJson<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`/api/${path}`, { headers: { Accept: 'application/json' } });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* réponse non JSON */
  }
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  return body as ApiResponse<T>;
}

type Opts<T> = Omit<UseQueryOptions<ApiResponse<T>, ApiError>, 'queryKey' | 'queryFn'>;

function useApi<T>(path: string | null, opts: Opts<T> = {}) {
  return useQuery<ApiResponse<T>, ApiError>({
    queryKey: ['api', path],
    queryFn: () => getJson<T>(path!),
    enabled: path !== null,
    retry: (n, e) => e.status >= 500 && e.status !== 503 && n < 2,
    ...opts,
  });
}

/** Rafraîchissement intelligent : 60 s si un match est en cours, 5 min sinon, jamais en arrière-plan. */
function liveInterval(matches?: Match[]) {
  if (!matches) return false as const;
  return matches.some((m) => isLiveStatus(m.status)) ? 60_000 : 5 * 60_000;
}

export const api = {
  useCompetitions: () => useApi<Competition[]>('competitions', { staleTime: 10 * 60_000 }),
  useCompetition: (id: string) => useApi<Competition>(`competitions/${id}`, { staleTime: 60 * 60_000 }),
  useStandings: (id: string | null, season?: number) =>
    useApi<StandingTable[]>(id ? `competitions/${id}/standings${season ? `?season=${season}` : ''}` : null, { staleTime: 5 * 60_000 }),
  useCompetitionMatches: (id: string, season?: number) =>
    useApi<Match[]>(`competitions/${id}/matches${season ? `?season=${season}` : ''}`, {
      staleTime: 2 * 60_000,
      refetchInterval: (q) => liveInterval(q.state.data?.data),
    }),
  useScorers: (id: string, season?: number, enabled = true) =>
    useApi<Scorer[]>(enabled ? `competitions/${id}/scorers${season ? `?season=${season}` : ''}` : null, { staleTime: 15 * 60_000 }),
  useCompetitionTeams: (id: string, season?: number, enabled = true) =>
    useApi<TeamRef[]>(enabled ? `competitions/${id}/teams${season ? `?season=${season}` : ''}` : null, { staleTime: 60 * 60_000 }),
  useMatchesForDay: (day: string, tz: string) =>
    useApi<Match[]>(`matches?date=${day}&tz=${encodeURIComponent(tz)}`, {
      staleTime: 60_000,
      refetchInterval: (q) => liveInterval(q.state.data?.data),
    }),
  useMatch: (id: string) =>
    useApi<Match>(`matches/${id}`, {
      staleTime: 30_000,
      refetchInterval: (q) => {
        const m = q.state.data?.data;
        return m && isLiveStatus(m.status) ? 60_000 : false;
      },
    }),
  useHeadToHead: (id: string, enabled: boolean) => useApi<Match[]>(enabled ? `matches/${id}/h2h` : null, { staleTime: 60 * 60_000 }),
  useTeam: (id: string) => useApi<Team>(`teams/${id}`, { staleTime: 60 * 60_000 }),
  useTeamMatches: (id: string) =>
    useApi<Match[]>(`teams/${id}/matches`, { staleTime: 2 * 60_000, refetchInterval: (q) => liveInterval(q.state.data?.data) }),
  usePerson: (id: string) => useApi<Player>(`persons/${id}`, { staleTime: 60 * 60_000 }),
  useSearch: (q: string) =>
    useApi<{ competitions: Competition[]; teams: (TeamRef & { competition?: string })[] }>(
      q.trim().length >= 2 ? `search?q=${encodeURIComponent(q.trim())}` : null,
      { staleTime: 5 * 60_000 },
    ),
};

/** Route d'une entité à partir de son identifiant préfixé */
export const to = {
  competition: (id: string) => `/competition/${encodeURIComponent(id)}`,
  match: (id: string) => `/match/${encodeURIComponent(id)}`,
  team: (id: string) => `/team/${encodeURIComponent(id)}`,
  player: (id: string) => `/player/${encodeURIComponent(id)}`,
};
