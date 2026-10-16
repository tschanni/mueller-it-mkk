import { AuthError, createAuthClient, safeAuthMessage } from './client';
import { readAuthReturn } from './callbacks';

function response(value: unknown, status = 200, retryAfter?: string, retryHeader = 'X-Retry-After'): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => value,
    headers: { get: (name: string) => name === retryHeader ? retryAfter ?? null : null },
  } as unknown as Response;
}
const rawSession = () => ({
  user: { id: 'u1', name: 'Alex', username: 'alex_1', email: 'alex@example.com', emailVerified: true, role: 'ADMIN' },
  session: { id: 's1', userId: 'u1', token: 'SECRET_SESSION_TOKEN', ipAddress: 'PRIVATE_IP', expiresAt: new Date(Date.now() + 86400000).toISOString() },
});
function setup() {
  const fetcher = jest.fn(async () => response(null));
  const client = createAuthClient({ baseURL: 'https://api.mueller-it-mkk.de/games/api/v1/auth', frontendOrigin: 'https://www.mueller-it-mkk.de', fetch: fetcher });
  return { client, fetcher, signal: new AbortController().signal };
}
function lastRequest(fetcher: jest.Mock) { return fetcher.mock.calls[fetcher.mock.calls.length - 1] as [string, RequestInit]; }

test('session requests use cookies, no cache, no redirects and strip all sensitive session fields', async () => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response(rawSession()));
  const session = await client.getSession(signal);
  expect(session?.user).toEqual({ id: 'u1', email: 'alex@example.com', role: 'ADMIN', emailVerified: true, name: 'Alex' });
  expect(JSON.stringify(session)).not.toMatch(/SECRET_SESSION_TOKEN|PRIVATE_IP|s1|token/);
  expect(fetcher).toHaveBeenCalledWith('https://api.mueller-it-mkk.de/games/api/v1/auth/get-session', expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal }));
});

test('absent sessions are successful null responses and unknown roles are never ADMIN', async () => {
  const { client, fetcher, signal } = setup();
  expect(await client.getSession(signal)).toBeNull();
  const raw = rawSession(); raw.user.role = 'SUPERADMIN'; fetcher.mockResolvedValue(response(raw));
  expect((await client.getSession(signal))?.user.role).toBe('USER');
});

test('Discord display names come from user.name without a profile-completion requirement', async () => {
  const { client, fetcher, signal } = setup();
  fetcher.mockResolvedValue(response({ ...rawSession(), user: { ...rawSession().user, username: null } }));
  expect((await client.getSession(signal))?.user).toMatchObject({ name: 'Alex' });
});

test.each([
  {}, [], { user: {}, session: {} },
  { ...rawSession(), session: { ...rawSession().session, userId: 'another-user' } },
  { ...rawSession(), session: { ...rawSession().session, expiresAt: 'not a date' } },
])('rejects malformed session data', async value => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response(value));
  await expect(client.getSession(signal)).rejects.toMatchObject({ code: 'invalid-response' });
});

test('registration is blocked until a confirmed central-user backend contract exists', async () => {
  const { client, fetcher, signal } = setup();
  expect(client.registrationAvailable).toBe(false);
  await expect(client.signUp({ name: 'Alex', email: 'alex@example.com', password: 'long-password-123' }, signal)).rejects.toMatchObject({ code: 'contract-pending' });
  expect(fetcher).not.toHaveBeenCalled();
});

test('email login never returns or stores the token and sign-out sends an empty JSON body', async () => {
  const { client, fetcher, signal } = setup();
  fetcher.mockResolvedValueOnce(response({ redirect: false, token: 'SECRET', user: { id: 'u1' } }));
  expect(await client.signIn({ email: 'alex@example.com', password: 'long-password-123' }, signal)).toBeUndefined();
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ email: 'alex@example.com', password: 'long-password-123', rememberMe: true });
  fetcher.mockResolvedValueOnce(response({ success: true }));
  await client.signOut(signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/sign-out$/);
  expect(lastRequest(fetcher)[1].body).toBe('{}');
});

test('password-reset request, completion and email verification match the supplied contract', async () => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response({ status: true }));
  await client.requestPasswordReset('alex@example.com', signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/request-password-reset$/);
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ email: 'alex@example.com', redirectTo: 'https://www.mueller-it-mkk.de/reset-password' });
  await client.completePasswordReset!('single-use-token', 'new-long-password', signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/reset-password$/);
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ token: 'single-use-token', newPassword: 'new-long-password' });
  await client.sendVerificationEmail!('alex@example.com', signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/send-verification-email$/);
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ email: 'alex@example.com', callbackURL: 'https://www.mueller-it-mkk.de/auth/verified' });
});

test('Discord uses the fixed frontend callbacks and checks the returned provider URL', async () => {
  const { client, fetcher, signal } = setup();
  fetcher.mockResolvedValue(response({ url: 'https://discord.com/oauth2/authorize?state=opaque', redirect: true }));
  expect(await client.startDiscord('https://attacker.example', signal)).toMatch(/^https:\/\/discord.com\//);
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ provider: 'discord', callbackURL: 'https://www.mueller-it-mkk.de/auth/callback', errorCallbackURL: 'https://www.mueller-it-mkk.de/auth/error' });
  fetcher.mockResolvedValue(response({ url: 'https://discord.com.attacker.example', redirect: true }));
  await expect(client.startDiscord('', signal)).rejects.toMatchObject({ code: 'oauth' });
});

test('profile images are saved with cookie credentials through the existing update-user endpoint', async () => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response({ status: true }));
  await client.updateImage!('https://images.example.com/avatar.png', signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/update-user$/);
  expect(lastRequest(fetcher)[1]).toMatchObject({ method: 'POST', credentials: 'include' });
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ image: 'https://images.example.com/avatar.png' });
  await expect(client.updateImage!('http://images.example.com/avatar.png', signal)).rejects.toMatchObject({ code: 'image' });
  await expect(client.updateImage!('https://user:password@images.example.com/avatar.png', signal)).rejects.toMatchObject({ code: 'image' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('linked accounts use only documented paths, cookies, and account row IDs', async () => {
  const { client, fetcher, signal } = setup();
  fetcher.mockResolvedValueOnce(response([{ id: 'row-id', providerId: 'discord', accountId: 'discord-id', accessToken: 'NEVER_RETAIN', userId: 'u1', scopes: ['identify'] }]));
  expect(await client.listAccounts!(signal)).toEqual([{ id: 'row-id', providerId: 'discord', accountId: 'discord-id' }]);
  expect(lastRequest(fetcher)).toEqual([expect.stringMatching(/\/list-accounts$/), expect.objectContaining({ method: 'GET', credentials: 'include' })]);
  fetcher.mockResolvedValueOnce(response({ url: 'https://discord.com/oauth2/authorize?state=link', redirect: true }));
  expect(await client.linkDiscord!(signal)).toBe('https://discord.com/oauth2/authorize?state=link');
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ provider: 'discord', callbackURL: 'https://www.mueller-it-mkk.de/settings/accounts' });
  expect(lastRequest(fetcher)[0]).toMatch(/\/link-social$/);
  fetcher.mockResolvedValueOnce(response({ status: true }));
  await client.unlinkAccount!('row-id', signal);
  expect(lastRequest(fetcher)[0]).toMatch(/\/unlink-account$/);
  expect(JSON.parse(lastRequest(fetcher)[1].body as string)).toEqual({ accountId: 'row-id' });
  expect(lastRequest(fetcher)[1]).toMatchObject({ method: 'POST', credentials: 'include' });
});

test.each([{}, [{ id: 'row' }], [{ id: 'row', providerId: 'discord', accountId: 'd' }, { id: 'row', providerId: 'discord', accountId: 'd2' }]])('rejects invalid account lists', async value => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValueOnce(response(value));
  await expect(client.listAccounts!(signal)).rejects.toMatchObject({ code: 'invalid-response' });
});

test('server refusal to unlink the last account has a translated safe message', async () => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValueOnce(response({ code: 'FAILED_TO_UNLINK_LAST_ACCOUNT', message: 'PRIVATE_DETAILS' }, 400));
  const error = await client.unlinkAccount!('row-id', signal).catch(value => value);
  expect(error).toMatchObject({ code: 'last-account' });
  expect(safeAuthMessage(error)).toMatch(/letzte Anmeldekonto/);
  expect(safeAuthMessage(error)).not.toMatch(/PRIVATE_DETAILS/);
});

test.each(['45', new Date(Date.now() + 45000).toUTCString()])('also respects the standard Retry-After header: %s', async header => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValueOnce(response({}, 429, header, 'Retry-After'));
  const error = await client.signOut(signal).catch(value => value);
  expect(error).toMatchObject({ code: 'rate-limited' });
  expect(error.retryAt).toBeGreaterThan(Date.now() + 40000);
});

test.each([
  [401, 'INVALID_EMAIL_OR_PASSWORD', 'credentials'], [403, 'EMAIL_NOT_VERIFIED', 'verification'],
  [400, 'USERNAME_IS_ALREADY_TAKEN', 'username-taken'], [400, 'INVALID_TOKEN', 'token'],
  [401, 'SESSION_EXPIRED', 'expired'], [401, 'SESSION_NOT_FRESH', 'fresh-session'],
  [404, 'PROVIDER_NOT_FOUND', 'provider'], [400, 'PASSWORD_TOO_SHORT', 'password'],
  [400, 'INVALID_USERNAME', 'username'], [403, 'INVALID_ORIGIN', 'forbidden'],
  [422, 'FAILED_TO_CREATE_USER', 'request'], [500, 'AUTH_FAILED', 'server'],
  [400, 'constructor', 'request'],
])('maps HTTP %s / %s to safe error %s', async (http, code, expected) => {
  const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response({ code, message: 'SECRET_INTERNAL_ERROR' }, http as number));
  const error = await client.signIn({ email: 'a@b.de', password: 'secret' }, signal).catch(value => value);
  expect(error).toBeInstanceOf(AuthError);
  expect(error).toMatchObject({ code: expected });
  expect(safeAuthMessage(error)).not.toMatch(/SECRET/);
});

test('rate limits respect X-Retry-After and block repeat requests until the deadline', async () => {
  jest.useFakeTimers();
  try {
    const { client, fetcher, signal } = setup(); fetcher.mockResolvedValue(response({}, 429, '90'));
    await expect(client.signIn({ email: 'a@b.de', password: 'secret' }, signal)).rejects.toMatchObject({ code: 'rate-limited', retryAt: Date.now() + 90000 });
    await expect(client.signIn({ email: 'a@b.de', password: 'secret' }, signal)).rejects.toMatchObject({ code: 'rate-limited' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(90001);
    fetcher.mockResolvedValue(response({ redirect: false, token: 'unused', user: { id: 'u1' } }));
    await client.signIn({ email: 'a@b.de', password: 'secret' }, signal);
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test('local HTTP configuration is allowed only explicitly for development', () => {
  expect(() => createAuthClient({ baseURL: 'http://localhost:3001/api/v1/auth', frontendOrigin: 'http://localhost:3000' })).toThrow();
  expect(createAuthClient({ baseURL: 'http://localhost:3001/api/v1/auth/', frontendOrigin: 'http://localhost:3000', development: true }).configured).toBe(true);
  expect(() => createAuthClient({ baseURL: 'http://api.mueller-it-mkk.de/games/api/v1/auth', frontendOrigin: 'https://www.mueller-it-mkk.de', development: true })).toThrow();
  expect(() => createAuthClient({ baseURL: 'https://api.mueller-it-mkk.de/wrong', frontendOrigin: 'https://www.mueller-it-mkk.de' })).toThrow();
});

test('callback parsing handles only documented paths and does not expose raw error descriptions', () => {
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/auth/error?error=denied&error_description=SECRET'))).toEqual({ kind: 'oauth', failed: true });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/auth/callback/'))).toEqual({ kind: 'oauth', failed: false });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/settings/accounts?error=access_denied'))).toEqual({ kind: 'account', failed: true });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/auth/verified?error=INVALID_TOKEN'))).toEqual({ kind: 'verified', failed: true });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/reset-password?token=once'))).toEqual({ kind: 'reset', token: 'once' });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/reset-password?error=INVALID_TOKEN'))).toEqual({ kind: 'reset', token: null });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/reset-password?token=a&token=b'))).toEqual({ kind: 'reset', token: null });
  expect(readAuthReturn(new URL('https://www.mueller-it-mkk.de/?error=unrelated'))).toEqual({ kind: 'desktop' });
});

test('transport, server failure and HTTP 401 remain distinct', async () => {
  const { client, fetcher, signal } = setup();
  fetcher.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(client.getSession(signal)).rejects.toMatchObject({ code: 'network' });
  fetcher.mockResolvedValueOnce(response({ code: 'SESSION_EXPIRED' }, 503));
  await expect(client.getSession(signal)).rejects.toMatchObject({ code: 'server' });
  fetcher.mockResolvedValueOnce(response({}, 401));
  await expect(client.getSession(signal)).rejects.toMatchObject({ code: 'unauthorized' });
});
