import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { AccountDialog } from './AccountDialog';
import { AuthError, AuthSession } from './client';
import { ContactInput, ContactProfile, contactBody, emptyContact } from './contactProfile';
import { WindowManagerProvider } from '../state/WindowManagerContext';

const session = (id = 'a'): AuthSession => ({ user: { id, name: 'SameName', email: `${id}@example.com`, role: 'USER', emailVerified: true }, expiresAt: Date.now() + 3600000 });
const profile = (id = 'a', input = contactBody(emptyContact())): ContactProfile => ({ ...input, userId: id, updatedAt: '2026-10-16T12:00:00.000Z' });
function adapter() {
  return {
    configured: true, redirectOrigins: [], registrationAvailable: true,
    getSession: jest.fn(async (): Promise<AuthSession | null> => session()),
    getProfile: jest.fn(async (_signal: AbortSignal): Promise<ContactProfile | null> => null),
    saveProfile: jest.fn(async (input: ContactInput, _signal: AbortSignal) => profile('a', input)),
    signIn: jest.fn(async () => undefined), signUp: jest.fn(async () => 'verify-email' as const),
    signOut: jest.fn(async () => undefined), requestPasswordReset: jest.fn(async () => undefined),
    startDiscord: jest.fn(async () => ''), listAccounts: jest.fn(async () => []),
  };
}
function Controls() {
  const auth = useAuth();
  return <><output data-testid="identity">{auth.status}:{auth.session?.user.id}</output>
    <output data-testid="notice">{auth.notice?.kind}:{auth.notice?.text}</output>
    <button onClick={() => void auth.refresh()}>Session prüfen</button>
    <button onClick={() => void auth.logout()}>Logout</button>
    <button onClick={() => void auth.listAccounts(new AbortController().signal).catch(() => undefined)}>Konten neu laden</button>
    <AccountDialog windowId="account" /></>;
}
function mount(client = adapter()) {
  render(<AuthProvider adapter={client}><WindowManagerProvider><Controls /></WindowManagerProvider></AuthProvider>);
  return client;
}
async function ready() { await waitFor(() => expect(screen.getByRole('button', { name: 'Kontaktdaten speichern' })).toBeEnabled()); }
function save() { fireEvent.click(screen.getByRole('button', { name: 'Kontaktdaten speichern' })); }
function edit(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => jest.useRealTimers());

test('contact information starts collapsed and retains the editable form when expanded', async () => {
  mount(); await ready();
  const summary = screen.getByText('Kontaktinformationen');
  // Inspect the native disclosure state; jsdom exposes no named details role.
  // eslint-disable-next-line testing-library/no-node-access
  const details = summary.closest('details')!;
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(summary);
  expect(details).toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Kontaktdaten speichern' })).toBeEnabled();
  fireEvent.click(summary);
  expect(details).not.toHaveAttribute('open');
});

test('anonymous and unverified sessions never request or expose profile fields', async () => {
  const client = adapter(); client.getSession.mockResolvedValue(null);
  mount(client); await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('anonymous'));
  expect(screen.queryByLabelText('Vorname:')).not.toBeInTheDocument();
  expect(client.getProfile).not.toHaveBeenCalled();
  client.getSession.mockResolvedValue({ ...session(), user: { ...session().user, emailVerified: false } });
  fireEvent.click(screen.getByRole('button', { name: 'Session prüfen' }));
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:a'));
  expect(screen.queryByLabelText('Vorname:')).not.toBeInTheDocument();
  expect(client.getProfile).not.toHaveBeenCalled();
});

test('an absent profile can be saved entirely empty and success waits for confirmation', async () => {
  const client = adapter();
  let finish!: (value: ContactProfile) => void;
  client.saveProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(client); await ready(); save(); fireEvent.submit(screen.getByRole('form', { name: 'Kontaktdaten' }));
  expect(client.saveProfile).toHaveBeenCalledTimes(1);
  expect(client.saveProfile).toHaveBeenCalledWith(contactBody(emptyContact()), expect.any(AbortSignal));
  expect(screen.queryByText('Ihre Kontaktdaten wurden gespeichert.')).not.toBeInTheDocument();
  await act(async () => finish(profile()));
  expect(screen.getByText('Ihre Kontaktdaten wurden gespeichert.')).toBeInTheDocument();
});

test('loads contact data preserving leading zeros, saves edits, and clears existing values with null', async () => {
  const client = adapter();
  client.getProfile.mockResolvedValue(profile('a', { ...contactBody(emptyContact()), firstName: 'Alex', postalCode: '01234' }));
  mount(client); await ready();
  expect(screen.getByLabelText('Postleitzahl:')).toHaveValue('01234');
  edit('Vorname:', ''); edit('Ort:', 'Hanau'); save();
  await screen.findByText('Ihre Kontaktdaten wurden gespeichert.');
  expect(client.saveProfile).toHaveBeenCalledWith({ ...contactBody(emptyContact()), postalCode: '01234', city: 'Hanau' }, expect.any(AbortSignal));
  expect(screen.getByLabelText('Vorname:')).toHaveValue('');
});

test.each([
  ['Vorname:', '<script>'], ['Nachname:', 'x'.repeat(101)], ['Straße:', 'x'.repeat(151)],
  ['Hausnummer:', '12<'], ['Postleitzahl:', '12/34'], ['Ort:', 'one\u0000two'],
])('invalid %s displays a field error without sending or losing the draft', async (label, value) => {
  const client = mount(); await ready(); edit(label, value); save();
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(label)).toHaveValue(value);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(client.saveProfile).not.toHaveBeenCalled();
});

test.each(['profile-validation', 'network', 'server', 'forbidden', 'rate-limited'] as const)('save %s preserves the draft and session; retry can succeed', async code => {
  const client = adapter(); client.saveProfile.mockRejectedValueOnce(new AuthError(code));
  mount(client); await ready(); edit('Ort:', 'Entwurf'); save();
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Ort:')).toHaveValue('Entwurf');
  expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:a');
  expect(screen.queryByText('Ihre Kontaktdaten wurden gespeichert.')).not.toBeInTheDocument();
  save(); await screen.findByText('Ihre Kontaktdaten wurden gespeichert.');
});

test('HTTP 401 during save hides all private fields and requires login', async () => {
  const client = adapter(); client.saveProfile.mockRejectedValueOnce(new AuthError('unauthorized'));
  mount(client); await ready(); save();
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('anonymous'));
  expect(screen.queryByLabelText('Vorname:')).not.toBeInTheDocument();
  expect(screen.getByTestId('notice')).toHaveTextContent('HTTP 401');
});

test('failed profile load cannot overwrite unknown server data and is retryable', async () => {
  const client = adapter(); client.getProfile.mockRejectedValueOnce(new AuthError('server'));
  mount(client); await screen.findByRole('button', { name: 'Kontaktdaten erneut laden' });
  expect(screen.getByRole('button', { name: 'Kontaktdaten speichern' })).toBeDisabled();
  expect(screen.getByLabelText('Vorname:')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Kontaktdaten erneut laden' }));
  await ready(); expect(client.getProfile).toHaveBeenCalledTimes(2);
});

test('profile responses for a different owner are rejected before display', async () => {
  const client = adapter(); client.getProfile.mockResolvedValue(profile('b', { ...contactBody(emptyContact()), firstName: 'PRIVATE_B' }));
  mount(client); await screen.findByRole('alert');
  expect(screen.queryByDisplayValue('PRIVATE_B')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kontaktdaten speichern' })).toBeDisabled();
});

test('account switch discards the old draft and ignores an old save success', async () => {
  const client = adapter();
  let finish!: (value: ContactProfile) => void;
  client.saveProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(client); await ready(); edit('Vorname:', 'PRIVATE_A'); save();
  client.getSession.mockResolvedValue(session('b'));
  client.getProfile.mockResolvedValue(profile('b'));
  fireEvent.click(screen.getByRole('button', { name: 'Session prüfen' })); await ready();
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:b'));
  await act(async () => finish(profile('a', { ...contactBody(emptyContact()), firstName: 'PRIVATE_A' })));
  expect(screen.getByLabelText('Vorname:')).toHaveValue('');
  expect(screen.queryByText('Ihre Kontaktdaten wurden gespeichert.')).not.toBeInTheDocument();
});

test('an old profile read failure cannot log a newly selected account out', async () => {
  const client = adapter();
  let reject!: (error: AuthError) => void;
  client.getProfile.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  mount(client); await screen.findByText('Kontaktdaten werden geladen…');
  client.getSession.mockResolvedValue(session('b')); client.getProfile.mockResolvedValue(profile('b'));
  fireEvent.click(screen.getByRole('button', { name: 'Session prüfen' })); await ready();
  await act(async () => reject(new AuthError('unauthorized')));
  expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:b');
  expect(screen.getByTestId('notice')).not.toHaveTextContent('HTTP 401');
});

test('save timeout preserves the draft and ignores late server success', async () => {
  jest.useFakeTimers();
  const client = adapter(); let finish!: (value: ContactProfile) => void;
  client.saveProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(client); await act(async () => { await Promise.resolve(); }); await ready();
  edit('Ort:', 'Entwurf'); save();
  await act(async () => { jest.advanceTimersByTime(15001); });
  expect(screen.getByLabelText('Ort:')).toHaveValue('Entwurf');
  expect(screen.getByRole('button', { name: 'Kontaktdaten speichern' })).toBeEnabled();
  await act(async () => finish(profile()));
  expect(screen.queryByText('Ihre Kontaktdaten wurden gespeichert.')).not.toBeInTheDocument();
  expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:a');
});

test('save response for another owner never claims success or displays their data', async () => {
  const client = adapter();
  client.saveProfile.mockResolvedValue(profile('b', { ...contactBody(emptyContact()), firstName: 'PRIVATE_B' }));
  mount(client); await ready(); edit('Vorname:', 'My draft'); save();
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Vorname:')).toHaveValue('My draft');
  expect(screen.queryByDisplayValue('PRIVATE_B')).not.toBeInTheDocument();
  expect(screen.queryByText('Ihre Kontaktdaten wurden gespeichert.')).not.toBeInTheDocument();
});

test('logout clears loaded private contact data', async () => {
  const client = adapter();
  client.getProfile.mockResolvedValue(profile('a', { ...contactBody(emptyContact()), firstName: 'PRIVATE_A' }));
  mount(client); await ready();
  expect(screen.getByLabelText('Vorname:')).toHaveValue('PRIVATE_A');
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('anonymous'));
  expect(screen.queryByDisplayValue('PRIVATE_A')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Vorname:')).not.toBeInTheDocument();
});

test('session expiry removes an unsaved contact draft', async () => {
  jest.useFakeTimers(); const client = adapter();
  client.getSession.mockResolvedValue({ ...session(), expiresAt: Date.now() + 5000 });
  mount(client); await act(async () => { await Promise.resolve(); }); await ready();
  edit('Ort:', 'PRIVATE_DRAFT');
  await act(async () => { jest.advanceTimersByTime(5001); });
  expect(screen.getByTestId('identity')).toHaveTextContent('anonymous');
  expect(screen.queryByDisplayValue('PRIVATE_DRAFT')).not.toBeInTheDocument();
});


test('additional contact fields load, validate and save through the same private endpoint', async () => {
  const client = adapter();
  client.getProfile.mockResolvedValue(profile('a', { ...contactBody(emptyContact()), countryCode: 'DE', phone: '+49 123', contactEmail: 'contact@example.com' }));
  mount(client); await ready();
  expect(screen.getByLabelText('Land (ISO-Code):')).toHaveValue('DE');
  expect(screen.getByLabelText('Telefon:')).toHaveValue('+49 123');
  expect(screen.getByLabelText('Kontakt-E-Mail:')).toHaveValue('contact@example.com');
  edit('Land (ISO-Code):', 'Germany'); save();
  expect(screen.getByLabelText('Land (ISO-Code):')).toHaveAttribute('aria-invalid', 'true');
  expect(client.saveProfile).not.toHaveBeenCalled();
  edit('Land (ISO-Code):', 'AT'); edit('Telefon:', ''); save();
  await screen.findByText('Ihre Kontaktdaten wurden gespeichert.');
  expect(client.saveProfile).toHaveBeenCalledWith(expect.objectContaining({countryCode: 'AT', phone: null, contactEmail: 'contact@example.com'}), expect.any(AbortSignal));
});


test('late account-list 401 from a previous identity cannot log out the current user', async () => {
  const client = adapter(); mount(client); await ready();
  let reject!: (error: AuthError) => void;
  client.listAccounts.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  fireEvent.click(screen.getByRole('button', {name: 'Konten neu laden'}));
  client.getSession.mockResolvedValue(session('b')); client.getProfile.mockResolvedValue(profile('b'));
  fireEvent.click(screen.getByRole('button', {name: /Session/}));
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:b'));
  await act(async () => reject(new AuthError('unauthorized')));
  expect(screen.getByTestId('identity')).toHaveTextContent('authenticated:b');
  expect(screen.getByTestId('notice')).not.toHaveTextContent('HTTP 401');
});
