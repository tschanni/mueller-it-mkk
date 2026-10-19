import { useEffect, useState } from 'react';
import { WhitelistIcon } from './WhitelistIcon';

interface Profile { id: string; name: string }

export function MinecraftProfile({ uuid, username }: { uuid: string; username: string }) {
  const id = uuid.replace(/-/g, '').toLowerCase();
  const validId = /^[a-f0-9]{32}$/.test(id);
  const dashedId = id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const renderUrl = validId ? `https://mc-api.io/render/FACE/${dashedId}?size=64` : null;
  const apiKey = process.env.REACT_APP_MC_API_KEY?.trim();
  const [render, setRender] = useState<{ source: string; url: string } | null>(null);
  const [result, setResult] = useState<{ id: string; profile?: Profile; failed?: boolean } | null>(null);
  const [brokenSkin, setBrokenSkin] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    async function load() {
      try {
        if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid UUID');
        const response = await fetch(`https://mc-api.io/profile/${id}`, {
          signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
          ...(apiKey ? { headers: { 'X-API-Key': apiKey } } : {}),
        });
        if (!response.ok) throw new Error('Profile unavailable');
        const data = await response.json();
        if (typeof data.uuid !== 'string' || data.uuid.replace(/-/g, '').toLowerCase() !== id || typeof data.name !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(data.name)) throw new Error('Invalid profile');
        if (active) setResult({ id, profile: { id: data.uuid, name: data.name } });
      } catch {
        if (active) setResult({ id, failed: true });
      } finally { clearTimeout(timer); }
    }
    let active = true;
    void load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id, apiKey]);
  useEffect(() => {
    if (!apiKey || !renderUrl) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    let objectUrl: string | undefined;
    void fetch(renderUrl, {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'X-API-Key': apiKey },
    }).then(async response => {
      if (!response.ok) throw new Error('Render unavailable');
      const blob = await response.blob();
      if (blob.type !== 'image/png') throw new Error('Invalid render');
      if (active) {
        objectUrl = URL.createObjectURL(blob);
        setRender({ source: renderUrl, url: objectUrl });
      }
    }).catch(() => { if (active) setBrokenSkin(renderUrl); })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiKey, renderUrl]);
  const current = result?.id === id ? result : null;
  const profile = current?.profile;
  const skin = apiKey ? render?.source === renderUrl ? render.url : null : renderUrl;
  const displayName = profile?.name || username;
  return <div className="mc98-mojang-profile">
    {skin && brokenSkin !== skin ? <a className="mc98-skin mc98-skin-render" href={`https://mc-api.io/render/FULL/${dashedId}?size=512`} target="_blank" rel="noreferrer" aria-label={`Skin von ${displayName} öffnen`}>
      <img src={skin} alt={`Minecraft-Skin von ${displayName}`} referrerPolicy="no-referrer" onError={() => setBrokenSkin(skin)} />
    </a> : <div className="mc98-skin-placeholder" aria-hidden="true"><WhitelistIcon kind="profile" /></div>}
    <div><strong>Verknüpftes Profil: {displayName}</strong><span>UUID: <span>{uuid}</span></span>
      <small role="status">{!current ? 'Minecraft-Profil wird geladen …' : current.failed ? 'Minecraft-Profil derzeit nicht verfügbar. Gespeicherte Profildaten werden angezeigt.' : brokenSkin && (brokenSkin === renderUrl || brokenSkin === skin) ? 'Skin konnte nicht geladen werden.' : skin ? 'Skin zum Öffnen anklicken' : 'Skin wird geladen …'}</small>
    </div>
  </div>;
}
