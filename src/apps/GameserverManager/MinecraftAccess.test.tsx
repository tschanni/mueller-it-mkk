import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MinecraftAccess } from './MinecraftAccess';
import { MinecraftAccessPanel } from './MinecraftAccessPanel';
import { WhitelistOperation, unknownWhitelist } from './whitelistStatus';

const mockOpenWindow = jest.fn();
let mockSession: { user: { id: string; emailVerified: boolean } } | null = { user: { id: 'one', emailVerified: true } };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ session: mockSession, status: 'authenticated', configured: true, busy: false }) }));
jest.mock('../../auth/useAuthWindow', () => ({ useAuthWindow: () => mockOpenWindow }));
const base = { enabled: true, discord: { linked: false, membership: 'UNKNOWN' }, minecraft: null };
const linked = { username: 'Player_123', uuid: '12345678-1234-1234-1234-123456789abc', status: 'PENDING', whitelistState: 'UNKNOWN', syncErrorCode: null as string | null, lastCommand: null as import('./whitelistStatus').LastCommand | null, linkedAt: '2026-10-18T10:00:00Z', lastSyncedAt: null, lastErrorCode: null, removing: false, ownershipVerified: false, stale: true };
let current: { enabled: boolean; discord: { linked: boolean; membership: string }; minecraft: typeof linked | null };
let fetchMock: jest.Mock;
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
beforeEach(() => {
  current = { ...base }; mockSession = { user: { id: 'one', emailVerified: true } }; mockOpenWindow.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open'); } });
  fetchMock = jest.fn(async () => response(current));
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
});

test('anonymous users open the existing login without private API calls', () => {
  mockSession = null; render(<MinecraftAccessPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
  expect(mockOpenWindow).toHaveBeenCalledWith('auth-login'); expect(fetchMock).not.toHaveBeenCalled();
});
test('unverified users are directed to existing account settings', () => {
  mockSession = { user: { id: 'one', emailVerified: false } }; render(<MinecraftAccessPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Mein Konto' }));
  expect(mockOpenWindow).toHaveBeenCalledWith('auth-account'); expect(fetchMock).not.toHaveBeenCalled();
});
test('missing Discord produces the required modal and uses existing account linking', async () => {
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? response({ code: 'DISCORD_NOT_LINKED', message: 'Bitte verknüpfe zuerst Discord.' }, 403) : response(current));
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Nicht verknüpft/);
  fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  const dialog = await screen.findByRole('dialog', { name: 'Discord-Verknüpfung erforderlich' });
  expect(dialog).toHaveTextContent('Du hast noch keinen Discord-Account mit deinem Konto verknüpft.');
  fireEvent.click(screen.getByRole('button', { name: 'Discord verknüpfen' }));
  expect(mockOpenWindow).toHaveBeenCalledWith('auth-account');
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/games/api/v1/me/minecraft/whitelist'), expect.objectContaining({ credentials: 'include', method: 'POST' }));
});
test('can cancel the Discord modal', async () => {
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? response({ code: 'DISCORD_NOT_LINKED', message: 'Discord fehlt.' }, 403) : response(current));
  render(<MinecraftAccess apiBase="https://api.example/games" />);
  await screen.findByText(/Discord: Nicht verknüpft/); fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  await screen.findByRole('dialog'); fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test.each(['Du musst Mitglied auf unserem Discord-Server Lahadde sein.', 'Dieser Minecraft-Java-Account existiert nicht.', 'Dieser Minecraft-Account ist bereits einem Dashboard-Konto zugeordnet.', 'Der Minecraft-Server ist gerade nicht erreichbar.', 'Die Whitelist-Aktion ist fehlgeschlagen.'])('shows the server error: %s', async message => {
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? response({ code: 'TEST_FAILURE', message }, 503) : response(current));
  render(<MinecraftAccess apiBase="https://api.example/games" />);
  await screen.findByText(/Discord: Nicht verknüpft/); fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
});
test('links a profile, grants access and removes the mapping', async () => {
  current.discord = { linked: true, membership: 'UNKNOWN' };
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      if (url.endsWith('/link')) current = { ...current, minecraft: { ...linked } };
      if (url.endsWith('/whitelist')) current = { ...current, minecraft: { ...linked, status: 'WHITELISTED', whitelistState: 'WHITELISTED', stale: false } };
      if (url.endsWith('/unlink')) current = { ...current, minecraft: null };
    }
    return response(current);
  });
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Verknüpft/);
  expect(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Minecraft-Java-Benutzername'), { target: { value: 'Player_123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Minecraft-Account verknüpfen' }));
  await screen.findByText(linked.uuid);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  await screen.findByText(/Whitelist: Freigeschaltet/);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Minecraft-Verknüpfung entfernen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Minecraft-Verknüpfung entfernen' }));
  await waitFor(() => expect(screen.queryByText(linked.uuid)).not.toBeInTheDocument());
  expect(screen.getByText('Die öffentliche Namensauflösung bestätigt keinen Accountbesitz.')).toBeInTheDocument();
});
test('disables writes when the backend feature is not configured', async () => {
  current.enabled = false; render(<MinecraftAccessPanel />);
  await screen.findByText('Der Minecraft-Zugang ist noch nicht eingerichtet.');
  expect(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' })).toBeDisabled();
});
test('invalid input never enables linking', async () => {
  render(<MinecraftAccessPanel />); await screen.findByText(/Discord: Nicht verknüpft/);
  fireEvent.change(screen.getByLabelText('Minecraft-Java-Benutzername'), { target: { value: 'a;stop' } });
  expect(screen.getByRole('button', { name: 'Minecraft-Account verknüpfen' })).toBeDisabled();
});

test('does not present stale whitelist data as ready to play', async () => {
  current.minecraft = { ...linked, status: 'WHITELISTED', whitelistState: 'WHITELISTED', stale: true };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Whitelist-Status unbekannt');
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
});

test('shows confirmed whitelist access as ready to play', async () => {
  current.minecraft = { ...linked, status: 'WHITELISTED', whitelistState: 'WHITELISTED', stale: false };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Du bist bereit zum Spielen!');
  expect(screen.getByText('Whitelist: Freigeschaltet')).toBeInTheDocument();
});

test.each(['WHITELISTED', 'NOT_WHITELISTED', 'UNKNOWN'])('uses observed %s rather than legacy status', async state => {
  current.minecraft = { ...linked, status: state === 'WHITELISTED' ? 'ERROR' : 'WHITELISTED', whitelistState: state, stale: false };
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Nicht verknüpft/);
  expect(Boolean(screen.queryByText('Du bist bereit zum Spielen!'))).toBe(state === 'WHITELISTED');
  expect(screen.getByRole('button', { name: 'Minecraft-Verknüpfung entfernen' })).toBeEnabled();
  const expected = state === 'WHITELISTED' ? 'Whitelist: Freigeschaltet' : state === 'NOT_WHITELISTED' ? 'Whitelist: Nicht freigeschaltet' : unknownWhitelist;
  expect(screen.getByText(expected)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: state === 'UNKNOWN' ? 'Status erneut prüfen' : 'Status aktualisieren' }));
  await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0));
});

test.each(['SUCCEEDED', 'ALREADY_IN_STATE', 'NOT_REQUIRED', 'NOT_ATTEMPTED'] as const)('preserves POST operation %s after subsequent GET', async outcome => {
  current.minecraft = { ...linked };
  const operation: WhitelistOperation = { action: 'ADD', outcome, whitelistState: 'UNKNOWN', syncErrorCode: 'RCON_STATUS_UNAVAILABLE' };
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => response(options?.method === 'POST' ? { ...current, operation } : current, options?.method === 'POST' ? 201 : 200));
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Nicht verknüpft/);
  fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  const message = outcome === 'NOT_REQUIRED' ? 'Für diese Anfrage war kein Schreibbefehl erforderlich.' : outcome === 'NOT_ATTEMPTED' ? 'Es wurde kein Schreibbefehl gesendet, weil der Status nicht geprüft werden konnte. Bitte prüfe den Status erneut.' : 'Deine Anfrage wurde vom Minecraft-Server bestätigt. Der aktuelle Whitelist-Status konnte noch nicht überprüft werden.';
  await screen.findByText(message);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Status aktualisieren' })).toBeEnabled());
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
});

test('keeps a successful write acknowledgement when follow-up GET requests fail', async () => {
  current.minecraft = { ...linked, whitelistState: 'NOT_WHITELISTED', stale: false };
  let posted = false;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes('sessionserver')) return response({}, 503);
    if (options?.method === 'POST') {
      posted = true;
      return response({ ...current, minecraft: { ...linked, whitelistState: 'WHITELISTED', stale: false }, operation: { action: 'ADD', outcome: 'SUCCEEDED', whitelistState: 'WHITELISTED', syncErrorCode: null } }, 201);
    }
    if (posted) throw new Error('Offline');
    return response(current);
  });
  render(<MinecraftAccessPanel />);
  await screen.findByText('Whitelist: Nicht freigeschaltet');
  fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  await screen.findByText('Deine Anfrage wurde vom Minecraft-Server bestätigt. Der aktuelle Whitelist-Status konnte noch nicht überprüft werden.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
});

test.each(['RCON_COMMAND_FAILED', 'RCON_COMMAND_UNCONFIRMED', 'RCON_UNAVAILABLE'])('handles %s separately from observation', async code => {
  current.minecraft = { ...linked };
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      current.minecraft = { ...linked, lastErrorCode: null, lastCommand: { action: 'ADD', outcome: code === 'RCON_COMMAND_FAILED' ? 'FAILED' : 'UNKNOWN', at: '2026-10-18T12:00:00Z' } };
      return response({ code, message: code }, 503);
    }
    return response(current);
  });
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Nicht verknüpft/);
  fireEvent.click(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' }));
  await screen.findByText(code === 'RCON_COMMAND_FAILED' ? /Der Minecraft-Server hat die Änderung abgelehnt/ : /Die Ausführung deiner Anfrage konnte nicht bestätigt werden/);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText(code)).not.toBeInTheDocument();
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
});

test('does not send duplicate writes while a request is pending', async () => {
  current.minecraft = { ...linked };
  let resolveWrite!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? new Promise(resolve => { resolveWrite = resolve; }) : response(current));
  render(<MinecraftAccessPanel />);
  await screen.findByText(/Discord: Nicht verknüpft/);
  const button = screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByText('Aktion wird ausgeführt …')).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  await act(async () => resolveWrite(response(current, 201)));
});

test('confirms removal with null profile using operation', async () => {
  current.minecraft = { ...linked, whitelistState: 'WHITELISTED', stale: false };
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      current.minecraft = null;
      return response({ ...current, operation: { action: 'REMOVE', outcome: 'SUCCEEDED', whitelistState: 'NOT_WHITELISTED', syncErrorCode: null } }, 201);
    }
    return response(current);
  });
  render(<MinecraftAccessPanel />);
  await screen.findByText('Du bist bereit zum Spielen!');
  fireEvent.click(screen.getByRole('button', { name: 'Minecraft-Verknüpfung entfernen' }));
  await screen.findByText('Whitelist: Nicht freigeschaltet');
  expect(screen.getByText('Deine Anfrage wurde vom Minecraft-Server bestätigt.')).toBeInTheDocument();
});

test('preserves a confirmed remove while observation is unavailable', async () => {
  current.minecraft = { ...linked, removing: true, lastCommand: { action: 'REMOVE', outcome: 'SUCCEEDED', at: '2026-10-18T12:00:00Z' }, syncErrorCode: 'RCON_STATUS_UNAVAILABLE' };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Deine Anfrage wurde vom Minecraft-Server bestätigt. Der aktuelle Whitelist-Status konnte noch nicht überprüft werden.');
  expect(screen.getByRole('button', { name: 'Zur Whitelist hinzufügen' })).toBeDisabled();
  expect(screen.getByText(unknownWhitelist)).toBeInTheDocument();
});

test('keeps confirmed command separate from a contradictory valid observation', async () => {
  current.minecraft = { ...linked, whitelistState: 'NOT_WHITELISTED', stale: false, syncErrorCode: 'RCON_STATE_MISMATCH', lastCommand: { action: 'ADD', outcome: 'SUCCEEDED', at: '2026-10-18T12:00:00Z' } };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Whitelist: Nicht freigeschaltet');
  expect(screen.getByText('Deine Anfrage wurde vom Minecraft-Server bestätigt.')).toBeInTheDocument();
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
  expect(screen.getByText(/Der beobachtete Zustand stimmt noch nicht/)).toBeInTheDocument();
});
