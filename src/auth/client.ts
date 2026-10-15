/** Cookie-only Better Auth adapter for docs/AUTH_API_CONTRACT.md (1.7.10). */
import { profileImageURL } from './profileImageURL';
export type UserRole = 'USER' | 'ADMIN';
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  needsUsername?: boolean;
  emailVerified?: boolean;
  name?: string;
  image?: string | null;
}
export interface AuthSession {
  user: AuthUser;
  /** Absolute expiration in milliseconds, normalized from the backend. */
  expiresAt: number;
}
export interface LoginInput { email: string; password: string }
export interface RegistrationInput extends LoginInput { name: string; username: string }
export interface LinkedAccount { id: string; providerId: string; accountId: string }
export type RegistrationResult = 'session' | 'verify-email' | 'sign-in';
export type AuthErrorCode = 'not-configured' | 'credentials' | 'expired' | 'verification' |
  'rate-limited' | 'forbidden' | 'oauth' | 'network' | 'invalid-response' |
  'username' | 'username-taken' | 'password' | 'token' | 'fresh-session' | 'provider' | 'request' | 'last-account' | 'image';

const messages: Record<AuthErrorCode, string> = {
  'not-configured': 'Die Anmeldung ist noch nicht mit dem Server verbunden. Bitte später erneut versuchen.',
  credentials: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  verification: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
  'rate-limited': 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
  forbidden: 'Die Anfrage wurde abgelehnt. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
  oauth: 'Die Discord-Anmeldung wurde abgebrochen oder ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  network: 'Der Anmeldedienst ist nicht erreichbar. Bitte versuchen Sie es später erneut.',
  'invalid-response': 'Die Antwort des Anmeldedienstes konnte nicht überprüft werden.',
  username: 'Der Benutzername muss 3 bis 30 Zeichen lang sein und darf nur Buchstaben, Ziffern, Unterstriche und Punkte enthalten.',
  'username-taken': 'Dieser Benutzername ist bereits vergeben. Bitte wählen Sie einen anderen.',
  password: 'Das Passwort muss zwischen 12 und 128 Zeichen lang sein.',
  token: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie eine neue Nachricht an.',
  'fresh-session': 'Bitte melden Sie sich erneut an, um diese Aktion auszuführen.',
  provider: 'Die Discord-Anmeldung ist auf dem Server derzeit nicht eingerichtet.',
  request: 'Die Anfrage konnte nicht ausgeführt werden. Bitte versuchen Sie es erneut.',
  'last-account': 'Das letzte Anmeldekonto kann nicht entfernt werden. Richten Sie zuerst eine weitere Anmeldemöglichkeit ein.',
  image: 'Bitte geben Sie eine gültige HTTPS-Bildadresse ohne Zugangsdaten ein.',
};
export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode, public readonly retryAt?: number) { super(messages[code]); }
}
export function safeAuthMessage(error: unknown): string {
  if (error instanceof AuthError && error.code === 'rate-limited' && error.retryAt) {
    return `Zu viele Versuche. Bitte versuchen Sie es in ${Math.max(1, Math.ceil((error.retryAt - Date.now()) / 1000))} Sekunden erneut.`;
  }
  return error instanceof AuthError ? messages[error.code] : messages.network;
}
export interface AuthAdapter {
  readonly configured: boolean;
  /** Static allowlist from the confirmed backend/provider configuration. */
  readonly redirectOrigins: readonly string[];
  readonly passwordPolicy?: { minLength: number; maxLength: number };
  getSession(signal: AbortSignal): Promise<AuthSession | null>;
  signIn(input: LoginInput, signal: AbortSignal): Promise<void>;
  signUp(input: RegistrationInput, signal: AbortSignal): Promise<RegistrationResult>;
  signOut(signal: AbortSignal): Promise<void>;
  requestPasswordReset(email: string, signal: AbortSignal): Promise<void>;
  startDiscord(returnURL: string, signal: AbortSignal): Promise<string>;
  completePasswordReset?(token: string, newPassword: string, signal: AbortSignal): Promise<void>;
  sendVerificationEmail?(email: string, signal: AbortSignal): Promise<void>;
  updateUsername?(username: string, signal: AbortSignal): Promise<void>;
  updateImage?(image: string, signal: AbortSignal): Promise<void>;
  listAccounts?(signal: AbortSignal): Promise<LinkedAccount[]>;
  linkDiscord?(signal: AbortSignal): Promise<string>;
  unlinkAccount?(accountId: string, signal: AbortSignal): Promise<void>;
}
const unavailable = async (): Promise<never> => { throw new AuthError('not-configured'); };
/** Fail closed: no guessed endpoints, no mock login, no auth network requests. */
export const unconfiguredAuthClient: AuthAdapter = {
  configured: false,
  redirectOrigins: [],
  getSession: unavailable,
  signIn: unavailable,
  signUp: unavailable,
  signOut: unavailable,
  requestPasswordReset: unavailable,
  startDiscord: unavailable,
};

export function checkedSession(value: AuthSession | null): AuthSession | null {
  if (value === null) return null;
  if (!value || !value.user || typeof value.user.id !== 'string' || !value.user.id ||
      typeof value.user.username !== 'string' || !value.user.username || typeof value.user.email !== 'string' ||
      !Number.isFinite(value.expiresAt)) throw new AuthError('invalid-response');
  if (value.expiresAt <= Date.now()) return null;
  // Unknown or future roles never grant administrative UI privileges.
  return { expiresAt: value.expiresAt, user: {
    id: value.user.id, username: value.user.username, email: value.user.email,
    role: value.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    needsUsername: value.user.needsUsername === true,
    emailVerified: value.user.emailVerified === true,
    ...(typeof value.user.name === 'string' ? { name: value.user.name } : {}),
    ...(typeof value.user.image === 'string' ? { image: profileImageURL(value.user.image) } : {}),
  } };
}
export function checkedRedirect(value: string, allowedOrigins: readonly string[]): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AuthError('oauth'); }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedOrigins.includes(url.origin)) {
    throw new AuthError('oauth');
  }
  return url.href;
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const codes: Record<string, AuthErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: 'credentials', SESSION_EXPIRED: 'expired', SESSION_NOT_FRESH: 'fresh-session',
  EMAIL_NOT_VERIFIED: 'verification', INVALID_ORIGIN: 'forbidden', MISSING_OR_NULL_ORIGIN: 'forbidden',
  INVALID_CALLBACK_URL: 'forbidden', INVALID_REDIRECT_URL: 'forbidden', FIELD_NOT_ALLOWED: 'forbidden',
  USERNAME_REQUIRED: 'username', INVALID_USERNAME: 'username', USERNAME_TOO_SHORT: 'username', USERNAME_TOO_LONG: 'username',
  USERNAME_IS_ALREADY_TAKEN: 'username-taken', PASSWORD_TOO_SHORT: 'password', PASSWORD_TOO_LONG: 'password',
  INVALID_TOKEN: 'token', TOKEN_EXPIRED: 'token', PROVIDER_NOT_FOUND: 'provider',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'last-account',
};
function safeOrigin(value: string, development: boolean): string {
  const url = new URL(value);
  const local = development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) throw new AuthError('not-configured');
  return url.origin;
}
export function createAuthClient(options: { baseURL: string; frontendOrigin: string; development?: boolean; fetch?: typeof fetch }): AuthAdapter {
  const development = options.development === true;
  const base = new URL(options.baseURL);
  safeOrigin(options.baseURL, development);
  base.pathname = base.pathname.replace(/\/+$/, '');
  const frontendOrigin = safeOrigin(options.frontendOrigin, development);
  if (new URL(options.frontendOrigin).pathname !== '/' || !base.pathname.endsWith('/api/v1/auth')) throw new AuthError('not-configured');
  const cooldowns = new Map<string, number>();
  const callback = (path: string) => new URL(path, frontendOrigin).href;
  async function request(path: string, signal: AbortSignal, body?: JsonObject): Promise<unknown> {
    const retryAt = cooldowns.get(path);
    if (retryAt && retryAt > Date.now()) throw new AuthError('rate-limited', retryAt);
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)(base.href + '/' + path, {
        method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
        headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new AuthError('network'); }
    // Read only an allowlisted code on failure. Never propagate messages or tokens.
    const value: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      if (response.status === 429) {
        const retry = response.headers.get('X-Retry-After') ?? response.headers.get('Retry-After');
        const seconds = retry === null ? 60 : /^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000;
        const until = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
        cooldowns.set(path, until);
        throw new AuthError('rate-limited', until);
      }
      const code = object(value) && typeof value.code === 'string' && Object.prototype.hasOwnProperty.call(codes, value.code) ? codes[value.code] : undefined;
      throw new AuthError(code ?? (response.status === 401 && path !== 'sign-in/email' ? 'expired' : response.status === 403 ? 'forbidden' : response.status >= 500 ? 'network' : 'request'));
    }
    return value;
  }
  async function status(path: string, signal: AbortSignal, body: JsonObject) {
    const value = await request(path, signal, body);
    if (!object(value) || value.status !== true) throw new AuthError('invalid-response');
  }
  return {
    configured: true, redirectOrigins: ['https://discord.com'], passwordPolicy: { minLength: 12, maxLength: 128 },
    async getSession(signal) {
      const value = await request('get-session', signal);
      if (value === null) return null;
      if (!object(value) || !object(value.user) || !object(value.session)) throw new AuthError('invalid-response');
      const { user, session } = value;
      if (typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' ||
          session.userId !== user.id || typeof session.expiresAt !== 'string' ||
          (user.username != null && typeof user.username !== 'string')) throw new AuthError('invalid-response');
      const username = typeof user.username === 'string' && user.username ? user.username :
        typeof user.name === 'string' && user.name ? user.name : 'Benutzer';
      return checkedSession({ user: {
        id: user.id, email: user.email, username, role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        needsUsername: !user.username, emailVerified: user.emailVerified === true,
        ...(typeof user.name === 'string' ? { name: user.name } : {}),
        ...(typeof user.image === 'string' ? { image: user.image } : {}),
      }, expiresAt: Date.parse(session.expiresAt) });
    },
    async signIn(input, signal) {
      const value = await request('sign-in/email', signal, { email: input.email, password: input.password, rememberMe: true });
      if (!object(value) || value.redirect !== false || !object(value.user)) throw new AuthError('invalid-response');
    },
    async signUp(input, signal) {
      const value = await request('sign-up/email', signal, {
        name: input.name.trim(), username: input.username.trim().toLowerCase(), email: input.email, password: input.password,
        callbackURL: callback('/auth/verified'),
      });
      if (!object(value) || value.token !== null || !object(value.user)) throw new AuthError('invalid-response');
      return 'verify-email';
    },
    async signOut(signal) {
      const value = await request('sign-out', signal, {});
      if (!object(value) || value.success !== true) throw new AuthError('invalid-response');
    },
    requestPasswordReset: (email, signal) => status('request-password-reset', signal, { email, redirectTo: callback('/reset-password') }),
    completePasswordReset: (token, newPassword, signal) => status('reset-password', signal, { token, newPassword }),
    sendVerificationEmail: (email, signal) => status('send-verification-email', signal, { email, callbackURL: callback('/auth/verified') }),
    updateUsername: (username, signal) => status('update-user', signal, { username: username.trim().toLowerCase() }),
    async updateImage(image, signal) {
      const url = profileImageURL(image);
      if (!url) throw new AuthError('image');
      await status('update-user', signal, { image: url });
    },
    async listAccounts(signal) {
      const value = await request('list-accounts', signal);
      if (!Array.isArray(value) || value.some(account => !object(account) || typeof account.id !== 'string' || !account.id ||
          typeof account.providerId !== 'string' || !account.providerId || typeof account.accountId !== 'string')) throw new AuthError('invalid-response');
      const accounts: LinkedAccount[] = value.map(account => ({ id: account.id, providerId: account.providerId, accountId: account.accountId }));
      if (new Set(accounts.map(account => account.id)).size !== accounts.length) throw new AuthError('invalid-response');
      return accounts;
    },
    async linkDiscord(signal) {
      const value = await request('link-social', signal, { provider: 'discord', callbackURL: callback('/settings/accounts') });
      if (!object(value) || value.redirect !== true || typeof value.url !== 'string') throw new AuthError('invalid-response');
      return checkedRedirect(value.url, ['https://discord.com']);
    },
    unlinkAccount: (accountId, signal) => status('unlink-account', signal, { accountId }),
    async startDiscord(_returnURL, signal) {
      const value = await request('sign-in/social', signal, { provider: 'discord',
        callbackURL: callback('/auth/callback'), errorCallbackURL: callback('/auth/error'),
      });
      if (!object(value) || value.redirect !== true || typeof value.url !== 'string') throw new AuthError('invalid-response');
      return checkedRedirect(value.url, ['https://discord.com']);
    },
  };
}
function configuredClient(): AuthAdapter {
  try {
    const local = process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost';
    return createAuthClient({
      baseURL: process.env.REACT_APP_AUTH_API_BASE_URL || (local ? 'http://localhost:3001/api/v1/auth' : 'https://api.mueller-it-mkk.de/games/api/v1/auth'),
      frontendOrigin: window.location.origin, development: process.env.NODE_ENV !== 'production',
    });
  } catch { return unconfiguredAuthClient; }
}
export const authClient = configuredClient();
