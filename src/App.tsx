import { lazy, Suspense } from 'react';
import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { Skeleton } from './components/ui';
import Home from './pages/Home';

// Pages secondaires chargées à la demande
const Competitions = lazy(() => import('./pages/Competitions'));
const Competition = lazy(() => import('./pages/Competition'));
const Match = lazy(() => import('./pages/Match'));
const Team = lazy(() => import('./pages/Team'));
const Player = lazy(() => import('./pages/Player'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center">
      <p className="mb-3 font-score text-[64px] font-bold leading-none text-muted">404</p>
      <p className="mb-4">{t('state.notFound')}</p>
      <Link to="/" className="font-medium text-turf underline">
        {t('state.home')}
      </Link>
    </div>
  );
}

const S = (el: JSX.Element) => <Suspense fallback={<Skeleton rows={8} />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/competitions', element: S(<Competitions />) },
      { path: '/competition/:id', element: S(<Competition />) },
      { path: '/match/:id', element: S(<Match />) },
      { path: '/team/:id', element: S(<Team />) },
      { path: '/player/:id', element: S(<Player />) },
      { path: '/favorites', element: S(<Favorites />) },
      { path: '/search', element: S(<Search />) },
      { path: '/settings', element: S(<Settings />) },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
