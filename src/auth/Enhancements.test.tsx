import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthAdapter, AuthError, AuthSession, createAuthClient } from './client';
import { ProfileImageEditor } from './ProfileImageEditor';
import { MinecraftAccount } from './MinecraftAccount';
import { MinecraftLiveMap } from '../apps/GameserverManager/MinecraftLiveMap';
import { retryAuthRead } from './retry';

const session: AuthSession = { user: { id: 'a', name: 'Alex', email: 'a@example.com', role: 'USER' }, expiresAt: Date.now() + 3600000 };
function adapter(): AuthAdapter {
  return { configured: true, redirectOrigins: [], getSession: jest.fn(async () => session),
    signIn: jest.fn(async () => {}), signOut: jest.fn(async () => {}), signUp: jest.fn(async () => 'verify-email'),
    requestPasswordReset: jest.fn(async () => {}), startDiscord: jest.fn(async () => '') };
}
function View() {
  const auth = useAuth();
  return <><output>{auth.status}</output><button onClick={() => void auth.refresh()}>Refresh</button>
    <button onClick={() => void auth.logout()}>Logout</button><button disabled={auth.busy} onClick={() => void auth.login({ email: 'a@example.com', password: 'secret' })}>Login</button>
    {auth.session && <ProfileImageEditor user={auth.session.user} />}<MinecraftLiveMap /></>;
}
afterEach(() => { jest.useRealTimers(); delete process.env.REACT_APP_MINECRAFT_MAP_URL; jest.restoreAllMocks(); });

test('StrictMode and parallel refresh requests share the initial session probe', async () => {
  const client = adapter(); let resolve!: (value: AuthSession) => void;
  client.getSession = jest.fn(() => new Promise(done => { resolve = done; }));
  render(<React.StrictMode><AuthProvider adapter={client}><View /></AuthProvider></React.StrictMode>);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByText('Refresh')); fireEvent.focus(window);
  expect(client.getSession).toHaveBeenCalledTimes(1);
  await act(async () => resolve(session));
  expect(screen.getByText('authenticated')).toBeInTheDocument();
});

test('persistent backend outage ends after three reads without discarding the public UI', async () => {
  jest.useFakeTimers(); const client = adapter(); client.getSession = jest.fn(async () => { throw new AuthError('server'); });
  render(<AuthProvider adapter={client}><View /></AuthProvider>);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(750); });
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(client.getSession).toHaveBeenCalledTimes(3);
  expect(screen.getByText('unavailable')).toBeInTheDocument();
  expect(screen.getByText('Login')).toBeEnabled();
});

test('an ambiguous login response recovers the cookie session without replaying the POST', async () => {
  const client = adapter(); client.getSession = jest.fn().mockResolvedValueOnce(null).mockResolvedValue(session);
  client.signIn = jest.fn(async () => { throw new AuthError('network'); });
  render(<AuthProvider adapter={client}><View /></AuthProvider>);
  await screen.findByText('anonymous'); fireEvent.click(screen.getByText('Login'));
  await screen.findByText('authenticated'); expect(client.signIn).toHaveBeenCalledTimes(1);
});

test('live map needs only the website session and disappears immediately after logout', async () => {
  process.env.REACT_APP_MINECRAFT_MAP_URL = 'https://api.mueller-it-mkk.de/private-map/';
  render(<AuthProvider adapter={adapter()}><View /></AuthProvider>);
  await screen.findByTitle('Minecraft-Livekarte');
  fireEvent.click(screen.getByText('Logout'));
  await waitFor(() => expect(screen.queryByTitle('Minecraft-Livekarte')).not.toBeInTheDocument());
});

test('image selection validates, previews, uploads and updates the shared identity', async () => {
  const client = adapter(); client.uploadProfileImage = jest.fn(async () => 'https://images.example.com/avatar-v2.png');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:preview') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  render(<AuthProvider adapter={client}><View /></AuthProvider>);
  const input = await screen.findByLabelText(/Bild auswählen/);
  fireEvent.change(input, { target: { files: [new File(['x'], 'bad.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('maximal 5 MB');
  const file = new File(['png'], 'avatar.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByAltText('Vorschau des neuen Profilbilds')).toHaveAttribute('src', 'blob:preview');
  fireEvent.click(screen.getByText('Profilbild speichern'));
  await waitFor(() => expect(screen.getByAltText('Profilbild von Alex')).toHaveAttribute('src', 'https://images.example.com/avatar-v2.png'));
  expect(client.uploadProfileImage).toHaveBeenCalledWith(file, expect.any(AbortSignal));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});

test('upload adapter uses multipart and cookies without setting a multipart boundary', async () => {
  const fetcher = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => ({ image: 'https://images.example.com/v2.png' }) } as Response));
  const client = createAuthClient({ baseURL: 'https://api.example.com/api/v1/auth', frontendOrigin: 'https://example.com', profileImageUploadURL: 'https://api.example.com/avatar', fetch: fetcher });
  await client.uploadProfileImage!(new File(['x'], 'a.png'), new AbortController().signal);
  expect(fetcher).toHaveBeenCalledWith('https://api.example.com/avatar', expect.objectContaining({ credentials: 'include', method: 'POST', body: expect.any(FormData) }));
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers');
});

test('Minecraft profile reports linkage and never presents stale whitelist data as confirmed', async () => {
  jest.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ minecraft: { username: 'AlexMC', uuid: 'uuid', whitelistState: 'WHITELISTED', stale: true } }) } as Response);
  render(<AuthProvider adapter={adapter()}><MinecraftAccount /></AuthProvider>);
  await screen.findByText('AlexMC'); expect(screen.getByText('Derzeit unbekannt')).toBeInTheDocument();
});

test('reads do not retry rejected credentials and cancelled backoff sends no further request', async () => {
  const read = jest.fn(async () => { throw new AuthError('credentials'); });
  await expect(retryAuthRead(read, new AbortController().signal)).rejects.toMatchObject({ code: 'credentials' });
  expect(read).toHaveBeenCalledTimes(1);
  const abort = new AbortController(); const network = jest.fn(async () => { throw new AuthError('network'); });
  const pending = retryAuthRead(network, abort.signal); await Promise.resolve(); abort.abort();
  await expect(pending).rejects.toMatchObject({ code: 'network' }); expect(network).toHaveBeenCalledTimes(1);
});
