import { MinecraftHead } from './MinecraftHead';

export function MinecraftProfile({ uuid, username, apiBase }: { uuid: string; username: string; apiBase?: string }) {
  return <div className="mc98-mojang-profile">
    <MinecraftHead uuid={uuid} username={username} apiBase={apiBase} />
    <div><strong>Verknüpftes Profil: {username}</strong><span>UUID: <span>{uuid}</span></span></div>
  </div>;
}
