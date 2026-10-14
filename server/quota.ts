// Limiteur partagé par fournisseur : débit par minute et budget par jour (UTC).
// Les compteurs vivent dans le même stockage que le cache, donc communs à toutes les instances.
import { getKV } from './cache';
import type { ProviderId } from './model';

export interface QuotaRule {
  perMinute: number;
  perDay?: number;
}

export class QuotaError extends Error {
  constructor(public provider: ProviderId, public reason: 'minute' | 'day' | 'cooldown') {
    super(`Quota ${provider} atteint (${reason})`);
    this.name = 'QuotaError';
  }
}

export class UpstreamError extends Error {
  constructor(public provider: ProviderId, public status: number, message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}

function minuteKey(p: ProviderId, t: number) {
  return `quota:${p}:m:${Math.floor(t / 60000)}`;
}
function dayKey(p: ProviderId, t: number) {
  return `quota:${p}:d:${new Date(t).toISOString().slice(0, 10)}`;
}
function cooldownKey(p: ProviderId) {
  return `quota:${p}:cooldown`;
}

/** Réserve un appel ; lève QuotaError si la limite est atteinte. */
export async function reserve(provider: ProviderId, rule: QuotaRule, now = Date.now()): Promise<void> {
  const kv = await getKV();

  const cooldown = (await kv.get(cooldownKey(provider))) as number | null;
  if (cooldown && cooldown > now) throw new QuotaError(provider, 'cooldown');

  const mk = minuteKey(provider, now);
  const m = ((await kv.get(mk)) as number | null) ?? 0;
  if (m >= rule.perMinute) throw new QuotaError(provider, 'minute');

  if (rule.perDay) {
    const dk = dayKey(provider, now);
    const d = ((await kv.get(dk)) as number | null) ?? 0;
    if (d >= rule.perDay) throw new QuotaError(provider, 'day');
    await kv.set(dk, d + 1);
  }
  await kv.set(mk, m + 1);
}

/** Après un HTTP 429 : on suspend les appels vers ce fournisseur. */
export async function coolDown(provider: ProviderId, seconds: number, now = Date.now()) {
  const kv = await getKV();
  await kv.set(cooldownKey(provider), now + Math.max(5, Math.min(seconds, 3600)) * 1000);
}

export async function usage(provider: ProviderId, now = Date.now()) {
  const kv = await getKV();
  return {
    minute: ((await kv.get(minuteKey(provider, now))) as number | null) ?? 0,
    day: ((await kv.get(dayKey(provider, now))) as number | null) ?? 0,
  };
}

/** fetch JSON avec quota, délai maximal et gestion des 429. */
export async function quotaFetch(
  provider: ProviderId,
  rule: QuotaRule,
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 9000,
): Promise<{ json: any; headers: Headers }> {
  await reserve(provider, rule);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ctrl.signal });
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? res.headers.get('x-requestcounter-reset') ?? 60);
      await coolDown(provider, Number.isFinite(retry) ? retry : 60);
      throw new UpstreamError(provider, 429, `${provider} : trop de requêtes (429)`);
    }
    if (!res.ok) {
      throw new UpstreamError(provider, res.status, `${provider} : HTTP ${res.status}`);
    }
    const json = await res.json();
    return { json, headers: res.headers };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new UpstreamError(provider, 504, `${provider} : délai dépassé`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
