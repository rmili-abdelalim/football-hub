import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChevron } from '../components/icons';
import { Crest, DataMeta, ErrorState, FavButton, Skeleton } from '../components/ui';
import { api, to } from '../lib/api';

/** Compétitions demandées : si aucune source gratuite ne les fournit, on le dit clairement. */
const WANTED = [
  { key: 'botola', test: /botola/i },
  { key: 'uel', test: /europa league/i },
  { key: 'cafcl', test: /caf champions league/i },
  { key: 'afcon', test: /africa cup of nations/i },
] as const;

export default function Competitions() {
  const { t } = useTranslation();
  const q = api.useCompetitions();
  const list = q.data?.data ?? [];
  const missing = WANTED.filter((w) => !list.some((c) => w.test.test(c.name)));

  return (
    <div className="space-y-6">
      <h1 className="font-score text-[28px] font-bold">{t('nav.competitions')}</h1>
      {q.isPending ? (
        <Skeleton rows={10} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <section aria-labelledby="covered">
          <h2 id="covered" className="mb-2 text-[15px] font-semibold text-muted">
            {t('competition.featured')}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2">
            {list.map((c) => (
              <li key={c.id} className="relative flex items-center gap-3 bg-surface px-3 py-2.5 hover:bg-sunken/60">
                <Crest src={c.emblem} size={28} />
                <Link to={to.competition(c.id)} className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {[c.area?.name, c.currentSeason?.label].filter(Boolean).join(' · ')}
                  </span>
                </Link>
                <FavButton kind="competition" id={c.id} name={c.name} image={c.emblem} className="relative z-10" />
                <IconChevron width={16} height={16} className="text-muted" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!q.isPending && missing.length > 0 && (
        <section aria-labelledby="missing" className="rounded-lg border border-dashed border-line p-4">
          <h2 id="missing" className="mb-1 font-semibold">
            {t('competition.notCovered')}
          </h2>
          <p className="mb-3 text-[14px] text-muted">{t('competition.notCoveredHint')}</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m.key} className="rounded-full border border-line px-3 py-1 text-[13px] text-muted">
                {t(`competition.groups.${m.key}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <DataMeta meta={q.data?.meta} showDelayed={false} />
    </div>
  );
}
