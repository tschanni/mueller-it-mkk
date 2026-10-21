import { MinecraftHead } from './MinecraftHead';
import { WhitelistPlayer } from './useLiveWhitelist';

export function MinecraftWhitelist({ players }: { players: WhitelistPlayer[] | null }) {
  return <section className="mc98-step" aria-label="Minecraft-Whitelist">
    <h3>Minecraft-Whitelist {players && `(${players.length} Spieler)`}</h3>
    {!players ? <p role="status">Whitelist wird geladen oder ist derzeit nicht verfügbar.</p> : players.length === 0 ? <p>Die Whitelist enthält derzeit keine Spieler.</p> :
      <ul className="mc98-whitelist">{players.map(player => <li key={player.uuid}><MinecraftHead uuid={player.uuid} username={player.username} /><strong>{player.username}</strong>{player.isCurrentUser && <span className="mc98-badge mc98-tone-success">Du</span>}</li>)}</ul>}
  </section>;
}
