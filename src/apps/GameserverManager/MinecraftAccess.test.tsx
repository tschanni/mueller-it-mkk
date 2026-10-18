import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MinecraftAccess } from './MinecraftAccess';
import { MinecraftAccessPanel } from './MinecraftAccessPanel';

const mockOpenWindow = jest.fn();
let mockSession: { user: { id: string; emailVerified: boolean } } | null = { user: { id: 'one', emailVerified: true } };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ session: mockSession, status: 'authenticated', configured: true, busy: false }) }));
jest.mock('../../auth/useAuthWindow', () => ({ useAuthWindow: () => mockOpenWindow }));
const base = { enabled: true, discord: { linked: false, membership: 'UNKNOWN' }, minecraft: null };
const linked = { username: 'Player_123', uuid: '12345678-1234-1234-1234-123456789abc', status: 'PENDING', linkedAt: '2026-10-18T10:00:00Z', lastSyncedAt: null, lastErrorCode: null, removing: false, ownershipVerified: false, stale: true };
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
      if (url.endsWith('/whitelist')) current = { ...current, minecraft: { ...linked, status: 'WHITELISTED', stale: false } };
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
  current.minecraft = { ...linked, status: 'WHITELISTED', stale: true };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Whitelist-Status bitte aktualisieren');
  expect(screen.queryByText('Du bist bereit zum Spielen!')).not.toBeInTheDocument();
});

test('shows confirmed whitelist access as ready to play', async () => {
  current.minecraft = { ...linked, status: 'WHITELISTED', stale: false };
  render(<MinecraftAccessPanel />);
  await screen.findByText('Du bist bereit zum Spielen!');
  expect(screen.getByText('Whitelist: Freigeschaltet')).toBeInTheDocument();
});
