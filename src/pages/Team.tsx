import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MatchList } from '../components/matches';
import { StandingsTables } from '../components/standings';
import { Crest, DataMeta, Empty, ErrorState, FavButton, Field, Skeleton } from '../components/ui';
import { api, isLiveStatus, to, type SquadMember, type Team } from '../lib/api';
import { ageFrom } from '../lib/format';

const GROUPS = ['Goalkeeper', 'Defence', 'Midfield', 'Offence'] as const;

function groupOf(pos?: string): (typeof GROUPS)[number] | 'other' {
  const p = (pos ?? '').toLowerCase();
  if (p.includes('goal')) return 'Goalkeeper';
  if (p.includes('def') || p.includes('back')) return 'Defence';
  if (p.includes('mid')) return 'Midfield';
  if (p.includes('off') || p.includes('forw') || p.includes('wing') || p.includes('striker') || p.includes('attack')) return 'Offence';
  return 'other';
}

function Squad({ squad }: { squad: SquadMember[] }) {
  const { t } = useTranslation();
  const groups = new Map<string, SquadMember[]>();
  for (const p of squad) {
    const g = groupOf(p.position);
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[...GROUPS, 'other' as const].filter((g) => groups.has(g)).map((g) => (
        <section key={g} className="rounded-lg bg-surface p-3 shadow-[0_1px_0_rgb(var(--line))]">
          <h3 className="mb-1 text-[13px] font-semibold text-muted">{t(`team.positions.${g}`)}</h3>
          <ul>
            {groups.get(g)!.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1">
                <span className="w-6 text-end font-score text-muted tabular">{p.shirtNumber ?? ''}</span>
                <Link to={to.player(p.id)} className="min-w-0 flex-1 truncate hover:underline">
                  {p.name}
                </Link>
                <span className="text-[13px] text-muted">
                  {[p.nationality, p.dateOfBirth && t('player.age', { count: ageFrom(p.dateOfBirth) })].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TeamStanding({ team }: { team: Team }) {
  const league = team.runningCompetitions?.find((c) => c.id.startsWith('fd:') || c.id.startsWith('tsdb:') || c.id.startsWith('af:'));
  const q = api.useStandings(league?.id ?? null);
  if (!league || !q.data?.data.length) return null;
  const tables = q.data.data.filter((tb) => tb.rows.some((r) => r.team.id === team.id));
  if (!tables.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-score text-[20px] font-bold">
        <Crest src={league.emblem} size={20} />
        <Link to={to.competition(league.id)} className="hover:underline">{league.name}</Link>
      </h2>
      <StandingsTables tables={tables} highlight={[team.id]} />
    </section>
  );
}

export default function TeamPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const q = api.useTeam(id);
  const mq = api.useTeamMatches(id);

  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const team = q.data.data;
  const ms = mq.data?.data ?? [];
  const recent = ms.filter((m) => m.status === 'FINISHED').sort((a, b) => b.utcDate.localeCompare(a.utcDate)).slice(0, 8);
  const upcoming = ms.filter((m) => m.status === 'SCHEDULED' || isLiveStatus(m.status)).sort((a, b) => a.utcDate.localeCompare(b.utcDate)).slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Crest src={team.crest} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="font-score text-[30px] font-bold leading-tight">{team.name}</h1>
          <p className="text-[14px] text-muted">{[team.area?.name, team.venue].filter(Boolean).join(' · ')}</p>
        </div>
        <FavButton kind="team" id={team.id} name={team.name} image={team.crest} />
      </header>

      <dl className="rounded-lg bg-surface px-4 py-1 shadow-[0_1px_0_rgb(var(--line))]">
        <Field label={t('team.country')} value={team.area?.name} />
        <Field label={t('team.venue')} value={team.venue} />
        <Field label={t('team.coach')} value={team.coach?.name} />
        <Field label={t('team.founded')} value={team.founded} />
        <Field label={t('team.colors')} value={team.colors} />
        <Field
          label={t('team.website')}
          value={team.website ? <a href={team.website} target="_blank" rel="noopener noreferrer" className="text-turf underline">{new URL(team.website).hostname}</a> : undefined}
        />
        <Field
          label={t('team.competitions')}
          value={
            team.runningCompetitions?.length ? (
              <span className="flex flex-wrap justify-end gap-x-3">
                {team.runningCompetitions.map((c) => (
                  <Link key={c.id} to={to.competition(c.id)} className="hover:underline">{c.name}</Link>
                ))}
              </span>
            ) : undefined
          }
        />
      </dl>

      {team.description && (
        <section>
          <h2 className="mb-2 font-score text-[20px] font-bold">{t('team.about')}</h2>
          <p className="line-clamp-6 max-w-prose text-[14px] text-muted">{team.description}</p>
        </section>
      )}

      {mq.isPending ? (
        <Skeleton rows={4} />
      ) : mq.isError ? (
        <ErrorState error={mq.error} onRetry={() => mq.refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 font-score text-[20px] font-bold">{t('team.recent')}</h2>
            {recent.length ? <MatchList matches={recent} /> : <Empty>{t('competition.noResults')}</Empty>}
          </section>
          <section>
            <h2 className="mb-2 font-score text-[20px] font-bold">{t('team.upcoming')}</h2>
            {upcoming.length ? <MatchList matches={upcoming} /> : <Empty>{t('competition.noUpcoming')}</Empty>}
          </section>
        </div>
      )}

      <TeamStanding team={team} />

      <section>
        <h2 className="mb-2 font-score text-[20px] font-bold">{t('team.squad')}</h2>
        {team.squad?.length ? <Squad squad={team.squad} /> : <Empty>{t('team.noSquad')}</Empty>}
      </section>

      <DataMeta meta={q.data.meta} showDelayed={false} />
    </div>
  );
}
