import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crest, Empty, FavButton } from '../components/ui';
import { to } from '../lib/api';
import { favorites, type FavKind } from '../lib/favorites';

const SECTIONS: { kind: FavKind; key: string; href: (id: string) => string }[] = [
  { kind: 'team', key: 'fav.teams', href: to.team },
  { kind: 'competition', key: 'fav.competitions', href: to.competition },
  { kind: 'match', key: 'fav.matches', href: to.match },
  { kind: 'player', key: 'fav.players', href: to.player },
];

export default function Favorites() {
  const { t } = useTranslation();
  const fav = favorites.use();
  const total = SECTIONS.reduce((n, s) => n + fav[s.kind].length, 0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-score text-[28px] font-bold">{t('fav.title')}</h1>
        <p className="text-[14px] text-muted">{t('fav.local')}</p>
      </div>
      {total === 0 ? (
        <Empty>{t('fav.empty')}</Empty>
      ) : (
        SECTIONS.filter((s) => fav[s.kind].length).map((s) => (
          <section key={s.kind} aria-labelledby={`fav-${s.kind}`}>
            <h2 id={`fav-${s.kind}`} className="mb-2 font-score text-[20px] font-bold">
              {t(s.key)}
            </h2>
            <ul className="overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
              {fav[s.kind].map((it) => (
                <li key={it.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
                  {s.kind !== 'match' && s.kind !== 'player' && <Crest src={it.image} size={22} />}
                  <Link to={s.href(it.id)} className="min-w-0 flex-1 truncate py-1.5 hover:underline">
                    {it.name}
                  </Link>
                  <FavButton kind={s.kind} id={it.id} name={it.name} image={it.image} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
