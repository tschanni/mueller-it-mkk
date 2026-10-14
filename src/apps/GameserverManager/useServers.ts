import { useEffect, useState } from 'react';
import { API, GameServer, parseServers, request } from './api';
import { useServerCache } from './ServerCache';
export function useServers() {
    const cache = useServerCache();
    const cached = cache?.read();
    const loadCached = cache?.load;
    const [servers, setServers] = useState<GameServer[]>(() => cached?.servers.map(s => ({ ...s, stale: true })) || []);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(!cached);
    const [connection, setConnection] = useState(cached ? 'Zwischengespeicherte Daten – Aktualisierung läuft' : 'Verbindung wird hergestellt');
    const [updated, setUpdated] = useState<Date | null>(cached?.updated || null);
    const [revision, setRevision] = useState(0);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let closed = false, pending = false, again = false, live = false, lastHeartbeat = 0;
        const abort = new AbortController();
        let debounce: ReturnType<typeof setTimeout> | undefined;
        const refresh = async (reusePreload = false) => {
            if (pending) {
                again = true;
                return;
            }
            pending = true;
            try {
                do {
                    again = false;
                    let result;
                    try {
                        result = loadCached ? await loadCached(abort.signal, reusePreload) : { servers: parseServers(await request<unknown>('servers', abort.signal)), updated: new Date() };
                    } catch (e) {
                        if (!loadCached || !reusePreload || abort.signal.aborted) throw e;
                        result = loadCached ? await loadCached(abort.signal) : { servers: parseServers(await request<unknown>('servers', abort.signal)), updated: new Date() };
                    }
                    reusePreload = false;
                    if (!closed) {
                        setServers(result.servers);
                        setError('');
                        setUpdated(result.updated);
                        setRevision(n => n + 1);
                        setConnection(live ? 'Live-Verbindung hergestellt' : 'Abfragebetrieb (30 Sekunden)');
                    }
                } while (again && !closed);
            }
            catch (e) {
                if (!closed) {
                    setError(e instanceof Error ? e.message : 'API nicht erreichbar.');
                    setConnection('Verbindung unterbrochen – Daten möglicherweise veraltet');
                }
            }
            finally {
                pending = false;
                if (!closed)
                    setLoading(false);
            }
        };
        const schedule = () => { if (!debounce)
            debounce = setTimeout(() => { debounce = undefined; void refresh(); }, 500); };
        let stream: EventSource | undefined;
        if (typeof EventSource !== 'undefined') {
            stream = new EventSource(API + 'stream');
            stream.addEventListener('connected', () => { live = true; lastHeartbeat = Date.now(); setConnection('Synchronisierung läuft'); void refresh(); });
            stream.addEventListener('keepalive', () => { live = true; lastHeartbeat = Date.now(); });
            for (const type of ['status.changed', 'players.changed', 'player.joined', 'player.left', 'server.error'])
                stream.addEventListener(type, schedule);
            stream.onerror = () => { live = false; setConnection('Live-Verbindung unterbrochen – Abfragebetrieb'); };
        }
        void refresh(true);
        const timer = setInterval(() => { if (live && Date.now() - lastHeartbeat > 45000) {
            live = false;
            setConnection('Live-Verbindung unterbrochen – Abfragebetrieb');
        } void refresh(); }, 30000);
        return () => { closed = true; abort.abort(); stream?.close(); clearInterval(timer); if (debounce)
            clearTimeout(debounce); };
    }, [retry, loadCached]);
    return { servers, error, loading, connection, updated, revision, refresh: () => setRetry(n => n + 1) };
}
