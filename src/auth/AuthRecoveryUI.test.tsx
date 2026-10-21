import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { createAuthClient } from './client';
import { Desktop } from '../components/Desktop/Desktop';
import { WindowManagerProvider } from '../state/WindowManagerContext';
import { AuthTransfer } from './AuthTransfer';

jest.mock('../apps/Gallery/Gallery', () => ({ Gallery: () => null }));
const response = (state: string, code: string, status = 200): Response => ({ status, ok: status < 400, json: async () => ({ state, code }), headers: { get: () => null } } as unknown as Response);
const originalCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
beforeEach(() => {
  jest.useFakeTimers(); window.history.replaceState(null, '', '/');
  Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(0) } });
});
afterEach(() => { jest.useRealTimers(); if (originalCrypto) Object.defineProperty(window, 'crypto', originalCrypto); });
async function tick(ms = 0) { await act(async () => { jest.advanceTimersByTime(ms); for (let i = 0; i < 25; i++) await Promise.resolve(); }); }
async function setup() {
  const fetcher = jest.fn(async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => String(url).endsWith('/get-session')
    ? { ok: true, status: 200, json: async () => null } as Response : response('SUCCEEDED', 'REGISTRATION_ACCEPTED'));
  const adapter = createAuthClient({ baseURL: 'https://api.example/games/api/v1/auth', frontendOrigin: 'https://website.example', fetch: fetcher });
  render(<AuthProvider adapter={adapter}><WindowManagerProvider><Desktop /></WindowManagerProvider></AuthProvider>);
  await tick();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Registrieren' }));
  const dialog = screen.getByRole('dialog', { name: 'Neues Konto erstellen' });
  fireEvent.change(within(dialog).getByLabelText('Benutzername:'), { target: { value: 'Player' } });
  fireEvent.change(within(dialog).getByLabelText('E-Mail:'), { target: { value: 'player@example.test' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort:'), { target: { value: 'private-password-123' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'private-password-123' } });
  return { fetcher, dialog, submit: () => fireEvent.click(within(dialog).getByRole('button', { name: 'Registrieren' })) };
}
test('registration loading and accepted result use the same window without private data or delivery claims', async () => {
  const { fetcher, dialog, submit } = await setup();
  const store = jest.spyOn(Storage.prototype, 'setItem');
  submit();
  expect(screen.getByRole('dialog', { name: 'Müller IT MKK – Datenübertragung' })).toBe(dialog);
  expect(screen.getByText('Deine Registrierung wird verarbeitet …')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Datenübertragung' })).toHaveAttribute('aria-busy', 'true');
  expect(within(dialog).queryByRole('form')).not.toBeInTheDocument();
  expect(dialog).not.toHaveTextContent('private-password-123');
  await tick();
  expect(within(dialog).getByText('Registrierung angenommen')).toBeInTheDocument();
  expect(within(dialog).getByText(/Falls für diese E-Mail-Adresse/)).toBeInTheDocument();
  expect(dialog).not.toHaveTextContent(/versendet|zugestellt|REGISTRATION_ACCEPTED|v1\./);
  expect(screen.queryByRole('dialog', { name: 'Meldung' })).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(store).not.toHaveBeenCalled(); store.mockRestore();
});
test('PENDING stays in the same transfer view and only reads status', async () => {
  const { fetcher, dialog, submit } = await setup();
  fetcher.mockResolvedValueOnce(response('PENDING', 'REGISTRATION_PENDING', 202));
  submit(); await tick();
  expect(within(dialog).getByText('Deine Registrierung wird verarbeitet …')).toBeInTheDocument();
  expect(dialog).not.toHaveTextContent(/Retry|Versuch|Netzwerk|Sekunden|REGISTRATION/);
  await tick(1000);
  expect(within(dialog).getByText('Registrierung angenommen')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
test('uncertain result offers only a safe explicit status check', async () => {
  const { fetcher, dialog, submit } = await setup();
  fetcher.mockResolvedValueOnce(response('UNCERTAIN', 'REGISTRATION_UNCERTAIN', 202));
  submit(); await tick();
  expect(within(dialog).getByText('Registrierung wird möglicherweise noch verarbeitet')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Status erneut prüfen' })); await tick(1000);
  expect(within(dialog).getByText('Registrierung angenommen')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
test('closing aborts work; reopening retains the uncertain receipt rather than creating a new registration', async () => {
  const { fetcher, dialog, submit } = await setup();
  fetcher.mockImplementationOnce(() => new Promise(() => {}));
  submit(); await tick();
  const request = fetcher.mock.calls.find(([, options]) => options?.method === 'POST')!;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' })); await tick();
  expect(request[1]?.signal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Registrieren' }));
  expect(screen.getByText('Registrierung wird möglicherweise noch verarbeitet')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
test('definite server error uses the specified message in the existing transfer component', () => {
  render(<AuthTransfer kind="registration" outcome={{ state: 'ERROR' }} onClose={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Anmeldeserver nicht erreichbar');
  expect(screen.getByRole('alert')).toHaveTextContent('Die Verbindung konnte nicht hergestellt werden. Bitte versuche es später erneut.');
});
