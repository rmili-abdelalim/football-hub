// Favoris locaux, sans compte. Le format est versionné pour permettre
// plus tard une importation vers un compte synchronisé.
import { createStore } from './store';

export type FavKind = 'team' | 'competition' | 'match' | 'player';

export interface FavItem {
  id: string; // identifiant préfixé par la source : "fd:524"
  name: string;
  image?: string;
  addedAt: number;
}

export interface Favorites {
  v: 1;
  team: FavItem[];
  competition: FavItem[];
  match: FavItem[];
  player: FavItem[];
}

const EMPTY: Favorites = { v: 1, team: [], competition: [], match: [], player: [] };
const ID_RE = /^(fd|tsdb|af):[A-Za-z0-9]{1,12}$/;

function cleanList(v: unknown): FavItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x.id === 'string' && ID_RE.test(x.id) && typeof x.name === 'string')
    .slice(0, 500)
    .map((x) => ({
      id: x.id,
      name: String(x.name).slice(0, 120),
      image: typeof x.image === 'string' && x.image.startsWith('https://') ? x.image : undefined,
      addedAt: Number(x.addedAt) || Date.now(),
    }));
}

function validate(v: unknown): Favorites {
  const o = (v ?? {}) as Record<string, unknown>;
  return { v: 1, team: cleanList(o.team), competition: cleanList(o.competition), match: cleanList(o.match), player: cleanList(o.player) };
}

export const favorites = createStore<Favorites>('fh:favorites', EMPTY, validate);

export function toggleFavorite(kind: FavKind, item: Omit<FavItem, 'addedAt'>) {
  favorites.set((f) => {
    const list = f[kind];
    const exists = list.some((x) => x.id === item.id);
    return { ...f, [kind]: exists ? list.filter((x) => x.id !== item.id) : [...list, { ...item, addedAt: Date.now() }] };
  });
}

export function useIsFavorite(kind: FavKind, id: string) {
  return favorites.use()[kind].some((x) => x.id === id);
}
