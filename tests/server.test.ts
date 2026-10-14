// ⚠️ DONNÉES FICTIVES DE TEST — ces objets imitent le format des API pour vérifier
// les adaptateurs. Ils ne sont jamais affichés dans l'application.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, MemoryKV, setKV } from '../server/cache';
import { mapFixture } from '../server/providers/apiFootball';
import { mapMatch, mapStatus as fdStatus } from '../server/providers/footballData';
import { mapEvent } from '../server/providers/theSportsDb';
import { reserve, QuotaError, quotaFetch, UpstreamError } from '../server/quota';
import { handle } from '../server/router';
import { parseId } from '../server/service';
import { isValidDay, localDay, tzOffsetMinutes, validTimeZone } from '../server/time';
import { ttlForMatches, TTL } from '../server/ttl';

beforeEach(() => setKV(new MemoryKV()));
afterEach(() => vi.restoreAllMocks());

describe('cache partagé', () => {
  it('sert la copie en cache tant qu’elle est valide', async () => {
    const f = vi.fn(async () => 1);
    await cached('k', 60, f);
    const r = await cached('k', 60, f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.fromCache).toBe(true);
  });

  it('déduplique les appels simultanés', async () => {
    const f = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(2), 10)));
    await Promise.all([cached('d', 60, f), cached('d', 60, f), cached('d', 60, f)]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('renvoie la copie périmée marquée stale si la source échoue', async () => {
    let t = 0;
    await cached('s', 1, async () => 'ancien', () => t);
    t = 5000;
    const r = await cached('s', 1, async () => { throw new Error('boom'); }, () => t);
    expect(r.value).toBe('ancien');
    expect(r.stale).toBe(true);
  });

  it('propage l’erreur s’il n’existe aucune copie', async () => {
    await expect(cached('x', 1, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});

describe('quotas', () => {
  it('bloque au-delà du débit par minute', async () => {
    for (let i = 0; i < 3; i++) await reserve('fd', { perMinute: 3 }, 1000);
    await expect(reserve('fd', { perMinute: 3 }, 1000)).rejects.toBeInstanceOf(QuotaError);
    await expect(reserve('fd', { perMinute: 3 }, 61000)).resolves.toBeUndefined();
  });

  it('bloque au-delà du budget journalier', async () => {
    await reserve('af', { perMinute: 10, perDay: 2 }, 0);
    await reserve('af', { perMinute: 10, perDay: 2 }, 120000);
    await expect(reserve('af', { perMinute: 10, perDay: 2 }, 240000)).rejects.toMatchObject({ reason: 'day' });
  });

  it('suspend les appels après un 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })));
    await expect(quotaFetch('tsdb', { perMinute: 50 }, 'https://example.test')).rejects.toBeInstanceOf(UpstreamError);
    await expect(quotaFetch('tsdb', { perMinute: 50 }, 'https://example.test')).rejects.toMatchObject({ reason: 'cooldown' });
    vi.unstubAllGlobals();
  });
});

describe('adaptateur football-data.org', () => {
  const raw = {
    id: 999001,
    utcDate: '2026-10-14T19:00:00Z',
    status: 'PAUSED',
    matchday: 8,
    competition: { id: 2015, name: 'Ligue 1', code: 'FL1', emblem: 'https://crests.football-data.org/FL1.png' },
    area: { name: 'France', code: 'FRA' },
    homeTeam: { id: 1, name: 'Équipe Test A', tla: 'TSA', crest: 'javascript:alert(1)' },
    awayTeam: { id: 2, name: 'Équipe Test B' },
    score: { fullTime: { home: 1, away: 0 }, halfTime: { home: 1, away: 0 } },
  };

  it('normalise un match et préfixe les identifiants', () => {
    const m = mapMatch(raw);
    expect(m.id).toBe('fd:999001');
    expect(m.competition.id).toBe('fd:FL1');
    expect(m.status).toBe('HALFTIME');
    expect(m.score.halfTime).toEqual({ home: 1, away: 0 });
    expect(m.home.crest).toBeUndefined(); // URL non https rejetée
    expect(m.events).toBeUndefined(); // pas de données inventées
  });

  it('associe les statuts', () => {
    expect(fdStatus('TIMED')).toBe('SCHEDULED');
    expect(fdStatus('IN_PLAY')).toBe('LIVE');
    expect(fdStatus('AWARDED')).toBe('FINISHED');
    expect(fdStatus('???')).toBe('UNKNOWN');
  });
});

describe('adaptateur TheSportsDB', () => {
  it('convertit l’horodatage et les scores absents', () => {
    const m = mapEvent({
      idEvent: '77', idLeague: '4999', strLeague: 'Ligue Test', strTimestamp: '2099-01-01T18:00:00',
      idHomeTeam: '1', strHomeTeam: 'A', idAwayTeam: '2', strAwayTeam: 'B', intHomeScore: null, intAwayScore: null, strStatus: 'NS',
    });
    expect(m.utcDate).toBe('2099-01-01T18:00:00.000Z');
    expect(m.score).toEqual({ home: null, away: null });
    expect(m.status).toBe('SCHEDULED');
  });
});

describe('adaptateur API-Football', () => {
  it('normalise événements, compositions et statistiques', () => {
    const f = {
      fixture: { id: 5, date: '2026-10-14T18:00:00+00:00', status: { short: '2H', elapsed: 67 }, venue: { name: 'Stade Test', city: 'Ville' } },
      league: { id: 200, name: 'Ligue Test', season: 2026 },
      teams: { home: { id: 10, name: 'H' }, away: { id: 20, name: 'A' } },
      goals: { home: 2, away: 1 },
      score: { halftime: { home: 1, away: 1 } },
      events: [
        { time: { elapsed: 12 }, team: { id: 10 }, player: { name: 'P1' }, assist: { name: 'P2' }, type: 'Goal', detail: 'Normal Goal' },
        { time: { elapsed: 40 }, team: { id: 20 }, player: { name: 'P3' }, type: 'Card', detail: 'Red Card' },
      ],
      statistics: [
        { team: { id: 10 }, statistics: [{ type: 'Ball Possession', value: '58%' }, { type: 'Corner Kicks', value: null }] },
        { team: { id: 20 }, statistics: [{ type: 'Ball Possession', value: '42%' }, { type: 'Corner Kicks', value: null }] },
      ],
    };
    const m = mapFixture(f);
    expect(m.id).toBe('af:5');
    expect(m.status).toBe('LIVE');
    expect(m.minute).toBe(67);
    expect(m.events?.map((e) => [e.type, e.team])).toEqual([['GOAL', 'home'], ['RED', 'away']]);
    expect(m.stats).toEqual([{ key: 'possession', home: 58, away: 42, unit: '%' }]); // corners nuls ignorés
    expect(m.lineups).toBeUndefined();
  });
});

describe('dates et fuseaux', () => {
  it('valide les dates et fuseaux', () => {
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-10-14')).toBe(true);
    expect(validTimeZone('Africa/Casablanca')).toBe('Africa/Casablanca');
    expect(validTimeZone('../../etc')).toBe('UTC');
  });
  it('calcule le jour local', () => {
    expect(localDay('2026-10-14T23:30:00Z', 'Europe/Paris')).toBe('2026-10-15');
    expect(tzOffsetMinutes('2026-10-14', 'Europe/Paris')).toBe(120);
  });
});

describe('TTL adaptatif', () => {
  const base = { provider: 'fd', competition: { id: 'fd:PL', name: 'x' }, home: { id: 'a', name: 'a' }, away: { id: 'b', name: 'b' }, score: { home: null, away: null } } as any;
  it('rafraîchit vite les matchs en cours', () => {
    expect(ttlForMatches([{ ...base, status: 'LIVE', utcDate: new Date().toISOString() }])).toBe(TTL.live);
  });
  it('conserve longtemps les matchs terminés anciens', () => {
    expect(ttlForMatches([{ ...base, status: 'FINISHED', utcDate: '2020-01-01T00:00:00Z' }])).toBe(TTL.past);
  });
});

describe('routeur', () => {
  it('refuse les identifiants malformés', () => {
    expect(() => parseId('fd:../../x')).toThrow();
    expect(() => parseId('xx:1')).toThrow();
  });
  it('valide les paramètres', async () => {
    const r = await handle(new Request('https://x.test/api/matches?date=2026-13-01'));
    expect(r.status).toBe(400);
    const r2 = await handle(new Request('https://x.test/api/teams/fd:1%27%20OR%201=1'));
    expect(r2.status).toBe(404);
    const r3 = await handle(new Request('https://x.test/api/health', { method: 'POST' }));
    expect(r3.status).toBe(405);
  });
  it('indique les sources non configurées sans inventer de données', async () => {
    delete process.env.FOOTBALL_DATA_TOKEN;
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const r = await handle(new Request('https://x.test/api/matches?date=2026-10-14&tz=Europe/Paris'));
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta.warnings).toContain('fd:not-configured');
    vi.unstubAllGlobals();
  });
});

describe('registre Botola (TheSportsDB)', () => {
  it('affiche le nom officiel Botola Pro et garde le nom brut de la source', async () => {
    const { theSportsDb } = await import('../server/providers/theSportsDb');
    // Données fictives au format de lookupleague.php (structure vérifiée le 14/10/2026)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      leagues: [{ idLeague: '4520', strLeague: 'Moroccan Championship', strCountry: 'Morocco', strCurrentSeason: '2026-2027' }],
    }), { status: 200 })));
    const c = await theSportsDb.competition!('4520');
    expect(c.name).toBe('Botola Pro');
    expect(c.officialName).toBe('Moroccan Championship');
    expect(c.currentSeason?.year).toBe(2026);
    vi.unstubAllGlobals();
  });

  it('signale les listes tronquées de la clé publique', async () => {
    const { getStandings } = await import('../server/service');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      String(url).includes('lookupleague')
        ? { leagues: [{ idLeague: '4520', strLeague: 'Moroccan Championship', strCurrentSeason: '2026-2027' }] }
        : { table: [{ intRank: '1', idTeam: '1', strTeam: 'Équipe test', intPlayed: '1', intPoints: '3' }] },
    ), { status: 200 })));
    const r = await getStandings('tsdb:4520');
    expect(r.data[0].rows).toHaveLength(1);
    expect(r.meta.warnings).toContain('tsdb:partial');
    vi.unstubAllGlobals();
  });
});
