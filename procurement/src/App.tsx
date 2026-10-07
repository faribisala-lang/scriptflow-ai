import { useEffect, useMemo, useState } from 'react';
import { canAct } from './policy';
import { useStore } from './store';
import { ROLE_LABEL } from './types';
import Dashboard from './views/Dashboard';
import Requisitions from './views/Requisitions';
import RequisitionDetail from './views/RequisitionDetail';
import RequisitionForm from './views/RequisitionForm';
import Vendors from './views/Vendors';
import Compliance from './views/Compliance';
import Settings from './views/Settings';
import Guide from './views/Guide';

export type Route = { page: string; id?: string };

function parseHash(): Route {
  const [, page = 'dashboard', id] = window.location.hash.replace(/^#/, '').split('/');
  return { page, id };
}

export function go(page: string, id?: string) {
  window.location.hash = `/${page}${id ? '/' + id : ''}`;
}

const NAV = [
  { page: 'dashboard', label: 'Dashboard', icon: '◧' },
  { page: 'requisitions', label: 'Requisitions', icon: '☰' },
  { page: 'vendors', label: 'Vendors', icon: '⌂' },
  { page: 'compliance', label: 'Compliance', icon: '⚑' },
  { page: 'guide', label: 'SOP v4 & RACI', icon: '§' },
  { page: 'settings', label: 'Policy & settings', icon: '⚙' },
];

export default function App() {
  const { db, user, setUserId, toasts } = useStore();
  const [route, setRoute] = useState<Route>(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => {
      setRoute(parseHash());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const taskCount = useMemo(() => db.requisitions.filter((r) => canAct(r, user)).length, [db, user]);

  let view;
  switch (route.page) {
    case 'requisitions':
      view = <Requisitions />;
      break;
    case 'req':
      view = route.id ? <RequisitionDetail id={route.id} /> : <Requisitions />;
      break;
    case 'new':
      view = <RequisitionForm editId={route.id} />;
      break;
    case 'vendors':
      view = <Vendors />;
      break;
    case 'compliance':
      view = <Compliance />;
      break;
    case 'settings':
      view = <Settings />;
      break;
    case 'guide':
      view = <Guide />;
      break;
    default:
      view = <Dashboard />;
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 w-64 transform bg-navy-800 text-white transition lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <img src="./workforce-logo-white.webp" alt="Workforce" className="h-7 w-auto" />
          <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-300">Procure · The Zone</div>
        </div>
        <nav className="space-y-0.5 p-3">
          {NAV.map((n) => {
            const active = route.page === n.page || (n.page === 'requisitions' && ['req', 'new'].includes(route.page));
            return (
              <a
                key={n.page}
                href={`#/${n.page}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? 'bg-white/10 font-semibold text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="w-4 text-center text-brand-300">{n.icon}</span>
                {n.label}
                {n.page === 'dashboard' && taskCount > 0 && (
                  <span className="ml-auto rounded-full bg-brand-500 px-2 text-xs font-semibold">{taskCount}</span>
                )}
              </a>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/60">Acting as (demo)</label>
          <select
            value={user.id}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-navy-900 px-2 py-2 text-sm text-white"
          >
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABEL[u.role]}
              </option>
            ))}
          </select>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-slate-300 px-2.5 py-1 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
              ☰
            </button>
            <img src="./workforce-logo-dark.webp" alt="Workforce" className="h-5 w-auto lg:hidden" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-semibold text-navy-800">{user.name}</div>
              <div className="text-xs text-ink-500">
                {ROLE_LABEL[user.role]} · {user.department}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
              {user.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{view}</main>
        <footer className="no-print px-4 pb-6 text-center text-xs text-ink-500 lg:px-8">
          Workforce Group · Procurement Policy TZ/FA/PP/001 enforced in software · Demo data stored in this browser
        </footer>
      </div>

      <div className="no-print fixed bottom-4 right-4 z-50 w-[min(92vw,380px)] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-l-4 border-red-600 bg-white text-red-700' : 'bg-navy-800 text-white'}`}
          >
            {t.kind === 'error' && <div className="mb-0.5 font-semibold">Blocked by policy</div>}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
