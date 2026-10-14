export type ServerState = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'STARTING' | 'UNKNOWN';
export interface GameServer {
    id: string;
    slug: string;
    name: string;
    gameType: string;
    status: ServerState;
    desiredState: ServerState;
    statusMessage: string;
    onlinePlayers: number | null;
    maxPlayers: number | null;
    gameVersion: string | null;
    latencyMs: number | null;
    motd: string | null;
    lastCheckedAt: string | null;
    lastSuccessfulCheckAt: string | null;
    lastError: {
        code: string;
        message: string;
    } | null;
    connection: {
        host: string;
        port: number;
    };
    capability: string;
    stale: boolean;
}
export interface Players {
    players: string[];
    available: boolean;
    lastHeartbeatAt: string | null;
    message: string;
}
export interface PublicEvent {
    id: string;
    eventId: string;
    type: string;
    occurredAt: string;
    playerName: string | null;
    message: string;
}
export interface EventPage {
    items: PublicEvent[];
    total: number;
    page: number;
    limit: number;
}
export interface Snapshot {
    status: ServerState;
    onlinePlayers: number | null;
    maxPlayers: number | null;
    latencyMs: number | null;
    recordedAt: string;
}
export interface Metric {
    cpuPercent: number | null;
    memoryUsedBytes: number | null;
    memoryLimitBytes: number | null;
    diskUsedBytes: number | null;
    recordedAt: string;
}
export interface Metrics {
    snapshots: Snapshot[];
    metrics: Metric[];
    limit: number;
    message: string;
}
const origin = process.env.REACT_APP_GAME_API_BASE_URL || 'https://api.mueller-it-mkk.de';
export const API = new URL('/games/api/v1/public/', origin).href;
if (new URL(API).protocol !== 'https:')
    throw new Error('Die Gameserver-API benötigt HTTPS.');
export async function request<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(API + path, { signal, credentials: 'omit' });
    if (!response.ok)
        throw new Error('API-Anfrage fehlgeschlagen (HTTP ' + response.status + ').');
    return response.json();
}
export function parseServers(value: unknown): GameServer[] {
    if (!Array.isArray(value) || value.some(s => !s || typeof s.id !== 'string' || typeof s.slug !== 'string' || typeof s.name !== 'string' || !s.connection || typeof s.connection.host !== 'string' || typeof s.connection.port !== 'number'))
        throw new Error('Ungültige Serverantwort.');
    return value.map(s => ({ ...s, status: ['ONLINE', 'OFFLINE', 'ERROR', 'STARTING', 'UNKNOWN'].includes(s.status) ? s.status : 'UNKNOWN', stale: s.stale !== false }));
}
export const statusText = (status: string) => ({ ONLINE: 'Online', OFFLINE: 'Offline', UNKNOWN: 'Unbekannt', ERROR: 'Fehler', STARTING: 'Startet' }[status] || 'Unbekannt');
