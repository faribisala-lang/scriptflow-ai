import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildSeed, DB_VERSION } from './seed';
import type { DB, User } from './types';
import { PolicyError } from './workflow';

const KEY = 'workforce-procure-db';
const USER_KEY = 'workforce-procure-user';

/**
 * Persistence adapter. Browser storage keeps the pilot self-contained; swap load/save for
 * API calls (Supabase, Zoho Creator, a Node service) to run it multi-user in production.
 */
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to seed */
  }
  return buildSeed();
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

interface Store {
  db: DB;
  user: User;
  setUserId: (id: string) => void;
  /** Run a workflow command against a copy of the DB; commits only if it passes every guard. */
  run: (fn: (draft: DB, user: User) => unknown, okMessage?: string) => boolean;
  reset: () => void;
  importDb: (db: DB) => void;
  toasts: Toast[];
  notify: (kind: Toast['kind'], text: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const [userId, setUserIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(USER_KEY) ?? 'u1';
    } catch {
      return 'u1';
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => save(db), [db]);

  const notify = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const user = db.users.find((u) => u.id === userId) ?? db.users[0];

  const setUserId = useCallback((id: string) => {
    setUserIdState(id);
    try {
      localStorage.setItem(USER_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const run = useCallback(
    (fn: (draft: DB, user: User) => unknown, okMessage?: string) => {
      const draft = structuredClone(db);
      try {
        fn(draft, user);
      } catch (e) {
        notify('error', e instanceof PolicyError ? e.message : `Unexpected error: ${(e as Error).message}`);
        return false;
      }
      setDb(draft);
      if (okMessage) notify('ok', okMessage);
      return true;
    },
    [db, user, notify],
  );

  const reset = useCallback(() => {
    setDb(buildSeed());
    notify('ok', 'Demo data restored');
  }, [notify]);

  const importDb = useCallback(
    (next: DB) => {
      if (next.version !== DB_VERSION || !Array.isArray(next.requisitions)) {
        notify('error', 'File is not a compatible Workforce Procure backup');
        return;
      }
      setDb(next);
      notify('ok', 'Backup restored');
    },
    [notify],
  );

  const value = useMemo(
    () => ({ db, user, setUserId, run, reset, importDb, toasts, notify }),
    [db, user, setUserId, run, reset, importDb, toasts, notify],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
