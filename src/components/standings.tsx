import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StandingTable } from '../lib/api';
import { to } from '../lib/api';
import { Crest } from './ui';

function Form({ form }: { form?: string }) {
  const { t } = useTranslation();
  if (!form) return <span className="text-muted">–</span>;
  const items = form.split(',').filter(Boolean).slice(-5);
  return (
    <span className="inline-flex gap-0.5">
      {items.map((r, i) => (
        <span
          key={i}
          title={t(`table.form_${r}`, { defaultValue: r })}
          className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm font-score text-[11px] font-bold ${
            r === 'W' ? 'bg-turf text-turf-ink' : r === 'L' ? 'bg-card text-white' : 'bg-line text-ink'
          }`}
        >
          <span aria-hidden>{t(`table.form_${r}`, { defaultValue: r }).slice(0, 1)}</span>
          <span className="sr-only">{t(`table.form_${r}`, { defaultValue: r })}</span>
        </span>
      ))}
    </span>
  );
}

export function StandingsTables({ tables, highlight = [] }: { tables: StandingTable[]; highlight?: string[] }) {
  const { t } = useTranslation();
  const list = tables.filter((x) => !x.type || x.type === 'TOTAL');
  const H = ({ k, long, className = '' }: { k: string; long: string; className?: string }) => (
    <th scope="col" className={`px-1.5 py-2 text-center font-medium ${className}`}>
      <abbr title={t(long)} className="no-underline">
        {t(k)}
      </abbr>
    </th>
  );
  return (
    <div className="space-y-5">
      {list.map((tb, idx) => (
        <div key={idx} className="overflow-x-auto rounded-lg bg-surface shadow-[0_1px_0_rgb(var(--line))]">
          <table className="w-full min-w-[520px] text-[14px]">
            {tb.group && <caption className="px-3 py-2 text-start font-semibold">{tb.group}</caption>}
            <thead className="border-b border-line text-[12px] text-muted">
              <tr>
                <th scope="col" className="w-9 px-2 py-2 text-center font-medium">{t('table.pos')}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t('table.team')}</th>
                <H k="table.played" long="table.playedLong" />
                <H k="table.won" long="table.wonLong" />
                <H k="table.draw" long="table.drawLong" />
                <H k="table.lost" long="table.lostLong" />
                <H k="table.gf" long="table.gfLong" className="hidden sm:table-cell" />
                <H k="table.ga" long="table.gaLong" className="hidden sm:table-cell" />
                <H k="table.gd" long="table.gdLong" />
                <H k="table.pts" long="table.ptsLong" />
                <th scope="col" className="hidden px-2 py-2 text-start font-medium md:table-cell">{t('table.form')}</th>
              </tr>
            </thead>
            <tbody className="font-score text-[15px] tabular">
              {tb.rows.map((r) => {
                const hl = highlight.includes(r.team.id);
                return (
                  <tr key={r.team.id} className={`border-b border-line last:border-0 ${hl ? 'bg-turf/10' : ''}`}>
                    <td className="px-2 py-1.5 text-center text-muted">{r.position}</td>
                    <td className="px-2 py-1.5 font-sans text-[14px]">
                      <Link to={to.team(r.team.id)} className="flex items-center gap-2 hover:underline">
                        <Crest src={r.team.crest} size={18} />
                        <span className={`truncate ${hl ? 'font-semibold' : ''}`}>{r.team.shortName ?? r.team.name}</span>
                      </Link>
                    </td>
                    <td className="px-1.5 text-center">{r.played}</td>
                    <td className="px-1.5 text-center">{r.won}</td>
                    <td className="px-1.5 text-center">{r.draw}</td>
                    <td className="px-1.5 text-center">{r.lost}</td>
                    <td className="hidden px-1.5 text-center sm:table-cell">{r.goalsFor}</td>
                    <td className="hidden px-1.5 text-center sm:table-cell">{r.goalsAgainst}</td>
                    <td className="px-1.5 text-center" dir="ltr">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                    <td className="px-1.5 text-center font-bold">{r.points}</td>
                    <td className="hidden px-2 md:table-cell">
                      <Form form={r.form} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
