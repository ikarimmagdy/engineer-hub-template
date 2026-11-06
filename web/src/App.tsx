import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { HubContext, loadHub, useHub, type Hub } from './lib/data';
import { legacyRoute } from './lib/routes';
import { Gate, GATE_KEY, isUnlocked } from './components/Gate';
import { Shell } from './components/Shell';
import { Empty, ErrorNote } from './components/ui';
import { Home } from './pages/Home';
import { Work } from './pages/Work';
import { WorkItem } from './pages/WorkItem';
import { Quality } from './pages/Quality';
import { Environments } from './pages/Environments';
import { Knowledge } from './pages/Knowledge';
import { Doc, SectionPage } from './pages/Doc';

function Legacy() {
  const hub = useHub();
  const loc = useLocation();
  const to = legacyRoute(loc.pathname + loc.search, hub);
  if (to && to !== loc.pathname) return <Navigate to={to} replace />;
  return <Empty>There is no page at {loc.pathname}.</Empty>;
}

export function App() {
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    loadHub().then((h) => {
      setHub(h);
      setUnlocked(isUnlocked(h.brand));
      document.title = `${h.brand.name} Engineering Hub`;
    }, (e) => setError(String(e.message || e)));
  }, []);

  if (error) return <div className="mx-auto max-w-xl p-8"><ErrorNote>The hub content did not load ({error}). Run the hub's sync and build, then reload.</ErrorNote></div>;
  if (!hub) return <div className="grid min-h-dvh place-items-center text-sm text-ink-3" aria-busy>Loading the hub</div>;
  if (!unlocked) return <Gate brand={hub.brand} onUnlock={() => setUnlocked(true)} />;

  const signOut = () => { try { sessionStorage.removeItem(GATE_KEY); } catch { /* storage may be blocked */ } setUnlocked(false); };

  return (
    <HubContext.Provider value={hub}>
      <HashRouter>
        <Shell onSignOut={signOut}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/work" element={<Work />} />
            <Route path="/work/:key/:tab?" element={<WorkItem />} />
            <Route path="/quality/:view?" element={<Quality />} />
            <Route path="/environments/:page?" element={<Environments />} />
            <Route path="/knowledge/:page?/:id?/:sub?" element={<Knowledge />} />
            <Route path="/doc/*" element={<Doc />} />
            <Route path="/section/:id" element={<SectionPage />} />
            <Route path="*" element={<Legacy />} />
          </Routes>
        </Shell>
      </HashRouter>
    </HubContext.Provider>
  );
}
