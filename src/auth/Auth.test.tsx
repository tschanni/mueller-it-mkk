import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { Desktop } from '../components/Desktop/Desktop';
import { WindowManagerProvider } from '../state/WindowManagerContext';
import { AuthProvider, useAuth } from './AuthContext';
import { ContactInput, ContactProfile } from './contactProfile';
import { AuthAdapter, AuthError, AuthSession, LinkedAccount, checkedRedirect, checkedSession } from './client';

jest.mock('../apps/Gallery/Gallery', () => ({ Gallery: () => null }));
const user = { id: 'user-1', name: 'Testbenutzer', email: 'test@example.com', emailVerified: true, role: 'USER' as const };
const signedIn = (): AuthSession => ({ user, expiresAt: Date.now() + 3600000 });
function adapterForTest() {
  return {
    configured: true, registrationAvailable: true, redirectOrigins: ['https://discord.com'],
    getSession: jest.fn(async (_signal: AbortSignal): Promise<AuthSession | null> => null),
    signIn: jest.fn(async () => undefined),
    signUp: jest.fn(async () => 'verify-email' as const),
    signOut: jest.fn(async () => undefined),
    requestPasswordReset: jest.fn(async () => undefined),
    getProfile: jest.fn(async (_signal: AbortSignal): Promise<ContactProfile | null> => null),
    saveProfile: jest.fn(async (input: ContactInput, _signal: AbortSignal): Promise<ContactProfile> => ({ ...input, userId: 'user-1', updatedAt: new Date().toISOString() })),
    listAccounts: jest.fn(async (): Promise<LinkedAccount[]> => []),
    startDiscord: jest.fn(async () => 'https://discord.com/oauth2/authorize?state=backend-state'),
  };
}
function Observer() {
  const { status, session } = useAuth();
  return <output data-testid="auth-state">{status}:{session?.user.role}</output>;
}
function mount(adapter: AuthAdapter = adapterForTest(), redirect = jest.fn()) {
  const view = render(<AuthProvider adapter={adapter} redirect={redirect}><WindowManagerProvider><Desktop /><Observer /></WindowManagerProvider></AuthProvider>);
  return { ...view, redirect };
}
async function ready() { await waitFor(() => expect(screen.getByTestId('auth-state')).not.toHaveTextContent('loading')); }
function menu() { fireEvent.click(screen.getByRole('button', { name: 'Start' })); return screen.getByRole('menu'); }
function openLogin() { fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Anmelden' })); return screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' }); }
function credentials(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('E-Mail:'), { target: { value: 'test@example.com' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort:'), { target: { value: 'correct test password' } });
}
function registration(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('Benutzername:'), { target: { value: 'Testbenutzer' } });
  credentials(dialog);
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'correct test password' } });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  Object.defineProperty(window, 'fetch', { writable: true, value: jest.fn(async () => ({ ok: true, json: async () => [] })) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
function focusAfterMinute() { jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60001); fireEvent.focus(window); }

test('an anonymous cookie session leaves login available and the public manager usable', async () => {
  (window.fetch as jest.Mock).mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/auth/get-session') ? null : [] }));
  render(<App />);
  const login = openLogin();
  expect(within(login).getByRole('button', { name: 'Anmelden' })).toBeEnabled();
  expect(within(login).getByRole('button', { name: 'Mit Discord anmelden' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Gameserver-Manager' }));
  await screen.findByText('Keine Gameserver eingerichtet.');
  expect(window.fetch).toHaveBeenCalledTimes(2);
  expect(window.fetch).toHaveBeenCalledWith(expect.stringContaining('/public/servers'), expect.objectContaining({ credentials: 'omit' }));
});

test('opens one login window, restores it, and closes via cancel and window controls', async () => {
  mount(); await ready();
  const dialog = openLogin();
  expect(within(dialog).getByLabelText('E-Mail:')).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Minimize' }));
  expect(dialog).toHaveClass('hidden');
  openLogin();
  expect(dialog).not.toHaveClass('hidden');
  expect(screen.getAllByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
  expect(dialog).not.toBeInTheDocument();
  fireEvent.click(within(openLogin()).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).not.toBeInTheDocument());
});

test('start menu supports keyboard navigation, Escape and outside clicks', async () => {
  mount(); await ready();
  const start = screen.getByRole('button', { name: 'Start' });
  fireEvent.keyDown(start, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Anmelden' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Registrieren' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(start).toHaveFocus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  menu(); fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('validates registration before sending and handles email verification without inventing a session', async () => {
  const adapter = adapterForTest();
  mount(adapter); await ready();
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Registrieren' }));
  const dialog = screen.getByRole('dialog', { name: 'Neues Konto erstellen' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Registrieren' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Benutzername');
  expect(adapter.signUp).not.toHaveBeenCalled();
  registration(dialog);
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'wrong' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Registrieren' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('stimmen nicht überein');
  expect(adapter.signUp).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'correct test password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Registrieren' }));
  await screen.findByText(/Bitte prüfen Sie Ihren Posteingang/);
  expect(adapter.signUp).toHaveBeenCalledWith({ name: 'Testbenutzer', email: 'test@example.com', password: 'correct test password' }, expect.any(AbortSignal));
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  expect(dialog).not.toBeInTheDocument();
});

test('registration can restore an automatically created session according to the adapter result', async () => {
  const adapter = { ...adapterForTest(), signUp: jest.fn(async () => 'session' as const) };
  adapter.getSession.mockResolvedValueOnce(null).mockResolvedValueOnce(signedIn());
  mount(adapter); await ready();
  fireEvent.click(within(openLogin()).getByRole('button', { name: 'Neues Konto erstellen' }));
  const dialog = screen.getByRole('dialog', { name: 'Neues Konto erstellen' });
  registration(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Registrieren' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER'));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).not.toBeInTheDocument());
});

test('login verifies the cookie session before showing a signed-in user', async () => {
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValueOnce(null).mockResolvedValueOnce(signedIn());
  mount(adapter); await ready();
  const dialog = openLogin(); credentials(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Anmelden' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER'));
  expect(adapter.signIn).toHaveBeenCalledWith({ email: 'test@example.com', password: 'correct test password' }, expect.any(AbortSignal));
  expect(dialog).not.toBeInTheDocument();
  expect(within(menu()).getByText('Testbenutzer')).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Mein Konto' })).toBeInTheDocument();
});

test('a successful login response without a verified session never signs the user in', async () => {
  const adapter = adapterForTest(); mount(adapter); await ready();
  const dialog = openLogin(); credentials(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Anmelden' }));
  await screen.findByText('Anmeldung konnte nicht bestätigt werden');
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
});

test('pending login disables duplicate submissions and has a bounded waiting time', async () => {
  jest.useFakeTimers();
  const adapter = adapterForTest(); adapter.signIn.mockImplementation(() => new Promise(() => undefined));
  mount(adapter);
  await act(async () => { await Promise.resolve(); });
  const dialog = openLogin(); credentials(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Anmelden' }));
  expect(within(dialog).getByText('Anmeldung läuft …')).toBeInTheDocument();
  expect(within(dialog).queryByRole('form')).not.toBeInTheDocument();
  expect(adapter.signIn).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(15001); });
  await act(async () => { jest.advanceTimersByTime(750); });
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(screen.getByText('Anmeldung konnte nicht bestätigt werden')).toBeInTheDocument();
  expect(adapter.signIn).toHaveBeenCalledTimes(1);
});

test('incorrect credentials use a classic safe error window and clear the password', async () => {
  const adapter = adapterForTest();
  adapter.signIn.mockRejectedValue(new AuthError('credentials'));
  mount(adapter); await ready();
  const dialog = openLogin(); credentials(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Anmelden' }));
  await screen.findByText('E-Mail-Adresse oder Passwort ist nicht korrekt.');
  expect(screen.queryByRole('dialog', { name: 'Meldung' })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Zur Anmeldung' }));
  expect(within(dialog).getByLabelText('Passwort:')).toHaveValue('');
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
});

test('restores ADMIN from the server and displays account information', async () => {
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValue({ ...signedIn(), user: { ...user, role: 'ADMIN' } });
  mount(adapter); await ready();
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:ADMIN');
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Mein Konto' }));
  const dialog = screen.getByRole('dialog', { name: 'Mein Konto' });
  expect(within(dialog).getByText('Administrator')).toBeInTheDocument();
  expect(within(dialog).getByText('test@example.com')).toBeInTheDocument();
  await within(dialog).findByText('Keine Anmeldekonten gemeldet.');
});

test('logout clears the user only after the server confirms success', async () => {
  const adapter = adapterForTest(); adapter.getSession.mockResolvedValue(signedIn());
  mount(adapter); await ready();
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Abmelden' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous'));
  expect(adapter.signOut).toHaveBeenCalledTimes(1);
  await screen.findByText('Sie wurden erfolgreich abgemeldet.');
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(within(menu()).getByRole('menuitem', { name: 'Anmelden' })).toBeInTheDocument();
});

test('failed logout retains the verified user and never exposes raw backend error text', async () => {
  const adapter = adapterForTest(); adapter.getSession.mockResolvedValue(signedIn());
  adapter.signOut.mockRejectedValue(new Error('SECRET_TOKEN_INTERNAL_STACK'));
  mount(adapter); await ready();
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Abmelden' }));
  await screen.findByText(/Anmeldedienst ist nicht erreichbar/);
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER');
  expect(screen.queryByText(/SECRET_TOKEN/)).not.toBeInTheDocument();
});

test('Discord uses only the allowlisted backend-provided redirect and returns to the desktop path', async () => {
  const adapter = adapterForTest(); const { redirect } = mount(adapter); await ready();
  fireEvent.click(within(openLogin()).getByRole('button', { name: 'Mit Discord anmelden' }));
  await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://discord.com/oauth2/authorize?state=backend-state'));
  expect(adapter.startDiscord).toHaveBeenCalledWith(window.location.origin + window.location.pathname, expect.any(AbortSignal));
  expect(adapter.signIn).not.toHaveBeenCalled();
});

test('Discord failures and documented callback errors display a safe message', async () => {
  window.history.replaceState(null, '', '/auth/error?error=access_denied&error_description=SECRET');
  const adapter = adapterForTest();
  adapter.startDiscord.mockResolvedValue('https://discord.com.attacker.example/login');
  const { redirect } = mount(adapter); await ready();
  await screen.findByText(/Discord-Anmeldung wurde abgebrochen/);
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  const login = screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' });
  fireEvent.click(within(login).getByRole('button', { name: 'Mit Discord anmelden' }));
  await screen.findByText(/Discord-Anmeldung wurde abgebrochen/);
  expect(redirect).not.toHaveBeenCalled();
});

test('password reset validates email and acknowledges requests without disclosing account existence', async () => {
  const adapter = adapterForTest(); mount(adapter); await ready();
  fireEvent.click(within(openLogin()).getByRole('button', { name: 'Passwort vergessen?' }));
  const dialog = screen.getByRole('dialog', { name: 'Passwort vergessen' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Nachricht anfordern' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('gültige E-Mail-Adresse');
  expect(adapter.requestPasswordReset).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('E-Mail:'), { target: { value: 'unknown@example.com' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Nachricht anfordern' }));
  await screen.findByText(/Falls für diese E-Mail-Adresse ein Konto besteht/);
  expect(adapter.requestPasswordReset).toHaveBeenCalledWith('unknown@example.com', expect.any(AbortSignal));
});

test('session expiry clears privileged state and shows the classic message window', async () => {
  jest.useFakeTimers();
  const adapter = adapterForTest(); adapter.getSession.mockResolvedValue({ ...signedIn(), expiresAt: Date.now() + 5000 });
  mount(adapter);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
  await act(async () => { jest.advanceTimersByTime(5001); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  expect(screen.getByText(/Ihre Sitzung ist abgelaufen/)).toBeInTheDocument();
});

test('focus refresh applies changed database roles and revoked sessions', async () => {
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValueOnce({ ...signedIn(), user: { ...user, role: 'ADMIN' } }).mockResolvedValueOnce(signedIn()).mockResolvedValueOnce(null);
  mount(adapter); await ready();
  expect(screen.getByTestId('auth-state')).toHaveTextContent('ADMIN');
  focusAfterMinute();
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('USER'));
  focusAfterMinute();
  await screen.findByText(/Ihre Sitzung ist abgelaufen/);
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
});

test('a late session restore cannot sign the user back in after logout', async () => {
  let resolve: (value: AuthSession | null) => void = () => undefined;
  const delayed = new Promise<AuthSession | null>(done => { resolve = done; });
  const adapter = adapterForTest(); adapter.getSession.mockResolvedValueOnce(signedIn()).mockReturnValueOnce(delayed);
  mount(adapter); await ready();
  focusAfterMinute();
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Abmelden' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous'));
  await act(async () => { resolve(signedIn()); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
});

// Deliberately malicious input: this string is validated, never executed.
// eslint-disable-next-line no-script-url
test.each(['javascript:alert(1)', 'http://discord.com/login', '//discord.com/login', 'https://discord.com@attacker.example/login', 'https://discord.com.attacker.example/login'])('rejects unsafe OAuth redirect %s', url => {
  expect(() => checkedRedirect(url, ['https://discord.com'])).toThrow(AuthError);
});

test('unknown roles are USER, expired sessions are anonymous, and malformed responses are rejected', () => {
  expect(checkedSession({ ...signedIn(), user: { ...user, role: 'SUPERADMIN' as 'USER' } })?.user.role).toBe('USER');
  expect(checkedSession({ ...signedIn(), expiresAt: Date.now() - 1 })).toBeNull();
  expect(() => checkedSession({ ...signedIn(), expiresAt: NaN })).toThrow(AuthError);
  expect(() => checkedSession({ ...signedIn(), user: null } as unknown as AuthSession)).toThrow(AuthError);
});

test('email verification return removes query data, opens login and shows confirmation', async () => {
  window.history.replaceState(null, '', '/auth/verified');
  mount(); await ready();
  await screen.findByText(/Ihre E-Mail-Adresse wurde bestätigt/);
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});

test('a successful Discord return without a cookie session offers another login', async () => {
  window.history.replaceState(null, '', '/auth/callback');
  mount(); await ready();
  await screen.findByText(/Discord-Anmeldung wurde abgebrochen/);
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
  expect(window.location.search).toBe('');
});

test('reset mail return captures the token only in memory and submits the new password once', async () => {
  window.history.replaceState(null, '', '/reset-password?token=ONE_TIME_SECRET');
  const adapter = { ...adapterForTest(), passwordPolicy: { minLength: 12, maxLength: 128 }, completePasswordReset: jest.fn(async () => undefined) };
  mount(adapter); await ready();
  const dialog = await screen.findByRole('dialog', { name: 'Passwort zurücksetzen' });
  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(screen.queryByText('ONE_TIME_SECRET')).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Neues Passwort:'), { target: { value: 'short' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'short' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Passwort speichern' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('12 und 128');
  expect(adapter.completePasswordReset).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('Neues Passwort:'), { target: { value: 'new-long-password' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort bestätigen:'), { target: { value: 'new-long-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Passwort speichern' }));
  await screen.findByText(/Ihr Passwort wurde geändert/);
  expect(adapter.completePasswordReset).toHaveBeenCalledWith('ONE_TIME_SECRET', 'new-long-password', expect.any(AbortSignal));
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
});

test('invalid reset-link callbacks are sanitized and offer login without displaying backend descriptions', async () => {
  window.history.replaceState(null, '', '/reset-password?error=INVALID_TOKEN&error_description=SECRET');
  mount(); await ready();
  await screen.findByText(/Der Link ist ungültig oder abgelaufen/);
  expect(screen.queryByRole('dialog', { name: 'Passwort zurücksetzen' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
  expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
  expect(window.location.search).toBe('');
});

test('verification mail can be resent without revealing whether an account exists', async () => {
  const adapter = { ...adapterForTest(), sendVerificationEmail: jest.fn(async () => undefined) };
  mount(adapter); await ready();
  const dialog = openLogin();
  fireEvent.change(within(dialog).getByLabelText('E-Mail:'), { target: { value: 'test@example.com' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigungsmail erneut senden' }));
  await screen.findByText(/Falls eine Bestätigung erforderlich ist/);
  expect(adapter.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', expect.any(AbortSignal));
});

test('user.name is displayed with stable user ID and no username editor', async () => {
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValue({ ...signedIn(), user: { ...user, name: 'Discord Name' } });
  mount(adapter); await ready();
  const dialog = await openAccount();
  expect(within(dialog).getAllByText('Discord Name').length).toBeGreaterThan(0);
  expect(within(dialog).getByText('user-1')).toBeInTheDocument();
  expect(within(dialog).queryByRole('form', { name: /Benutzername/ })).not.toBeInTheDocument();
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Kontaktdaten speichern' })).toBeEnabled());
  for (const label of ['Vorname:', 'Nachname:', 'Stra\u00dfe:', 'Hausnummer:', 'Postleitzahl:', 'Ort:']) {
    expect(within(dialog).getByLabelText(label)).toBeEnabled();
    expect(within(dialog).getByLabelText(label)).not.toBeRequired();
  }
});

function linkedAdapter() {
  const adapter = { ...adapterForTest(), linkDiscord: jest.fn(async () => 'https://discord.com/oauth2/authorize?state=link-state'),
    unlinkAccount: jest.fn(async () => undefined) };
  adapter.getSession.mockResolvedValue({ ...signedIn(), user: { ...user, name: 'Alex Example', emailVerified: true } });
  return adapter;
}
const credentialAccount = { id: 'credential-row', providerId: 'credential', accountId: 'user-1' };
const discordAccount = { id: 'discord-row', providerId: 'discord', accountId: 'discord-id' };
async function openAccount() {
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Mein Konto' }));
  const dialog = screen.getByRole('dialog', { name: 'Mein Konto' });
  await waitFor(() => expect(within(dialog).queryByText('Anmeldekonten werden geladen…')).not.toBeInTheDocument());
  return dialog;
}

test('account window displays verified email, loads linked accounts, and starts explicit Discord linking', async () => {
  const adapter = linkedAdapter(); adapter.listAccounts.mockResolvedValue([credentialAccount]);
  const { redirect } = mount(adapter); await ready();
  const dialog = await openAccount();
  expect(within(dialog).getAllByText('Alex Example')[0]).toBeInTheDocument();
  expect(within(dialog).getByText('Bestätigt')).toBeInTheDocument();
  expect(within(dialog).getByText('E-Mail und Passwort')).toBeInTheDocument();
  expect(adapter.linkDiscord).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Discord-Konto verknüpfen' }));
  await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://discord.com/oauth2/authorize?state=link-state'));
  expect(adapter.linkDiscord).toHaveBeenCalledWith(expect.any(AbortSignal));
});

test('unverified users cannot link Discord and can request verification from their account', async () => {
  const adapter = { ...linkedAdapter(), sendVerificationEmail: jest.fn(async () => undefined) };
  adapter.getSession.mockResolvedValue({ ...signedIn(), user: { ...user, emailVerified: false } });
  adapter.listAccounts.mockResolvedValue([credentialAccount]);
  mount(adapter); await ready();
  const dialog = await openAccount();
  expect(within(dialog).getByText('Nicht bestätigt')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Discord-Konto verknüpfen' })).toBeDisabled();
  expect(adapter.linkDiscord).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigungsmail erneut senden' }));
  await screen.findByText(/Falls eine Bestätigung erforderlich ist/);
});

test('removing Discord requires confirmation, uses the listed row ID, and refreshes the accounts', async () => {
  const adapter = linkedAdapter();
  adapter.listAccounts.mockResolvedValueOnce([credentialAccount, discordAccount]).mockResolvedValueOnce([credentialAccount]);
  mount(adapter); await ready();
  const dialog = await openAccount();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Discord-Verknüpfung entfernen' }));
  expect(adapter.unlinkAccount).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen bestätigen' }));
  await waitFor(() => expect(adapter.listAccounts).toHaveBeenCalledTimes(2));
  expect(adapter.unlinkAccount).toHaveBeenCalledWith('discord-row', expect.any(AbortSignal));
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Discord-Verknüpfung entfernen' })).not.toBeInTheDocument());
  expect(within(dialog).getByRole('button', { name: 'Discord-Konto verknüpfen' })).toBeEnabled();
});

test('last login account cannot be removed in the UI', async () => {
  const adapter = linkedAdapter(); adapter.listAccounts.mockResolvedValue([discordAccount]);
  mount(adapter); await ready();
  const dialog = await openAccount();
  expect(within(dialog).getByRole('button', { name: 'Discord-Verknüpfung entfernen' })).toBeDisabled();
  expect(adapter.unlinkAccount).not.toHaveBeenCalled();
});

test('server freshness requirement opens reauthentication without claiming logout or unlink success', async () => {
  const adapter = linkedAdapter(); adapter.listAccounts.mockResolvedValue([credentialAccount, discordAccount]);
  adapter.unlinkAccount.mockRejectedValue(new AuthError('fresh-session'));
  mount(adapter); await ready();
  const dialog = await openAccount();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Discord-Verknüpfung entfernen' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen bestätigen' }));
  await screen.findByText('Bitte melden Sie sich erneut an, um diese Aktion auszuführen.');
  const login = await screen.findByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
  expect(adapter.signOut).not.toHaveBeenCalled();
  expect(within(dialog).getByRole('button', { name: 'Discord-Verknüpfung entfernen' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  credentials(login);
  fireEvent.click(within(login).getByRole('button', { name: 'Anmelden' }));
  await waitFor(() => expect(login).not.toBeInTheDocument());
  expect(adapter.signIn).toHaveBeenCalledTimes(1);
});

test('failed account loading is retryable without enabling username editing', async () => {
  const adapter = linkedAdapter();
  adapter.listAccounts.mockRejectedValueOnce(new AuthError('network')).mockResolvedValueOnce([credentialAccount]);
  mount(adapter); await ready();
  const dialog = await openAccount();
  await screen.findByText(/Der Anmeldedienst ist nicht erreichbar/);
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Erneut laden' }));
  await within(dialog).findByText('E-Mail und Passwort');
  expect(within(dialog).queryByLabelText('Benutzername:')).not.toBeInTheDocument();
});

test('registration stays blocked without the new contract and contains no personal fields', async () => {
  const adapter = { ...adapterForTest(), registrationAvailable: false };
  mount(adapter); await ready();
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Registrieren' }));
  const dialog = screen.getByRole('dialog', { name: 'Neues Konto erstellen' });
  expect(within(dialog).getByRole('button', { name: 'Registrieren' })).toBeDisabled();
  expect(within(dialog).queryByLabelText('Name:')).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText('Vorname:')).not.toBeInTheDocument();
  registration(dialog);
  fireEvent.submit(within(dialog).getByRole('form', { name: 'Registrierungsdaten' }));
  await screen.findAllByText(/Registrierung wird auf das neue Benutzermodell/);
  expect(adapter.signUp).not.toHaveBeenCalled();
});

test('start menu uses login and registration icons without the Windows branding', async () => {
  mount(); await ready();
  const start = menu();
  expect(within(start).queryByText(/Windows/)).not.toBeInTheDocument();
  expect(within(within(start).getByRole('menuitem', { name: 'Anmelden' })).getByAltText('')).toHaveAttribute('src', expect.stringContaining('retro-login.svg'));
  expect(within(within(start).getByRole('menuitem', { name: 'Registrieren' })).getByAltText('')).toHaveAttribute('src', expect.stringContaining('retro-register.svg'));
});

test('profile image is displayed but update-user editing is unavailable', async () => {
  const adapter = linkedAdapter();
  adapter.getSession.mockResolvedValue({ ...signedIn(), user: { ...user, image: 'https://images.example.com/avatar.png' } });
  mount(adapter); await ready(); const dialog = await openAccount();
  expect(within(dialog).getByAltText('Profilbild von Testbenutzer')).toHaveAttribute('src', 'https://images.example.com/avatar.png');
  expect(within(dialog).queryByLabelText('Bildadresse:')).not.toBeInTheDocument();
});

test('linking callbacks sanitize error queries and reopen the account window', async () => {
  window.history.replaceState(null, '', '/settings/accounts?error=access_denied&error_description=SECRET');
  const adapter = linkedAdapter(); adapter.listAccounts.mockResolvedValue([credentialAccount]);
  mount(adapter); await ready();
  await screen.findByText('Das Discord-Konto konnte nicht verknüpft werden. Bitte versuchen Sie es erneut.');
  const dialog = await screen.findByRole('dialog', { name: 'Mein Konto' });
  await within(dialog).findByText('E-Mail und Passwort');
  expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(adapter.linkDiscord).not.toHaveBeenCalled();
});

// Session failures must not discard a still-valid identity or open a modal.
test.each(['network', 'server'] as const)('refresh %s retains the session and silently retries', async code => {
  jest.useFakeTimers();
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValueOnce(signedIn()).mockRejectedValueOnce(new AuthError(code)).mockResolvedValueOnce(signedIn());
  mount(adapter); await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(60001); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(751); });
  expect(adapter.getSession).toHaveBeenCalledTimes(3);
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER');
});

test('HTTP 401 during refresh clears the session and offers login', async () => {
  const adapter = adapterForTest();
  adapter.getSession.mockResolvedValueOnce(signedIn()).mockRejectedValueOnce(new AuthError('unauthorized'));
  mount(adapter); await ready(); focusAfterMinute();
  await screen.findByText(/HTTP 401/);
  expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
});

test('initial temporary failure silently recovers with one bounded retry', async () => {
  jest.useFakeTimers();
  const adapter = adapterForTest();
  adapter.getSession.mockRejectedValueOnce(new AuthError('network')).mockResolvedValueOnce(signedIn());
  mount(adapter); await act(async () => { await Promise.resolve(); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('loading');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(751); });
  expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated:USER');
  expect(adapter.getSession).toHaveBeenCalledTimes(2);
});

test('Discord return requiring email verification gives a specific safe recovery instruction', async () => {
  window.history.replaceState(null, '', '/auth/error?error=email_not_verified&error_description=PRIVATE');
  mount(); await ready();
  await screen.findByText(/Starten Sie danach die Discord-Anmeldung erneut/);
  expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Mueller IT MKK Welt Anmeldung' })).toBeInTheDocument();
  expect(window.location.search).toBe('');
});
