import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './index.css';
import { applyTheme, prefs } from './lib/prefs';
import App from './App';

applyTheme(prefs.get().theme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      // Pas de rafraîchissement en arrière-plan : on économise les quotas
      refetchIntervalInBackground: false,
      gcTime: 30 * 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
