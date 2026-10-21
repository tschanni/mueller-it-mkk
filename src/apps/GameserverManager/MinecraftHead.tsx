import { useState } from 'react';
import { WhitelistIcon } from './WhitelistIcon';

// Transitional public renderer. Replace this resolver only after a backend
// avatar contract has been implemented and tested. Never accept API avatarUrl.
export function minecraftHeadUrl(uuid: string): string | null {
  const id = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const dashed = id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  return `https://mc-api.io/render/FACE/${dashed}?size=64`;
}

export function MinecraftHead({ uuid, username }: { uuid: string; username: string }) {
  const url = minecraftHeadUrl(uuid);
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url
    ? <span className="mc98-skin mc98-skin-render"><img src={url} alt={`Minecraft-Skin von ${username}`} referrerPolicy="no-referrer" onError={() => setFailed(url)} /></span>
    : <span className="mc98-skin-placeholder" role="img" aria-label={`Minecraft-Skin von ${username} nicht verfügbar`}><WhitelistIcon kind="profile" /></span>;
}
