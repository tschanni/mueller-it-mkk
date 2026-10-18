import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { MinecraftProfile } from './MinecraftProfile';
import { minecraftApiBase } from './minecraftApiBase';
import './minecraft-access.css';

interface LinkedProfile { username: string; uuid: string }

export function MinecraftOverviewAccess({ onOpen }: { onOpen: () => void }) {
  const { session } = useAuth();
  const userId = session?.user.emailVerified ? session.user.id : null;
  const [result, setResult] = useState<{ userId: string; profile: LinkedProfile | null; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const base = minecraftApiBase();
    if (!base) { setResult({ userId, profile: null, failed: true }); return; }
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 10000);
    void fetch(`${base}/api/v1/me/minecraft`, { credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Status unavailable');
        const data = await response.json();
        if (!data || !Object.prototype.hasOwnProperty.call(data, 'minecraft')) throw new Error('Invalid status');
        const profile = data.minecraft;
        if (profile !== null && (typeof profile?.username !== 'string' || typeof profile?.uuid !== 'string')) throw new Error('Invalid profile');
        if (active) setResult({ userId, profile });
      })
      .catch(() => { if (active) setResult({ userId, profile: null, failed: true }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [userId]);
  const current = userId && result?.userId === userId ? result : null;
  const profile = current?.profile;
  return <div className="gsm-whitelist-entry" onDoubleClick={e => e.stopPropagation()}>
    {profile ? <div className="mc98 gsm-overview-profile"><MinecraftProfile key={profile.uuid} uuid={profile.uuid} username={profile.username} /></div>
      : <div>{userId && !current ? <span role="status">Verknüpftes Profil wird geladen …</span> : current?.failed ? <span role="status">Dein Profil konnte nicht geladen werden. Öffne die Whitelist, um den Status zu prüfen.</span> : <><strong>Du willst Teil der Müller IT MKK Minecraft Welt werden?</strong><span>Verknüpfe jetzt dein Profil und schalte deinen Zugang frei.</span></>}</div>}
    <button onClick={e => { e.stopPropagation(); onOpen(); }}>{profile ? 'Whitelist verwalten' : 'Whitelist öffnen'}</button>
  </div>;
}
