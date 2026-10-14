import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { api, to } from '../lib/api';
import { favorites } from '../lib/favorites';
import { IconBall, IconSearch, IconSettings, IconStar, IconTrophy } from './icons';
import { Crest } from './ui';

export function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-2" aria-label={t('app.name')}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="rgb(var(--turf))" />
        <path d="M16 6v20M6 16a10 10 0 0 0 20 0" stroke="rgb(var(--turf-ink))" strokeWidth="2" fill="none" />
        <circle cx="16" cy="16" r="3.2" fill="rgb(var(--flood))" />
      </svg>
      <span className="font-score text-[21px] font-bold leading-none tracking-tight">Football Hub</span>
    </Link>
  );
}

function SideCompetitions() {
  const { t } = useTranslation();
  const { data } = api.useCompetitions();
  const fav = favorites.use().competition;
  const list = data?.data ?? [];
  return (
    <nav aria-label={t('nav.competitions')} className="space-y-5 text-[14px]">
      {fav.length > 0 && (
        <div>
          <h2 className="mb-1.5 px-2 text-[13px] font-semibold text-muted">{t('fav.competitions')}</h2>
          <ul>
            {fav.map((c) => (
              <li key={c.id}>
                <NavLink to={to.competition(c.id)} className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken ${isActive ? 'bg-sunken font-semibold' : ''}`}>
                  <Crest src={c.image} size={18} />
                  <span className="truncate">{c.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h2 className="mb-1.5 px-2 text-[13px] font-semibold text-muted">{t('competition.featured')}</h2>
        <ul>
          {list.map((c) => (
            <li key={c.id}>
              <NavLink to={to.competition(c.id)} className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken ${isActive ? 'bg-sunken font-semibold' : ''}`}>
                <Crest src={c.emblem} size={18} />
                <span className="truncate">{c.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-ink px-4 py-3 text-bg shadow-lg lg:bottom-6">
      <span className="flex-1 text-[14px]">{t('pwa.update')}</span>
      <button className="text-[14px] opacity-80" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
      <button className="rounded-md bg-turf px-3 py-1.5 text-[14px] font-medium text-turf-ink" onClick={() => updateServiceWorker(true)}>
        {t('pwa.reload')}
      </button>
    </div>
  );
}

const NAV = [
  { to: '/', key: 'nav.matches', Icon: IconBall, end: true },
  { to: '/competitions', key: 'nav.competitions', Icon: IconTrophy },
  { to: '/favorites', key: 'nav.favorites', Icon: IconStar },
  { to: '/search', key: 'nav.search', Icon: IconSearch },
  { to: '/settings', key: 'nav.settings', Icon: IconSettings },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [loc.pathname]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('app.skip')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav aria-label="Navigation" className="ms-auto hidden items-center gap-1 lg:flex">
            {NAV.map(({ to: href, key, Icon, ...rest }) => (
              <NavLink
                key={href}
                to={href}
                end={'end' in rest}
                className={({ isActive }) => `flex items-center gap-1.5 rounded-md px-3 py-2 text-[14px] font-medium hover:bg-sunken ${isActive ? 'text-turf' : 'text-muted'}`}
              >
                <Icon width={18} height={18} />
                {t(key)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-5 lg:block">
          <SideCompetitions />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-28 pt-4 outline-none lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Navigation" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg">
          {NAV.map(({ to: href, key, Icon, ...rest }) => (
            <li key={href} className="flex-1">
              <NavLink
                to={href}
                end={'end' in rest}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-turf' : 'text-muted'}`}
              >
                <Icon width={22} height={22} />
                {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <UpdatePrompt />
    </div>
  );
}
