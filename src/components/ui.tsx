import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiMeta, Match } from '../lib/api';
import { isLiveStatus } from '../lib/api';
import { toggleFavorite, useIsFavorite, type FavKind } from '../lib/favorites';
import { useFormat } from '../lib/format';
import { IconInfo, IconShield, IconStar } from './icons';

/** Écusson : image fournie par la source, sinon un bouclier neutre (jamais un logo imité). */
export function Crest({ src, size = 24, alt = '' }: { src?: string; size?: number; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken)
    return (
      <span className="inline-flex shrink-0 items-center justify-center text-muted" style={{ width: size, height: size }}>
        <IconShield width={size * 0.85} height={size * 0.85} />
      </span>
    );
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function FavButton({ kind, id, name, image, className = '' }: { kind: FavKind; id: string; name: string; image?: string; className?: string }) {
  const { t } = useTranslation();
  const on = useIsFavorite(kind, id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t('fav.remove', { name }) : t('fav.add', { name })}
      title={on ? t('fav.remove', { name }) : t('fav.add', { name })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(kind, { id, name, image });
      }}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-sunken ${on ? 'text-flood' : 'text-muted'} ${className}`}
    >
      <IconStar filled={on} />
    </button>
  );
}

/** Ce qui est affiché à la place du score : heure, minute ou statut */
export function MatchClock({ m, compact = false }: { m: Match; compact?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (m.status === 'LIVE')
    return (
      <span className="inline-flex items-center gap-1 font-score font-bold text-flood tabular">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-flood" aria-hidden />
        {m.minute ? t('match.minute', { m: m.minute }) : t('status.LIVE')}
      </span>
    );
  if (m.status === 'SCHEDULED') return <span className="font-score tabular text-muted">{f.time(m.utcDate)}</span>;
  const key = m.status as keyof typeof shortKeys;
  const shortKeys = { FINISHED: 1, HALFTIME: 1, POSTPONED: 1, CANCELLED: 1, SUSPENDED: 1 };
  const label = compact && key in shortKeys ? t(`status.short.${key}`) : t(`status.${m.status}`);
  return (
    <span className={`font-score tabular ${m.status === 'HALFTIME' ? 'text-flood font-bold' : m.status === 'FINISHED' ? 'text-muted' : 'text-card'}`}>
      {label}
    </span>
  );
}

const WARN_KINDS = ['not-configured', 'quota', 'upstream', 'error', 'partial'] as const;

/** Provenance, fraîcheur et avertissements — affichés honnêtement sous chaque bloc de données */
export function DataMeta({ meta, showDelayed = true }: { meta?: ApiMeta; showDelayed?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (!meta) return null;
  const kinds = [...new Set((meta.warnings ?? []).map((w) => w.split(':')[1]).filter((k) => (WARN_KINDS as readonly string[]).includes(k)))];
  return (
    <div className="space-y-2 text-[13px] text-muted">
      {kinds.map((k) => (
        <p key={k} role="status" className="flex gap-2 rounded-md border border-flood/40 bg-flood/10 px-3 py-2 text-ink">
          <IconInfo className="mt-0.5 shrink-0 text-flood" width={16} height={16} />
          <span>{t(`meta.warn.${k}`)}</span>
        </p>
      ))}
      {meta.stale && (
        <p role="status" className="flex gap-2 rounded-md border border-card/40 bg-card/10 px-3 py-2 text-ink">
          <IconInfo className="mt-0.5 shrink-0 text-card" width={16} height={16} />
          <span>{t('meta.stale')}</span>
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t('meta.updatedAt', { time: f.time(meta.fetchedAt) })}</span>
        {showDelayed && meta.delayed && (
          <span title={t('meta.delayedHint')} className="rounded border border-line px-1.5 py-px text-[12px]">
            {t('meta.delayed')}
          </span>
        )}
        {meta.attribution.length > 0 && <span>{meta.attribution.join(' / ')}</span>}
      </p>
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" aria-label={t('state.loading')} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-11" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const status = (error as { status?: number })?.status;
  const msg = offline ? t('state.offline') : status === 404 ? t('state.notProvided') : t('state.error');
  return (
    <div role="alert" className="rounded-lg border border-line bg-surface px-4 py-6 text-center">
      <p className="mb-1">{msg}</p>
      {!offline && status !== 404 && error instanceof Error && <p className="mb-3 text-[13px] text-muted">{error.message}</p>}
      {onRetry && status !== 404 && (
        <button onClick={onRetry} className="rounded-md bg-turf px-4 py-2 font-medium text-turf-ink">
          {t('state.retry')}
        </button>
      )}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-muted">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; hidden?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const visible = tabs.filter((x) => !x.hidden);
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4">
      {visible.map((tab, i) => (
        <button
          key={tab.id}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            const rtl = document.documentElement.dir === 'rtl';
            const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
            if (!step) return;
            const next = visible[(i + step + visible.length) % visible.length];
            onChange(next.id);
            document.getElementById(`tab-${next.id}`)?.focus();
          }}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors ${
            value === tab.id ? 'border-turf text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="pt-4">
      {children}
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end">{value ?? <span className="text-muted">{t('state.unavailable')}</span>}</dd>
    </div>
  );
}

export function liveCount(ms?: Match[]) {
  return ms?.filter((m) => isLiveStatus(m.status)).length ?? 0;
}
