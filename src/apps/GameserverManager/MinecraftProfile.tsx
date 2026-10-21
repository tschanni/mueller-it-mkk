import { MinecraftHead } from './MinecraftHead';

export function MinecraftProfile({ uuid, username }: { uuid: string; username: string }) {
  return <div className="mc98-mojang-profile">
    <MinecraftHead uuid={uuid} username={username} />
    <div><strong>Verknüpftes Profil: {username}</strong><span>UUID: <span>{uuid}</span></span></div>
  </div>;
}
