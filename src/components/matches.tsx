import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Match } from '../lib/api';
import { isLiveStatus, to } from '../lib/api';
import { useFormat } from '../lib/format';
import { IconChevron } from './icons';
import { Crest, FavButton, MatchClock } from './ui';

function TeamLine({ name, crest, score, winner, live }: { name: string; crest?: string; score: number | null; winner: boolean; live: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Crest src={crest} size={20} />
      <span className={`min-w-0 flex-1 truncate ${winner ? 'font-semibold' : ''}`}>{name}</span>
      <span className={`w-6 text-end font-score text-[17px] font-bold tabular ${live ? 'text-flood' : winner ? '' : 'text-muted'}`}>
        {score ?? ''}
      </span>
    </div>
  );
}

/** Ligne dense de match : statut à gauche, équipes empilées, score aligné. */
export function MatchRow({ m, showDate = false }: { m: Match; showDate?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const live = isLiveStatus(m.status);
  const done = m.status === 'FINISHED';
  const hw = done && (m.score.home ?? 0) > (m.score.away ?? 0);
  const aw = done && (m.score.away ?? 0) > (m.score.home ?? 0);
  const label = `${m.home.name} – ${m.away.name}, ${t(`status.${m.status}`)}${
    m.score.home !== null ? `, ${m.score.home}–${m.score.away}` : `, ${f.time(m.utcDate)}`
  }`;
  return (
    <li className="group relative flex items-center gap-3 border-b border-line px-3 py-2 last:border-0 hover:bg-sunken/60">
      <div className="flex w-14 shrink-0 flex-col items-center text-[13px] leading-tight">
        {showDate && <span className="mb-0.5 text-[11px] text-muted">{f.date(m.utcDate)}</span>}
        <MatchClock m={m} compact />
      </div>
      <Link to={to.match(m.id)} aria-label={label} className="min-w-0 flex-1 space-y-1 py-0.5 after:absolute after:inset-0 after:content-['']">
        <TeamLine name={m.home.shortName ?? m.home.name} crest={m.home.crest} score={m.score.home} winner={hw} live={live} />
        <TeamLine name={m.away.shortName ?? m.away.name} crest={m.away.crest} score={m.score.away} winner={aw} live={live} />
      </Link>
      <FavButton kind="match" id={m.id} name={`${m.home.name} – ${m.away.name}`} className="relative z-10" />
    </li>
  );
}

/** Matchs regroupés par compétition, avec un filet coloré côté début de ligne (s'inverse en RTL). */
export function MatchGroups({ matches, showDate = false }: { matches: Match[]; showDate?: boolean }) {
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const g = groups.get(m.competition.id) ?? [];
    g.push(m);
    groups.set(m.competition.id, g);
  }
  return (
    <div className="space-y-4">
      {[...groups.values()].map((ms) => {
        const c = ms[0].competition;
        const anyLive = ms.some((m) => isLiveStatus(m.status));
        return (
          <section key={c.id} aria-label={c.name} className={`overflow-hidden rounded-lg border-s-[3px] bg-surface shadow-[0_1px_0_rgb(var(--line))] ${anyLive ? 'border-flood' : 'border-turf'}`}>
            <Link to={to.competition(c.id)} className="flex items-center gap-2.5 border-b border-line px-3 py-2 hover:bg-sunken/60">
              <Crest src={c.emblem} size={18} />
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {c.area?.name && <span className="text-muted">{c.area.name} · </span>}
                <span className="font-semibold">{c.name}</span>
              </span>
              <IconChevron width={16} height={16} className="text-muted" />
            </Link>
            <ul>
              {ms.map((m) => (
                <MatchRow key={m.id} m={m} showDate={showDate} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Liste simple sans regroupement (fiches club, face-à-face) */
export function MatchList({ matches, showDate = true }: { matches: Match[]; showDate?: boolean }) {
  return (
    <ul className="overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
      {matches.map((m) => (
        <MatchRow key={m.id} m={m} showDate={showDate} />
      ))}
    </ul>
  );
}
