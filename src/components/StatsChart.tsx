// Graphique comparatif interactif (chargé à la demande pour alléger la page).
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { StatPair } from '../lib/api';

export default function StatsChart({ stats, home, away }: { stats: StatPair[]; home: string; away: string }) {
  const { t } = useTranslation();
  const rtl = document.documentElement.dir === 'rtl';
  const data = stats
    .filter((s) => s.unit !== '%' && s.key !== 'xg')
    .map((s) => ({ name: t(`match.stats.${s.key}`, { defaultValue: s.key }), [home]: s.home ?? 0, [away]: s.away ?? 0 }));
  if (!data.length) return null;
  return (
    <div className="h-[320px] w-full" dir="ltr">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid horizontal={false} stroke="rgb(var(--line))" />
          <XAxis type="number" reversed={rtl} tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={110} orientation={rtl ? 'right' : 'left'} tick={{ fill: 'rgb(var(--ink))', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'rgb(var(--sunken))' }}
            contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, color: 'rgb(var(--ink))' }}
          />
          <Legend />
          <Bar dataKey={home} fill="rgb(var(--turf))" radius={[0, 3, 3, 0]} />
          <Bar dataKey={away} fill="rgb(var(--flood))" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
