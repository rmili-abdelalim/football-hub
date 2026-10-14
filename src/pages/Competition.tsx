import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MatchList } from '../components/matches';
import { StandingsTables } from '../components/standings';
import { Crest, DataMeta, Empty, ErrorState, FavButton, Field, Skeleton, TabPanel, Tabs } from '../components/ui';
import { api, isLiveStatus, to, type Match } from '../lib/api';
import { useFormat } from '../lib/format';

type Tab = 'standings' | 'matches' | 'results' | 'scorers' | 'teams' | 'about';

function byMatchday(ms: Match[]) {
  const out: { label?: number; items: Match[] }[] = [];
  for (const m of ms) {
    const last = out[out.length - 1];
    if (last && last.label === m.matchday) last.items.push(m);
    else out.push({ label: m.matchday, items: [m] });
  }
  return out;
}

function MatchesPanel({ id, season, mode }: { id: string; season?: number; mode: 'upcoming' | 'results' }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(30);
  const q = api.useCompetitionMatches(id, season);
  if (q.isPending) return <Skeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const all = q.data.data;
  const list =
    mode === 'upcoming'
      ? all.filter((m) => m.status === 'SCHEDULED' || isLiveStatus(m.status)).sort((a, b) => a.utcDate.localeCompare(b.utcDate))
      : all.filter((m) => m.status === 'FINISHED').sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  if (!list.length) return <Empty>{mode === 'upcoming' ? t('competition.noUpcoming') : t('competition.noResults')}</Empty>;
  return (
    <div className="space-y-4">
      {byMatchday(list.slice(0, limit)).map((g, i) => (
        <section key={i}>
          {g.label !== undefined && <h3 className="mb-1.5 text-[13px] font-semibold text-muted">{t('competition.matchday', { n: g.label })}</h3>}
          <MatchList matches={g.items} />
        </section>
      ))}
      {list.length > limit && (
        <button onClick={() => setLimit((l) => l + 30)} className="w-full rounded-md border border-line py-2 text-[14px] font-medium hover:bg-sunken">
          +30
        </button>
      )}
      <DataMeta meta={q.data.meta} />
    </div>
  );
}

function StandingsPanel({ id, season }: { id: string; season?: number }) {
  const q = api.useStandings(id, season);
  if (q.isPending) return <Skeleton rows={12} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.data.length) return <ErrorState error={{ status: 404 }} />;
  return (
    <div className="space-y-3">
      <StandingsTables tables={q.data.data} />
      <DataMeta meta={q.data.meta} showDelayed={false} />
    </div>
  );
}

function ScorersPanel({ id, season }: { id: string; season?: number }) {
  const { t } = useTranslation();
  const q = api.useScorers(id, season);
  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.data.length) return <ErrorState error={{ status: 404 }} />;
  const dash = (v?: number | null) => (v === null || v === undefined ? '–' : v);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
        <table className="w-full min-w-[480px] text-[14px]">
          <thead className="border-b border-line text-[12px] text-muted">
            <tr>
              <th scope="col" className="w-9 px-2 py-2 font-medium">#</th>
              <th scope="col" className="px-2 py-2 text-start font-medium">{t('table.player')}</th>
              <th scope="col" className="px-2 py-2 text-start font-medium">{t('table.team')}</th>
              <th scope="col" className="px-2 py-2 font-medium">{t('table.goals')}</th>
              <th scope="col" className="px-2 py-2 font-medium">{t('table.assists')}</th>
              <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">{t('table.penalties')}</th>
              <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">{t('table.apps')}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.data.map((s, i) => (
              <tr key={s.player.id} className="border-b border-line last:border-0">
                <td className="px-2 py-1.5 text-center font-score text-muted tabular">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {s.player.id.startsWith('fd:') ? (
                    <Link to={to.player(s.player.id)} className="hover:underline">{s.player.name}</Link>
                  ) : (
                    s.player.name
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <Link to={to.team(s.team.id)} className="flex items-center gap-2 hover:underline">
                    <Crest src={s.team.crest} size={16} />
                    <span className="truncate">{s.team.shortName ?? s.team.name}</span>
                  </Link>
                </td>
                <td className="px-2 text-center font-score text-[16px] font-bold tabular">{s.goals}</td>
                <td className="px-2 text-center font-score tabular">{dash(s.assists)}</td>
                <td className="hidden px-2 text-center font-score tabular sm:table-cell">{dash(s.penalties)}</td>
                <td className="hidden px-2 text-center font-score tabular sm:table-cell">{dash(s.playedMatches)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataMeta meta={q.data.meta} showDelayed={false} />
    </div>
  );
}

function TeamsPanel({ id, season }: { id: string; season?: number }) {
  const q = api.useCompetitionTeams(id, season);
  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-3">
        {q.data.data.map((tm) => (
          <li key={tm.id} className="bg-surface">
            <Link to={to.team(tm.id)} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-sunken/60">
              <Crest src={tm.crest} size={24} />
              <span className="truncate">{tm.shortName ?? tm.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      <DataMeta meta={q.data.meta} showDelayed={false} />
    </div>
  );
}

export default function CompetitionPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const q = api.useCompetition(id);
  const [tab, setTab] = useState<Tab>('standings');
  const [season, setSeason] = useState<number | undefined>(undefined);

  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data.data;
  const seasons = c.seasons?.length ? c.seasons : c.currentSeason ? [c.currentSeason] : [];

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'standings', label: t('competition.tabs.standings'), hidden: !c.features.standings },
    { id: 'matches', label: t('competition.tabs.matches'), hidden: !c.features.matches },
    { id: 'results', label: t('competition.tabs.results'), hidden: !c.features.matches },
    { id: 'scorers', label: t('competition.tabs.scorers'), hidden: !c.features.scorers },
    { id: 'teams', label: t('competition.tabs.teams'), hidden: !c.features.teams },
    { id: 'about', label: t('competition.tabs.about') },
  ];
  const active = tabs.find((x) => x.id === tab && !x.hidden) ? tab : (tabs.find((x) => !x.hidden)!.id as Tab);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Crest src={c.emblem} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-score text-[28px] font-bold leading-tight">{c.name}</h1>
          <p className="text-[14px] text-muted">{[c.area?.name, c.type && t(`competition.${c.type}`)].filter(Boolean).join(' · ')}</p>
        </div>
        <FavButton kind="competition" id={c.id} name={c.name} image={c.emblem} />
      </header>

      {seasons.length > 1 && (
        <label className="flex items-center gap-2 text-[14px]">
          <span className="text-muted">{t('competition.season')}</span>
          <select
            value={season ?? ''}
            onChange={(e) => setSeason(e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-md border border-line bg-surface px-2 py-1.5"
          >
            {seasons.map((s, i) => (
              <option key={s.year} value={i === 0 ? '' : s.year}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <Tabs tabs={tabs} value={active} onChange={setTab} label={c.name} />
      <TabPanel id={active}>
        {active === 'standings' && <StandingsPanel id={c.id} season={season} />}
        {active === 'matches' && <MatchesPanel id={c.id} season={season} mode="upcoming" />}
        {active === 'results' && <MatchesPanel id={c.id} season={season} mode="results" />}
        {active === 'scorers' && <ScorersPanel id={c.id} season={season} />}
        {active === 'teams' && <TeamsPanel id={c.id} season={season} />}
        {active === 'about' && (
          <div className="space-y-4">
            <dl className="rounded-lg bg-surface px-4 py-1 shadow-[0_1px_0_rgb(var(--line))]">
              <Field label={t('competition.country')} value={c.area?.name} />
              <Field label={t('competition.type')} value={c.type ? t(`competition.${c.type}`) : undefined} />
              <Field label={t('competition.season')} value={c.currentSeason?.label} />
              <Field
                label={t('competition.period')}
                value={
                  c.currentSeason?.startDate && c.currentSeason?.endDate
                    ? `${f.birth(c.currentSeason.startDate)} – ${f.birth(c.currentSeason.endDate)}`
                    : undefined
                }
              />
              <Field
                label={t('competition.matchday', { n: '' }).trim()}
                value={c.currentSeason?.currentMatchday}
              />
            </dl>
            <DataMeta meta={q.data.meta} showDelayed={false} />
          </div>
        )}
      </TabPanel>
    </div>
  );
}
