import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconCardShape, IconSub, IconBall } from '../components/icons';
import { MatchList } from '../components/matches';
import { StandingsTables } from '../components/standings';
import { Crest, DataMeta, Empty, ErrorState, FavButton, MatchClock, Skeleton, TabPanel, Tabs } from '../components/ui';
import { api, isLiveStatus, to, type Lineup, type Match, type MatchEvent, type StatPair } from '../lib/api';
import { useFormat } from '../lib/format';

const StatsChart = lazy(() => import('../components/StatsChart'));

type Tab = 'summary' | 'timeline' | 'stats' | 'lineups' | 'standings' | 'h2h';

/** L'élément marquant de l'interface : le tableau d'affichage du match. */
function Scoreboard({ m }: { m: Match }) {
  const { t } = useTranslation();
  const f = useFormat();
  const live = isLiveStatus(m.status);
  const has = m.score.home !== null && m.score.away !== null;
  const Side = ({ team }: { team: Match['home'] }) => (
    <Link to={to.team(team.id)} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center hover:underline">
      <Crest src={team.crest} size={56} />
      <span className="line-clamp-2 text-[15px] font-semibold leading-tight">{team.name}</span>
    </Link>
  );
  return (
    <section aria-label={`${m.home.name} – ${m.away.name}`} className="overflow-hidden rounded-xl bg-surface shadow-[0_1px_0_rgb(var(--line))]">
      <Link to={to.competition(m.competition.id)} className="flex items-center justify-center gap-2 border-b border-line px-3 py-2 text-[13px] hover:bg-sunken/60">
        <Crest src={m.competition.emblem} size={16} />
        <span className="font-medium">{m.competition.name}</span>
        {m.matchday && <span className="text-muted">· {t('competition.matchday', { n: m.matchday })}</span>}
      </Link>
      <div className="flex items-start gap-2 px-3 py-5">
        <Side team={m.home} />
        <div className="flex w-[132px] shrink-0 flex-col items-center">
          {has ? (
            <div className={`flex items-stretch font-score text-[52px] font-bold leading-none tabular ${live ? 'text-flood' : ''}`} dir="ltr">
              <span className="w-12 text-end">{m.score.home}</span>
              {/* ligne médiane du terrain entre les deux scores */}
              <span aria-hidden className="mx-3 w-px bg-line" />
              <span className="w-12 text-start">{m.score.away}</span>
            </div>
          ) : (
            <div className="font-score text-[36px] font-bold leading-none tabular">{f.time(m.utcDate)}</div>
          )}
          <div className="mt-2 text-[14px]">
            <MatchClock m={m} />
          </div>
          {m.score.halfTime && m.status !== 'HALFTIME' && (
            <div className="mt-1 text-[12px] text-muted">{t('match.halfTime', { score: `${m.score.halfTime.home}–${m.score.halfTime.away}` })}</div>
          )}
          {m.score.penalties && (
            <div className="mt-1 text-[12px] text-muted">{t('match.penalties', { score: `${m.score.penalties.home}–${m.score.penalties.away}` })}</div>
          )}
        </div>
        <Side team={m.away} />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[13px] text-muted">
        <span>{f.longDate(m.utcDate)} · {f.time(m.utcDate)}</span>
        {m.venue && <span>{t('match.venue')} : {m.venue}</span>}
        {m.referee && <span>{t('match.referee')} : {m.referee}</span>}
      </div>
    </section>
  );
}

function EventIcon({ e }: { e: MatchEvent }) {
  if (e.type === 'YELLOW') return <IconCardShape color="#E9C232" />;
  if (e.type === 'RED' || e.type === 'SECOND_YELLOW') return <IconCardShape color="rgb(var(--card))" />;
  if (e.type === 'SUB') return <IconSub width={16} height={16} className="text-muted" />;
  if (e.type.includes('GOAL')) return <IconBall width={16} height={16} className={e.type === 'OWN_GOAL' ? 'text-card' : 'text-turf'} />;
  return <span className="h-2 w-2 rounded-full bg-muted" />;
}

function Timeline({ events, only }: { events: MatchEvent[]; only?: (e: MatchEvent) => boolean }) {
  const { t } = useTranslation();
  const list = only ? events.filter(only) : events;
  return (
    <ol className="rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
      {list.map((e, i) => (
        <li key={i} className={`flex items-center gap-3 border-b border-line px-3 py-2 last:border-0 ${e.team === 'away' ? 'flex-row-reverse text-end' : ''}`}>
          <span className="w-10 shrink-0 text-center font-score font-bold tabular">
            {e.minute !== undefined ? `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ''}′` : '–'}
          </span>
          <EventIcon e={e} />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{e.player ?? t(`match.events.${e.type}`)}</span>
            <span className="sr-only"> — {t(`match.events.${e.type}`)}</span>
            {e.assist && (
              <span className="block text-[13px] text-muted">
                {e.type === 'SUB' ? t('match.subIn', { name: e.assist }) : t('match.assist', { name: e.assist })}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StatBars({ stats }: { stats: StatPair[] }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-3 rounded-lg bg-surface p-4 shadow-[0_1px_0_rgb(var(--line))]">
      {stats.map((s) => {
        const h = s.home ?? 0;
        const a = s.away ?? 0;
        const total = h + a || 1;
        const fmt = (v: number | null) => (v === null ? '–' : `${v}${s.unit ?? ''}`);
        return (
          <li key={s.key}>
            <div className="mb-1 flex justify-between font-score text-[15px] tabular">
              <span className={h > a ? 'font-bold' : ''}>{fmt(s.home)}</span>
              <span className="font-sans text-[13px] text-muted">{t(`match.stats.${s.key}`, { defaultValue: s.key })}</span>
              <span className={a > h ? 'font-bold' : ''}>{fmt(s.away)}</span>
            </div>
            <div className="flex h-1.5 gap-1" aria-hidden>
              <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-sunken">
                <div className="rounded-full bg-turf" style={{ width: `${(h / total) * 100}%` }} />
              </div>
              <div className="flex-1 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-flood" style={{ width: `${(a / total) * 100}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LineupCol({ l, name }: { l: Lineup; name: string }) {
  const { t } = useTranslation();
  const P = ({ p }: { p: Lineup['startXI'][number] }) => (
    <li className="flex gap-2 py-1">
      <span className="w-6 text-end font-score text-muted tabular">{p.number ?? ''}</span>
      <span>{p.name}</span>
    </li>
  );
  return (
    <div className="rounded-lg bg-surface p-3 shadow-[0_1px_0_rgb(var(--line))]">
      <h3 className="font-semibold">{name}</h3>
      <p className="mb-2 text-[13px] text-muted">
        {[l.formation && `${t('match.formation')} ${l.formation}`, l.coach && `${t('match.coach')} : ${l.coach}`].filter(Boolean).join(' · ')}
      </p>
      <h4 className="mt-2 text-[13px] font-semibold text-muted">{t('match.startXI')}</h4>
      <ul>{l.startXI.map((p, i) => <P key={i} p={p} />)}</ul>
      {l.substitutes.length > 0 && (
        <>
          <h4 className="mt-3 text-[13px] font-semibold text-muted">{t('match.subs')}</h4>
          <ul>{l.substitutes.map((p, i) => <P key={i} p={p} />)}</ul>
        </>
      )}
    </div>
  );
}

function H2H({ id }: { id: string }) {
  const { t } = useTranslation();
  const q = api.useHeadToHead(id, true);
  if (q.isPending) return <Skeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.data.filter((m) => m.id !== id).sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  if (!list.length) return <Empty>{t('match.noH2h')}</Empty>;
  return (
    <div className="space-y-3">
      <MatchList matches={list} />
      <DataMeta meta={q.data.meta} />
    </div>
  );
}

function MatchStandings({ m }: { m: Match }) {
  const q = api.useStandings(m.competition.id);
  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError || !q.data.data.length) return <ErrorState error={q.error ?? { status: 404 }} onRetry={() => q.refetch()} />;
  const tables = q.data.data.filter((tb) => tb.rows.some((r) => r.team.id === m.home.id || r.team.id === m.away.id));
  return <StandingsTables tables={tables.length ? tables : q.data.data} highlight={[m.home.id, m.away.id]} />;
}

export default function MatchPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const q = api.useMatch(id);
  const [tab, setTab] = useState<Tab>('summary');

  if (q.isPending) return <Skeleton rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data.data;
  const ev = m.events ?? [];
  const goals = ev.filter((e) => e.type.includes('GOAL') || e.type === 'RED' || e.type === 'SECOND_YELLOW');
  const isFd = m.provider === 'fd';

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'summary', label: t('match.tabs.summary') },
    { id: 'timeline', label: t('match.tabs.timeline'), hidden: !ev.length },
    { id: 'stats', label: t('match.tabs.stats'), hidden: !m.stats?.length },
    { id: 'lineups', label: t('match.tabs.lineups'), hidden: !m.lineups },
    { id: 'standings', label: t('match.tabs.standings') },
    { id: 'h2h', label: t('match.tabs.h2h'), hidden: !isFd },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FavButton kind="match" id={m.id} name={`${m.home.name} – ${m.away.name}`} />
      </div>
      <Scoreboard m={m} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label={`${m.home.name} – ${m.away.name}`} />
      <TabPanel id={tab}>
        {tab === 'summary' && (
          <div className="space-y-4">
            {goals.length > 0 ? (
              <Timeline events={goals} />
            ) : (
              <Empty>{ev.length ? t('match.noEvents') : `${t('match.noEvents')} ${t('match.detailHint')}`}</Empty>
            )}
            {m.stats?.length ? <StatBars stats={m.stats.filter((s) => ['possession', 'shots', 'shotsOnTarget', 'corners'].includes(s.key))} /> : null}
          </div>
        )}
        {tab === 'timeline' && <Timeline events={ev} />}
        {tab === 'stats' && m.stats && (
          <div className="space-y-4">
            <StatBars stats={m.stats} />
            <Suspense fallback={<Skeleton rows={4} />}>
              <StatsChart stats={m.stats} home={m.home.shortName ?? m.home.name} away={m.away.shortName ?? m.away.name} />
            </Suspense>
          </div>
        )}
        {tab === 'lineups' && m.lineups && (
          <div className="grid gap-3 sm:grid-cols-2">
            <LineupCol l={m.lineups.home} name={m.home.name} />
            <LineupCol l={m.lineups.away} name={m.away.name} />
          </div>
        )}
        {tab === 'standings' && <MatchStandings m={m} />}
        {tab === 'h2h' && <H2H id={m.id} />}
      </TabPanel>
      <DataMeta meta={q.data.meta} />
    </div>
  );
}
