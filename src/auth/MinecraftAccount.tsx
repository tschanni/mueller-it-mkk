import { useEffect, useState } from 'react';
import { minecraftApiBase } from '../apps/GameserverManager/minecraftApiBase';
import { useAuth } from './AuthContext';

interface Link { username: string; uuid: string; whitelistState?: string; stale?: boolean }
export function MinecraftAccount() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [result, setResult] = useState<{ link: Link | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const timer = setTimeout(() => abort.abort(), 10000);
    setResult(null); setFailed(false);
    const base = minecraftApiBase();
    void (async () => {
      if (!base) throw new Error();
      const response = await fetch(`${base}/api/v1/me/minecraft`, { credentials: 'include', cache: 'no-store', redirect: 'error', signal: abort.signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data || !('minecraft' in data) || (data.minecraft !== null && (typeof data.minecraft?.username !== 'string' || typeof data.minecraft?.uuid !== 'string'))) throw new Error();
      if (active) setResult({ link: data.minecraft });
    })().catch(() => { if (active) setFailed(true); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); abort.abort(); };
  }, [userId, revision]);
  const link = result?.link;
  return <fieldset><legend>Minecraft-Kontoverknüpfung</legend>
    {failed ? <p role="status">Die Verknüpfung konnte nicht geprüft werden. <button onClick={() => setRevision(value => value + 1)}>Erneut prüfen</button></p>
      : !result ? <p role="status">Minecraft-Verknüpfung wird geladen …</p>
      : !link ? <p>Kein Minecraft-Konto verknüpft. Die Verknüpfung können Sie im Gameserver-Manager verwalten.</p>
      : <dl className="auth-account-fields"><dt>Status</dt><dd>Verknüpft</dd><dt>Spielername</dt><dd>{link.username}</dd><dt>UUID</dt><dd>{link.uuid}</dd><dt>Whitelist</dt><dd>{link.stale ? 'Derzeit unbekannt' : link.whitelistState === 'WHITELISTED' ? 'Freigeschaltet' : link.whitelistState === 'NOT_WHITELISTED' ? 'Nicht freigeschaltet' : 'Derzeit unbekannt'}</dd></dl>}
    <p>Für die Livekarte genügt die Anmeldung auf dieser Webseite.</p>
  </fieldset>;
}
