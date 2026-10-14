import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n';
import { favorites } from '../lib/favorites';
import { applyTheme, deviceTimeZone, prefs, type Theme } from '../lib/prefs';

function Group({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-lg bg-surface p-4 shadow-[0_1px_0_rgb(var(--line))]">
      <h2 id={id} className="mb-3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-[14px] font-medium ${value === o.v ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

interface BIPEvent extends Event {
  prompt(): Promise<void>;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const p = prefs.use();
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [cleared, setCleared] = useState(false);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['UTC', 'Europe/Paris', 'Africa/Casablanca', 'Europe/London', 'Asia/Riyadh', 'America/New_York'];
    }
  }, []);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const setTheme = (theme: Theme) => {
    prefs.set((x) => ({ ...x, theme }));
    applyTheme(theme);
  };
  const lang = (i18n.resolvedLanguage ?? 'fr').slice(0, 2);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-score text-[28px] font-bold">{t('settings.title')}</h1>

      <Group id="s-lang" title={t('settings.language')}>
        <Segmented
          label={t('settings.language')}
          value={lang}
          options={LANGS.map((l) => ({ v: l.code, l: l.label }))}
          onChange={(v) => i18n.changeLanguage(v)}
        />
      </Group>

      <Group id="s-theme" title={t('settings.theme')}>
        <Segmented
          label={t('settings.theme')}
          value={p.theme}
          options={[
            { v: 'light', l: t('settings.light') },
            { v: 'dark', l: t('settings.dark') },
            { v: 'system', l: t('settings.system') },
          ]}
          onChange={setTheme}
        />
      </Group>

      <Group id="s-tz" title={t('settings.timezone')}>
        <label className="block">
          <span className="sr-only">{t('settings.timezone')}</span>
          <select
            value={p.timeZone ?? ''}
            onChange={(e) => prefs.set((x) => ({ ...x, timeZone: e.target.value || null }))}
            className="w-full rounded-md border border-line bg-bg px-2 py-2"
          >
            <option value="">{t('settings.tzDevice', { tz: deviceTimeZone() })}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[13px] text-muted">{t('settings.tzHint')}</p>
      </Group>

      <Group id="s-install" title={t('settings.install')}>
        {installEvt && (
          <button onClick={() => installEvt.prompt()} className="mb-3 rounded-md bg-turf px-4 py-2 font-medium text-turf-ink">
            {t('settings.installBtn')}
          </button>
        )}
        <ul className="space-y-1.5 text-[14px] text-muted">
          <li>{t('settings.installIos')}</li>
          <li>{t('settings.installAndroid')}</li>
          <li>{t('settings.installDesktop')}</li>
        </ul>
      </Group>

      <Group id="s-notif" title={t('settings.notifications')}>
        <p className="text-[14px] text-muted">{t('settings.notifText')}</p>
      </Group>

      <Group id="s-data" title={t('settings.data')}>
        <p className="mb-2 text-[14px] text-muted">{t('settings.dataText')}</p>
        <ul className="list-inside list-disc text-[14px]">
          <li><a className="text-turf underline" href="https://www.football-data.org" target="_blank" rel="noopener noreferrer">football-data.org</a></li>
          <li><a className="text-turf underline" href="https://www.thesportsdb.com" target="_blank" rel="noopener noreferrer">TheSportsDB</a></li>
          <li><a className="text-turf underline" href="https://www.api-football.com" target="_blank" rel="noopener noreferrer">API-Football</a></li>
        </ul>
        <button
          onClick={() => {
            if (!confirm(t('settings.confirmClear'))) return;
            favorites.reset();
            prefs.reset();
            applyTheme('system');
            setCleared(true);
          }}
          className="mt-4 rounded-md border border-card/50 px-3 py-1.5 text-[14px] text-card"
        >
          {t('settings.clear')}
        </button>
        {cleared && <p role="status" className="mt-2 text-[13px] text-muted">{t('settings.cleared')}</p>}
      </Group>
    </div>
  );
}
