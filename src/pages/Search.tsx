import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '../components/icons';
import { Crest, Empty, ErrorState, FavButton, Skeleton } from '../components/ui';
import { api, to } from '../lib/api';

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [q, setQ] = useState(input);

  // Anti-rebond : une requête 350 ms après la dernière frappe
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input);
      setParams(input ? { q: input } : {}, { replace: true });
    }, 350);
    return () => clearTimeout(id);
  }, [input, setParams]);

  const r = api.useSearch(q);
  const data = r.data?.data;

  return (
    <div className="space-y-5">
      <h1 className="font-score text-[28px] font-bold">{t('nav.search')}</h1>
      <label className="relative block">
        <span className="sr-only">{t('search.label')}</span>
        <IconSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          value={input}
          maxLength={50}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full rounded-lg border border-line bg-surface py-3 pe-3 ps-10 text-[16px]"
        />
      </label>
      {q.trim().length < 2 ? (
        <p className="text-[14px] text-muted">{t('search.hint')}</p>
      ) : r.isPending ? (
        <Skeleton rows={5} />
      ) : r.isError ? (
        <ErrorState error={r.error} onRetry={() => r.refetch()} />
      ) : !data?.competitions.length && !data?.teams.length ? (
        <Empty>{t('search.none', { q })}</Empty>
      ) : (
        <div className="space-y-5" aria-live="polite">
          {data!.competitions.length > 0 && (
            <section>
              <h2 className="mb-2 font-score text-[20px] font-bold">{t('fav.competitions')}</h2>
              <ul className="overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
                {data!.competitions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
                    <Crest src={c.emblem} size={22} />
                    <Link to={to.competition(c.id)} className="min-w-0 flex-1 truncate py-1.5 hover:underline">
                      {c.name} <span className="text-muted">· {c.area?.name}</span>
                    </Link>
                    <FavButton kind="competition" id={c.id} name={c.name} image={c.emblem} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data!.teams.length > 0 && (
            <section>
              <h2 className="mb-2 font-score text-[20px] font-bold">{t('fav.teams')}</h2>
              <ul className="overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
                {data!.teams.map((tm) => (
                  <li key={tm.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
                    <Crest src={tm.crest} size={22} />
                    <Link to={to.team(tm.id)} className="min-w-0 flex-1 truncate py-1.5 hover:underline">
                      {tm.name} {tm.competition && <span className="text-muted">· {tm.competition}</span>}
                    </Link>
                    <FavButton kind="team" id={tm.id} name={tm.name} image={tm.crest} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-[13px] text-muted">{t('search.partial')}</p>
        </div>
      )}
    </div>
  );
}
