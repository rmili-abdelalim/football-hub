// Cache partagé entre tous les visiteurs.
// - En production (Netlify) : Netlify Blobs, persistant et commun à toutes les instances.
// - En local / tests : Map en mémoire.
// Chaque entrée garde sa date de stockage : une entrée expirée n'est pas supprimée,
// elle sert de copie de secours si le fournisseur échoue ou renvoie un 429.

export interface KV {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export class MemoryKV implements KV {
  private map = new Map<string, unknown>();
  async get(key: string) {
    return this.map.has(key) ? structuredClone(this.map.get(key)) : null;
  }
  async set(key: string, value: unknown) {
    this.map.set(key, structuredClone(value));
  }
}

class BlobsKV implements KV {
  constructor(private store: any) {}
  async get(key: string) {
    return (await this.store.get(safeKey(key), { type: 'json' })) ?? null;
  }
  async set(key: string, value: unknown) {
    await this.store.setJSON(safeKey(key), value);
  }
}

function safeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9:_\-./=]/g, '_');
}

let kvSingleton: KV | null = null;

export async function getKV(): Promise<KV> {
  if (kvSingleton) return kvSingleton;
  try {
    const { getStore } = await import('@netlify/blobs');
    // consistency 'strong' : les compteurs de quota sont lus à jour par toutes les instances
    const store = getStore({ name: 'football-hub-cache', consistency: 'strong' });
    kvSingleton = new BlobsKV(store);
  } catch {
    kvSingleton = new MemoryKV();
  }
  return kvSingleton;
}

export function setKV(kv: KV) {
  kvSingleton = kv;
}

interface Entry<T> {
  value: T;
  storedAt: number; // ms
  ttl: number; // secondes
}

export interface CachedResult<T> {
  value: T;
  fetchedAt: string;
  stale: boolean;
  fromCache: boolean;
  error?: string;
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Lit la clé en cache ; si elle est expirée, appelle `fetcher` une seule fois
 * (déduplication des appels simultanés), puis stocke le résultat.
 * En cas d'erreur, renvoie la dernière copie connue marquée `stale`.
 */
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  fetcher: () => Promise<T>,
  now: () => number = Date.now,
): Promise<CachedResult<T>> {
  const kv = await getKV();
  const entry = (await kv.get(key)) as Entry<T> | null;

  if (entry && now() - entry.storedAt < entry.ttl * 1000) {
    return { value: entry.value, fetchedAt: new Date(entry.storedAt).toISOString(), stale: false, fromCache: true };
  }

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetcher();
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }

  try {
    const value = await p;
    const storedAt = now();
    const seconds = typeof ttl === 'function' ? ttl(value) : ttl;
    await kv.set(key, { value, storedAt, ttl: seconds } satisfies Entry<T>);
    return { value, fetchedAt: new Date(storedAt).toISOString(), stale: false, fromCache: false };
  } catch (err) {
    if (entry) {
      return {
        value: entry.value,
        fetchedAt: new Date(entry.storedAt).toISOString(),
        stale: true,
        fromCache: true,
        error: (err as Error).message,
      };
    }
    throw err;
  }
}
