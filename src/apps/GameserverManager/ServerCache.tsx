import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { GameServer, parseServers, request } from './api';

interface Snapshot { servers: GameServer[]; updated: Date }
interface Cache {
  read: () => Snapshot | null;
  load: (signal: AbortSignal, reusePreload?: boolean) => Promise<Snapshot>;
}
const ServerCacheContext = createContext<Cache | null>(null);

/** One page-session cache. REST preloading has no background polling or SSE. */
export function ServerCacheProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useRef<Snapshot | null>(null);
  const preload = useRef<Promise<Snapshot> | null>(null);
  const read = useCallback(() => snapshot.current, []);
  const load = useCallback(async (signal: AbortSignal, reusePreload = false) => {
    if (reusePreload) {
      if (preload.current) return preload.current;
      if (snapshot.current && Date.now() - snapshot.current.updated.getTime() < 30000)
        return snapshot.current;
    }
    const servers = parseServers(await request<unknown>('servers', signal));
    const result = { servers, updated: new Date() };
    snapshot.current = result;
    return result;
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    const pending = load(abort.signal);
    preload.current = pending;
    // A preload error is retried and reported when the manager opens.
    void pending.catch(() => undefined).finally(() => {
      if (preload.current === pending) preload.current = null;
    });
    const timeout = setTimeout(() => abort.abort(), 15000);
    return () => { clearTimeout(timeout); abort.abort(); };
  }, [load]);

  return <ServerCacheContext.Provider value={{ read, load }}>{children}</ServerCacheContext.Provider>;
}

export const useServerCache = () => useContext(ServerCacheContext);
