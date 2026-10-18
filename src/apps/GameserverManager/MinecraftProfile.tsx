import { useEffect, useState } from 'react';
import { WhitelistIcon } from './WhitelistIcon';

interface Profile { id: string; name: string; skin: string | null }

export function MinecraftProfile({ uuid, username }: { uuid: string; username: string }) {
  const id = uuid.replace(/-/g, '').toLowerCase();
  const [result, setResult] = useState<{ id: string; profile?: Profile; failed?: boolean } | null>(null);
  const [brokenSkin, setBrokenSkin] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    async function load() {
      try {
        if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid UUID');
        const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, {
          signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('Profile unavailable');
        const data = await response.json();
        if (data.id?.toLowerCase() !== id || typeof data.name !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(data.name)) throw new Error('Invalid profile');
        let skin: string | null = null;
        const property = Array.isArray(data.properties) && data.properties.find((entry: { name?: string }) => entry?.name === 'textures');
        if (property && typeof property.value === 'string') {
          const textures = JSON.parse(atob(property.value));
          const raw = textures?.textures?.SKIN?.url;
          if (typeof raw === 'string') {
            const url = new URL(raw);
            if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'textures.minecraft.net' || url.port || url.username || url.password || !/^\/texture\/[a-f0-9]+$/i.test(url.pathname)) throw new Error('Invalid texture');
            url.protocol = 'https:';
            skin = url.href;
          }
        }
        if (active) setResult({ id, profile: { id: data.id, name: data.name, skin } });
      } catch {
        if (active) setResult({ id, failed: true });
      } finally { clearTimeout(timer); }
    }
    let active = true;
    void load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id]);
  const current = result?.id === id ? result : null;
  const profile = current?.profile;
  const skin = profile?.skin;
  const displayName = profile?.name || username;
  return <div className="mc98-mojang-profile">
    {skin && brokenSkin !== skin ? <a className="mc98-skin" href={skin} target="_blank" rel="noreferrer" aria-label={`Skin von ${displayName} öffnen`}>
      <img src={skin} alt={`Minecraft-Skin von ${displayName}`} referrerPolicy="no-referrer" onError={() => setBrokenSkin(skin)} />
      <img className="mc98-skin-hat" src={skin} alt="" referrerPolicy="no-referrer" />
    </a> : <div className="mc98-skin-placeholder" aria-hidden="true"><WhitelistIcon kind="profile" /></div>}
    <div><strong>Verknüpftes Profil: {displayName}</strong><span>UUID: <span>{uuid}</span></span>
      <small role="status">{!current ? 'Mojang-Profil wird geladen …' : current.failed ? 'Mojang-Profil derzeit nicht verfügbar. Gespeicherte Profildaten werden angezeigt.' : skin ? brokenSkin === skin ? 'Skin konnte nicht geladen werden.' : 'Aktuelles Mojang-Profil · Skin zum Öffnen anklicken' : 'Für dieses Profil ist kein eigener Skin hinterlegt.'}</small>
    </div>
  </div>;
}
