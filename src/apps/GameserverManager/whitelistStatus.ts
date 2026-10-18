// Verified against Gameserver_Dashboard/docs/MINECRAFT_RCON_SYNC_FIX.md
// and src/minecraft/minecraft.service.ts (2026-10-18).
export type WhitelistState = 'WHITELISTED' | 'NOT_WHITELISTED' | 'UNKNOWN';
export interface WhitelistOperation {
  action: 'ADD' | 'REMOVE';
  outcome: 'SUCCEEDED' | 'ALREADY_IN_STATE' | 'NOT_REQUIRED' | 'NOT_ATTEMPTED';
  whitelistState: WhitelistState;
  syncErrorCode: string | null;
}
export interface LastCommand {
  action: 'ADD' | 'REMOVE';
  outcome: 'SUCCEEDED' | 'ALREADY_IN_STATE' | 'FAILED' | 'UNKNOWN';
  at: string | null;
}
export const unknownWhitelist = 'Der aktuelle Whitelist-Status konnte nicht überprüft werden.';

export function commandMessage(command: Pick<LastCommand, 'outcome'> | WhitelistOperation | null | undefined, state: WhitelistState): string | null {
  switch (command?.outcome) {
    case 'SUCCEEDED':
    case 'ALREADY_IN_STATE':
      return state === 'UNKNOWN'
        ? 'Deine Anfrage wurde vom Minecraft-Server bestätigt. Der aktuelle Whitelist-Status konnte noch nicht überprüft werden.'
        : 'Deine Anfrage wurde vom Minecraft-Server bestätigt.';
    case 'FAILED': return 'Der Minecraft-Server hat die Änderung abgelehnt. Prüfe den Status, bevor du es erneut versuchst.';
    case 'UNKNOWN': return 'Die Ausführung deiner Anfrage konnte nicht bestätigt werden. Bitte prüfe zuerst den Status.';
    case 'NOT_ATTEMPTED': return 'Es wurde kein Schreibbefehl gesendet, weil der Status nicht geprüft werden konnte. Bitte prüfe den Status erneut.';
    case 'NOT_REQUIRED': return 'Für diese Anfrage war kein Schreibbefehl erforderlich.';
    default: return null;
  }
}
