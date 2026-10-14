// Routeur HTTP indépendant de l'hébergeur (Request/Response standard).
import {
  getCompetition,
  getCompetitionMatches,
  getCompetitionTeams,
  getHeadToHead,
  getMatch,
  getMatchesForDay,
  getPerson,
  getScorers,
  getStandings,
  getTeam,
  getTeamMatches,
  HttpError,
  listCompetitions,
  search,
  status,
} from './service';
import { isValidDay, validTimeZone } from './time';
import { TTL } from './ttl';

const ID = '((?:fd|tsdb|af):[A-Za-z0-9]{1,12})';

type Handler = (m: RegExpExecArray, q: URLSearchParams) => Promise<{ body: unknown; ttl: number }>;

function season(q: URLSearchParams): number | undefined {
  const s = q.get('season');
  if (!s) return undefined;
  if (!/^\d{4}$/.test(s)) throw new HttpError(400, 'Saison invalide');
  const n = Number(s);
  if (n < 1990 || n > new Date().getUTCFullYear() + 1) throw new HttpError(400, 'Saison invalide');
  return n;
}

const wrap =
  (ttl: number, f: (m: RegExpExecArray, q: URLSearchParams) => Promise<unknown>): Handler =>
  async (m, q) => ({ body: await f(m, q), ttl });

const routes: [RegExp, Handler][] = [
  [/^health$/, wrap(0, async () => status())],
  [/^competitions$/, wrap(300, () => listCompetitions())],
  [new RegExp(`^competitions/${ID}$`), wrap(3600, (m) => getCompetition(m[1]))],
  [new RegExp(`^competitions/${ID}/standings$`), wrap(120, (m, q) => getStandings(m[1], season(q)))],
  [new RegExp(`^competitions/${ID}/matches$`), wrap(120, (m, q) => getCompetitionMatches(m[1], season(q)))],
  [new RegExp(`^competitions/${ID}/scorers$`), wrap(600, (m, q) => getScorers(m[1], season(q)))],
  [new RegExp(`^competitions/${ID}/teams$`), wrap(3600, (m, q) => getCompetitionTeams(m[1], season(q)))],
  [
    /^matches$/,
    wrap(60, async (_m, q) => {
      const day = q.get('date');
      if (!isValidDay(day)) throw new HttpError(400, 'Date invalide (AAAA-MM-JJ)');
      return getMatchesForDay(day, validTimeZone(q.get('tz')));
    }),
  ],
  [new RegExp(`^matches/${ID}$`), wrap(60, (m) => getMatch(m[1]))],
  [new RegExp(`^matches/${ID}/h2h$`), wrap(3600, (m) => getHeadToHead(m[1]))],
  [new RegExp(`^teams/${ID}$`), wrap(3600, (m) => getTeam(m[1]))],
  [new RegExp(`^teams/${ID}/matches$`), wrap(120, (m) => getTeamMatches(m[1]))],
  [new RegExp(`^persons/${ID}$`), wrap(3600, (m) => getPerson(m[1]))],
  [
    /^search$/,
    wrap(300, async (_m, q) => {
      const s = (q.get('q') ?? '').trim();
      if (s.length < 2 || s.length > 50) throw new HttpError(400, 'Recherche : 2 à 50 caractères');
      return search(s);
    }),
  ],
];

function json(body: unknown, status: number, ttl = 0) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    // Le navigateur revalide toujours ; le CDN mutualise la réponse entre visiteurs
    'Cache-Control': 'public, max-age=0, must-revalidate',
  };
  if (status === 200 && ttl > 0) {
    headers['Netlify-CDN-Cache-Control'] = `public, s-maxage=${Math.min(ttl, TTL.standings)}, stale-while-revalidate=${ttl}`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(?:\.netlify\/functions\/)?api\/?/, '').replace(/\/+$/, '');
  for (const [re, h] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    try {
      const { body, ttl } = await h(m, url.searchParams);
      return json(body, 200, ttl);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, status: e.status }, e.status);
      console.error('[api]', path, e);
      return json({ error: 'Erreur interne' }, 500);
    }
  }
  return json({ error: 'Route inconnue' }, 404);
}
