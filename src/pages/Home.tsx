import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MatchGroups } from '../components/matches';
import { IconBack, IconCalendar, IconChevron } from '../components/icons';
import { DataMeta, Empty, ErrorState, liveCount, Skeleton } from '../components/ui';
import { api, isLiveStatus, type Match } from '../lib/api';
import { favorites } from '../lib/favorites';
import { addDays, todayIn, useFormat } from '../lib/format';

type Filter = 'all' | 'live' | 'finished' | 'upcoming' | 'favorites';

function DateStrip({ day, today, onChange }: { day: string; today: string; onChange: (d: string) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const days = [-3, -2, -1, 0, 1, 2, 3].map((n) => addDays(day, n));
  const label = (d: string) =>
    d === today ? t('home.today') : d === addDays(today, -1) ? t('home.yesterday') : d === addDays(today, 1) ? t('home.tomorrow') : f.dayLabel(d);
  return (
    <div className="flex items-center gap-1">
      <button aria-label={t('home.prevDay')} onClick={() => onChange(addDays(day, -1))} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md hover:bg-sunken">
        <IconBack width={18} height={18} />
      </button>
      <ol className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
        {days.map((d) => (
          <li key={d} className="flex-1">
            <button
              aria-current={d === day ? 'date' : undefined}
              onClick={() => onChange(d)}
              className={`w-full min-w-[72px] whitespace-nowrap rounded-md px-2 py-2 text-[13px] font-medium ${
                d === day ? 'bg-ink text-bg' : 'text-muted hover:bg-sunken hover:text-ink'
              }`}
            >
              {label(d)}
            </button>
          </li>
        ))}
      </ol>
      <button aria-label={t('home.nextDay')} onClick={() => onChange(addDays(day, 1))} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md hover:bg-sunken">
        <IconChevron width={18} height={18} />
      </button>
      <label className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-sunken" title={t('home.pickDate')}>
        <IconCalendar width={18} height={18} />
        <span className="sr-only">{t('home.pickDate')}</span>
        <input
          type="date"
          value={day}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const f = useFormat();
  const today = todayIn(f.tz);
  const [params, setParams] = useSearchParams();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;
  const [filter, setFilter] = useState<Filter>('all');
  const [country, setCountry] = useState('');
  const [competition, setCompetition] = useState('');
  const favs = favorites.use();
  const favTeams = new Set(favs.team.map((x) => x.id));
  const favMatches = new Set(favs.match.map((x) => x.id));
  const favComps = new Set(favs.competition.map((x) => x.id));

  const q = api.useMatchesForDay(day, f.tz);
  const all = q.data?.data ?? [];

  const countries = useMemo(() => [...new Set(all.map((m) => m.competition.area?.name).filter(Boolean) as string[])].sort(), [all]);
  const comps = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((m) => (!country || m.competition.area?.name === country) && map.set(m.competition.id, m.competition.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, country]);

  const isFav = (m: Match) => favMatches.has(m.id) || favTeams.has(m.home.id) || favTeams.has(m.away.id) || favComps.has(m.competition.id);

  const shown = all.filter((m) => {
    if (country && m.competition.area?.name !== country) return false;
    if (competition && m.competition.id !== competition) return false;
    switch (filter) {
      case 'live':
        return isLiveStatus(m.status);
      case 'finished':
        return m.status === 'FINISHED';
      case 'upcoming':
        return m.status === 'SCHEDULED';
      case 'favorites':
        return isFav(m);
      default:
        return true;
    }
  });
  const myTeams = filter === 'all' && !country && !competition ? all.filter((m) => favTeams.has(m.home.id) || favTeams.has(m.away.id)) : [];
  const nLive = liveCount(all);

  const setDay = (d: string) => {
    const next = new URLSearchParams(params);
    if (d === today) next.delete('date');
    else next.set('date', d);
    setParams(next, { replace: true });
  };
  const reset = () => {
    setFilter('all');
    setCountry('');
    setCompetition('');
  };

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: t('filters.all') },
    { id: 'live', label: nLive ? `${t('filters.live')} (${nLive})` : t('filters.live') },
    { id: 'finished', label: t('filters.finished') },
    { id: 'upcoming', label: t('filters.upcoming') },
    { id: 'favorites', label: t('filters.favorites') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="sr-only">
        {t('nav.matches')} — {f.longDate(day + 'T12:00:00Z')}
      </h1>
      <DateStrip day={day} today={today} onChange={setDay} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={t('nav.matches')} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {chips.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                filter === c.id ? (c.id === 'live' ? 'border-flood bg-flood/15 text-ink' : 'border-turf bg-turf/10 text-ink') : 'border-line text-muted hover:text-ink'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:ms-auto sm:w-auto">
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">{t('filters.country')}</span>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setCompetition(''); }} className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]">
              <option value="">{t('filters.allCountries')}</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">{t('filters.competition')}</span>
            <select value={competition} onChange={(e) => setCompetition(e.target.value)} className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]">
              <option value="">{t('filters.allCompetitions')}</option>
              {comps.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {q.isPending ? (
        <Skeleton rows={8} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {myTeams.length > 0 && (
            <section aria-labelledby="my-teams">
              <h2 id="my-teams" className="mb-2 font-score text-[18px] font-bold">
                {t('home.favMatches')}
              </h2>
              <MatchGroups matches={myTeams} />
            </section>
          )}
          {shown.length ? (
            <section aria-label={t('home.count', { count: shown.length })}>
              <p className="mb-2 text-[13px] text-muted" aria-live="polite">
                {t('home.count', { count: shown.length })}
              </p>
              <MatchGroups matches={shown} />
            </section>
          ) : all.length ? (
            <Empty action={<button onClick={reset} className="font-medium text-turf underline">{t('home.resetFilters')}</button>}>
              {t('home.emptyFiltered')}
            </Empty>
          ) : (
            <Empty>{t('home.empty')}</Empty>
          )}
        </>
      )}
      <DataMeta meta={q.data?.meta} />
    </div>
  );
}
