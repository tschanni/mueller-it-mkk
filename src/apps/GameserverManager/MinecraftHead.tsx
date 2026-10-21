import { useState } from 'react';
import { WhitelistIcon } from './WhitelistIcon';
import { minecraftApiBase } from './minecraftApiBase';

// Construct the documented public route, never trust an API-supplied avatarUrl.
export function minecraftHeadUrl(uuid: string, apiBase = minecraftApiBase()): string | null {
  if (!apiBase || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(uuid)) return null;
  const id = uuid.replace(/-/g, '').toLowerCase();
  const dashed = id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  try {
    const base = new URL(apiBase);
    const local = process.env.NODE_ENV === 'development' && base.hostname === 'localhost';
    if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))) return null;
    const path = `${base.pathname.replace(/\/$/, '')}/api/v1/public/minecraft/avatars/${dashed}`;
    const avatar = new URL(base.origin);
    avatar.pathname = path;
    return avatar.href;
  } catch { return null; }
}

export function MinecraftHead({ uuid, username, apiBase }: { uuid: string; username: string; apiBase?: string }) {
  const url = minecraftHeadUrl(uuid, apiBase);
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url
    ? <span className="mc98-skin mc98-skin-render"><img src={url} alt={`Minecraft-Skin von ${username}`} referrerPolicy="no-referrer" onError={() => setFailed(url)} /></span>
    : <span className="mc98-skin-placeholder" role="img" aria-label={`Minecraft-Skin von ${username} nicht verfügbar`}><WhitelistIcon kind="profile" /></span>;
}
