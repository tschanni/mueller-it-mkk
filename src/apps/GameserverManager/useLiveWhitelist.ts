import { useCallback, useEffect, useRef, useState } from 'react';
import { WhitelistState } from './whitelistStatus';

export interface WhitelistPlayer { uuid: string; username: string; isCurrentUser: boolean }
export interface LiveWhitelist { uuid: string | null; state: WhitelistState; players: WhitelistPlayer[] | null; error: string | null; loading: boolean }
const initial: LiveWhitelist = { uuid: null, state: 'UNKNOWN', players: null, error: null, loading: true };
class ReadError extends Error {
  constructor(public status: number, public code?: string) { super(); }
}
export function useLiveWhitelist(endpoint: string, enabled: boolean, uuid?: string) {
  const [value, setValue] = useState<LiveWhitelist>(initial);
  const [revision, setRevision] = useState(0);
  const scope = `${endpoint}|${uuid ?? ''}|${revision}`;
  const [resolvedScope, setResolvedScope] = useState('');
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  const generation = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const current = ++generation.current;
    const timer = setTimeout(() => controller.abort(), 15000);
    const active = () => current === generation.current;
    setValue(initial);
    async function read(path: string) {
      const response = await fetch(endpoint + path, { credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted || !active()) throw new Error('Aborted');
      if (!response.ok) throw new ReadError(response.status, data?.code);
      if (!data || typeof data !== 'object') throw new Error('Invalid response');
      return data;
    }
    async function load() {
      let confirmed: LiveWhitelist = { ...initial, loading: false };
      try {
        const status = await read('/whitelist-status');
        if (typeof status.linked !== 'boolean' || !['WHITELISTED', 'NOT_WHITELISTED', 'UNKNOWN'].includes(status.whitelistState) || (status.linked && typeof status.uuid !== 'string')) throw new Error('Invalid status');
        confirmed = { ...confirmed, uuid: status.linked ? status.uuid : null, state: status.linked ? status.whitelistState : 'NOT_WHITELISTED' };
        if (confirmed.state === 'WHITELISTED') {
          const list = await read('/whitelist');
          if (list.source !== 'LIVE_SERVER' || !Array.isArray(list.players) || !list.players.every((p: WhitelistPlayer) => typeof p.uuid === 'string' && typeof p.username === 'string' && typeof p.isCurrentUser === 'boolean')) throw new Error('Invalid whitelist');
          confirmed.players = list.players;
        }
        if (active()) { setResolvedScope(scope); setValue(confirmed); }
      } catch (error) {
        if (!active()) return;
        // Authorization failures invalidate all private data, including success.
        const denied = error instanceof ReadError && (error.status === 401 || error.status === 403);
        if (error instanceof ReadError && error.status === 403) {
          // Recheck a changed link, but never fetch the private list again here.
          try {
            const fresh = await read('/whitelist-status');
            if (fresh.whitelistState === 'NOT_WHITELISTED') confirmed = { ...initial, uuid: fresh.uuid, state: 'NOT_WHITELISTED' };
          } catch { /* explicit retry remains available */ }
        }
        if (active()) { setResolvedScope(scope); setValue({ ...(denied && confirmed.state !== 'NOT_WHITELISTED' ? initial : confirmed), players: null, loading: false, error:
          error instanceof ReadError && error.status === 401 ? 'Bitte melde dich erneut an oder bestätige deine E-Mail-Adresse.' :
          error instanceof ReadError && error.status === 429 ? 'Zu viele Anfragen. Bitte warte eine Minute.' :
          denied ? 'Deine Zugangsberechtigung oder Minecraft-Verknüpfung hat sich geändert. Bitte prüfe den Status erneut.' :
          'Der Minecraft-Server oder die Whitelist ist derzeit nicht erreichbar.' }); }
      } finally { clearTimeout(timer); }
    }
    void load();
    return () => { generation.current = current + 1; controller.abort(); clearTimeout(timer); };
  }, [endpoint, enabled, uuid, revision, scope]);
  // UUID changes must hide old private data even before the effect runs.
  const matches = resolvedScope === scope;
  return { ...(enabled && matches ? value : initial), refresh };
}
