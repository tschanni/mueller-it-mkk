import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MinecraftAccess } from './MinecraftAccess';
import { useLiveWhitelist } from './useLiveWhitelist';

const uuid = '12345678-1234-1234-1234-123456789abc';
const linked = { uuid, username: 'Self', stale: false, whitelistState: 'WHITELISTED', lastSyncedAt: null };
const base = { enabled: true, discord: { linked: true, membership: 'MEMBER' }, minecraft: linked };
const player = { uuid, username: 'Self', isCurrentUser: true };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });
let state: string;
let players: typeof player[];
let fetcher: jest.Mock;
beforeEach(() => {
  state = 'WHITELISTED'; players = [player, { uuid: 'a'.repeat(32), username: 'Manual_Player', isCurrentUser: false }];
  fetcher = jest.fn(async (url: string) => response(url.endsWith('/whitelist-status') ? { linked: true, uuid, whitelistState: state } : url.endsWith('/whitelist') ? { source: 'LIVE_SERVER', players } : base));
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetcher });
});
function Probe({ id = uuid }: { id?: string }) {
  const live = useLiveWhitelist('https://api.example/minecraft', true, id);
  return <><output>{live.state}</output><p>{live.error}</p>{live.players?.map(p => <span key={p.uuid}>{p.username}</span>)}<button onClick={live.refresh}>Refresh</button></>;
}
test('confirmed whitelist includes manual accounts, own marker, count and manual refresh', async () => {
  render(<MinecraftAccess apiBase="https://api.example" liveWhitelist />);
  await screen.findByText('Manual_Player');
  expect(screen.getByRole('img', { name: 'Minecraft-Skin von Manual_Player' })).toHaveAttribute('src', 'https://api.example/api/v1/public/minecraft/avatars/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  expect(screen.getByText('Du')).toBeInTheDocument();
  expect(screen.getByText(/2 Spieler/)).toBeInTheDocument();
  expect(screen.getByText('Du bist bereit zum Spielen!')).toBeInTheDocument();
  expect(screen.queryByText('Zugang freischalten')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Status aktualisieren'));
  await screen.findByText('Manual_Player');
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/whitelist'), expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
});
test.each(['NOT_WHITELISTED', 'UNKNOWN'])('%s never loads the private list', async value => {
  state = value; render(<Probe />);
  await screen.findByText(value);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith('/whitelist'))).toBe(false);
});
test('unlinked account does not request the private list', async () => {
  fetcher.mockResolvedValue(response({ linked: false, uuid: null, whitelistState: 'NOT_WHITELISTED' }));
  render(<Probe />); await screen.findByText('NOT_WHITELISTED');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test('empty whitelist is rendered', async () => {
  players = []; render(<MinecraftAccess apiBase="https://api.example" liveWhitelist />);
  await screen.findByText(/keine Spieler/);
});
test.each([401, 403, 429, 503, 500])('list HTTP %s removes private data and supports retry without error code', async code => {
  render(<Probe />); await screen.findByText('Manual_Player');
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((url: string) => url.endsWith('/whitelist') ? Promise.resolve(response({}, code)) : original(url));
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(screen.queryByText('Manual_Player')).not.toBeInTheDocument());
  await screen.findByText(code === 401 ? /Bitte melde dich/ : code === 429 ? /Zu viele Anfragen/ : code === 403 ? /Zugangsberechtigung/ : /nicht erreichbar/);
});
test('network and RCON failure never claim success', async () => {
  fetcher.mockRejectedValue(new Error('offline')); render(<Probe />);
  await screen.findByText(/nicht erreichbar/); expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
});
test('403 link change rechecks own state and clears the confirmed whitelist', async () => {
  let reads = 0;
  fetcher.mockImplementation(async (url: string) => {
    if (url.endsWith('/whitelist-status')) return response({ linked: true, uuid, whitelistState: ++reads === 1 ? 'WHITELISTED' : 'NOT_WHITELISTED' });
    return response({ code: 'MINECRAFT_LINK_CHANGED' }, 403);
  });
  render(<Probe />);
  await screen.findByText('NOT_WHITELISTED');
  expect(reads).toBe(2);
  expect(screen.queryByText('Manual_Player')).not.toBeInTheDocument();
});
test('logout aborts a pending request and late responses cannot load private data', async () => {
  let resolve!: (value: unknown) => void;
  fetcher.mockReturnValue(new Promise(r => { resolve = r; }));
  const { unmount } = render(<Probe />);
  const signal = fetcher.mock.calls[0][1].signal;
  unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve(response({ linked: true, uuid, whitelistState: 'WHITELISTED' })));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test('link change immediately clears previous players and discards delayed responses', async () => {
  const { rerender } = render(<Probe />); await screen.findByText('Manual_Player');
  fetcher.mockReturnValue(new Promise(() => {}));
  rerender(<Probe id={'b'.repeat(32)} />);
  expect(screen.queryByText('Manual_Player')).not.toBeInTheDocument();
});
test('successful grant refreshes authoritative status and replaces enrollment', async () => {
  state = 'NOT_WHITELISTED';
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (options?.method === 'POST') { state = 'WHITELISTED'; return Promise.resolve(response(base)); }
    return original(url);
  });
  render(<MinecraftAccess apiBase="https://api.example" liveWhitelist />);
  await waitFor(() => expect(screen.getByText('Zur Whitelist hinzufügen')).toBeEnabled());
  fireEvent.click(screen.getByText('Zur Whitelist hinzufügen')); await screen.findByText('Manual_Player');
  expect(screen.queryByText('Zugang freischalten')).not.toBeInTheDocument();
});
