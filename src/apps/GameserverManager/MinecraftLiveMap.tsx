import { useAuth } from '../../auth/AuthContext';
import { minecraftApiBase } from './minecraftApiBase';

/** The configured URL must be served by a session-protected API proxy. */
export function MinecraftLiveMap() {
  const { session, status } = useAuth();
  if (!session) return <p role="status">{status === 'loading' ? 'Sitzung wird geprüft …' : status === 'unavailable' ? 'Die Anmeldung konnte derzeit nicht geprüft werden. Bitte versuchen Sie es später erneut.' : 'Bitte melden Sie sich auf dieser Webseite an, um die Minecraft-Livekarte zu öffnen.'}</p>;
  let map: string | null = null;
  try {
    const base = minecraftApiBase();
    const url = new URL(process.env.REACT_APP_MINECRAFT_MAP_URL || '');
    if (base && url.origin === new URL(base).origin && url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search) map = url.href;
  } catch { /* No deployed map endpoint configured. */ }
  return map ? <iframe key={session.user.id} className="gsm-live-map" src={map} title="Minecraft-Livekarte" referrerPolicy="no-referrer" />
    : <p role="status">Die Minecraft-Livekarte ist noch nicht eingerichtet.</p>;
}
