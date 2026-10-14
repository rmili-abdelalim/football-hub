import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crest, DataMeta, ErrorState, FavButton, Field, Skeleton } from '../components/ui';
import { api, to } from '../lib/api';
import { ageFrom, useFormat } from '../lib/format';

export default function PlayerPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const q = api.usePerson(id);
  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data.data;
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-score text-[30px] font-bold leading-tight">{p.name}</h1>
          <p className="text-[14px] text-muted">{[p.position, p.nationality].filter(Boolean).join(' · ')}</p>
        </div>
        <FavButton kind="player" id={p.id} name={p.name} />
      </header>
      <dl className="rounded-lg bg-surface px-4 py-1 shadow-[0_1px_0_rgb(var(--line))]">
        <Field label={t('player.dob')} value={p.dateOfBirth ? `${f.birth(p.dateOfBirth)} (${t('player.age', { count: ageFrom(p.dateOfBirth) })})` : undefined} />
        <Field label={t('player.nationality')} value={p.nationality} />
        <Field label={t('player.position')} value={p.position} />
        <Field label={t('player.number')} value={p.shirtNumber} />
        <Field
          label={t('player.club')}
          value={
            p.currentTeam ? (
              <Link to={to.team(p.currentTeam.id)} className="inline-flex items-center gap-2 hover:underline">
                <Crest src={p.currentTeam.crest} size={18} />
                {p.currentTeam.name}
              </Link>
            ) : undefined
          }
        />
      </dl>
      <p className="rounded-lg border border-dashed border-line p-4 text-[14px] text-muted">{t('player.statsUnavailable')}</p>
      <DataMeta meta={q.data.meta} showDelayed={false} />
    </div>
  );
}
