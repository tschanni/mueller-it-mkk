/** Cookie-only Better Auth adapter for docs/AUTH_API_CONTRACT.md (1.7.10). */
import { ContactInput, ContactProfile, contactFields, validUsername, usernameHint } from './contactProfile';
import { profileImageURL } from './profileImageURL';
import { createRegistrationRecovery, RegistrationRecovery } from './registrationRecovery';
export type UserRole = 'USER' | 'MAINTAINER' | 'ADMIN';
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerified?: boolean;
  name: string;
  image?: string | null;
}
export interface AuthSession {
  user: AuthUser;
  /** Absolute expiration in milliseconds, normalized from the backend. */
  expiresAt: number;
}
export interface LoginInput { email: string; password: string }
export interface RegistrationInput extends LoginInput { name: string }
export interface LinkedAccount { id: string; providerId: string; accountId: string }
export type RegistrationResult = 'session' | 'verify-email' | 'sign-in';
export type AuthErrorCode = 'not-configured' | 'credentials' | 'expired' | 'verification' |
  'server' | 'unauthorized' | 'contract-pending' | 'rate-limited' | 'forbidden' | 'oauth' | 'network' | 'invalid-response' |
  'username' | 'profile-validation' | 'email-delivery' | 'password' | 'token' | 'fresh-session' | 'provider' | 'request' | 'last-account' | 'registration-uncertain';

const messages: Record<AuthErrorCode, string> = {
  'registration-uncertain': 'Wir konnten das Ergebnis deiner Registrierung nicht eindeutig bestätigen. Bitte prüfe dein E-Mail-Postfach und registriere dich nicht sofort erneut.',
  'not-configured': 'Die Anmeldung ist noch nicht mit dem Server verbunden. Bitte später erneut versuchen.',
  server: 'Der Anmeldedienst meldet einen Serverfehler. Bitte versuchen Sie es später erneut.',
  unauthorized: 'Der Server hat die Anmeldung nicht bestätigt (HTTP 401). Bitte melden Sie sich erneut an.',
  'contract-pending': 'Die Registrierung wird auf das neue Benutzermodell umgestellt und ist derzeit nicht verfügbar.',
  credentials: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  verification: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
  'rate-limited': 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
  forbidden: 'Die Anfrage wurde abgelehnt. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
  oauth: 'Die Discord-Anmeldung wurde abgebrochen oder ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  network: 'Der Anmeldedienst ist nicht erreichbar. Bitte versuchen Sie es später erneut.',
  'invalid-response': 'Die Antwort des Anmeldedienstes konnte nicht überprüft werden.',
  username: usernameHint,
  'profile-validation': 'Die Kontaktdaten wurden nicht gespeichert. Bitte pr\u00fcfen Sie die Eingaben und versuchen Sie es erneut.',
  'email-delivery': 'Die E-Mail konnte derzeit nicht versendet werden. Ihr Konto kann bereits angelegt sein. Bitte fordern Sie sp\u00e4ter eine neue Best\u00e4tigungsmail an.',
  password: 'Das Passwort muss zwischen 12 und 128 Zeichen lang sein.',
  token: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie eine neue Nachricht an.',
  'fresh-session': 'Bitte melden Sie sich erneut an, um diese Aktion auszuführen.',
  provider: 'Die Discord-Anmeldung ist auf dem Server derzeit nicht eingerichtet.',
  request: 'Die Anfrage konnte nicht ausgeführt werden. Bitte versuchen Sie es erneut.',
  'last-account': 'Das letzte Anmeldekonto kann nicht entfernt werden. Richten Sie zuerst eine weitere Anmeldemöglichkeit ein.',
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
  createRegistrationRecovery?(): RegistrationRecovery;
  readonly configured: boolean;
  /** Enabled only once the central-user contract and backend commit are confirmed. */
  readonly registrationAvailable?: boolean;
  /** Static allowlist from the confirmed backend/provider configuration. */
  readonly redirectOrigins: readonly string[];
  readonly passwordPolicy?: { minLength: number; maxLength: number };
  uploadProfileImage?(file: File, signal: AbortSignal): Promise<string>;
  getSession(signal: AbortSignal): Promise<AuthSession | null>;
  signIn(input: LoginInput, signal: AbortSignal): Promise<void>;
  signUp(input: RegistrationInput, signal: AbortSignal): Promise<RegistrationResult>;
  signOut(signal: AbortSignal): Promise<void>;
  requestPasswordReset(email: string, signal: AbortSignal): Promise<void>;
  startDiscord(returnURL: string, signal: AbortSignal): Promise<string>;
  completePasswordReset?(token: string, newPassword: string, signal: AbortSignal): Promise<void>;
  sendVerificationEmail?(email: string, signal: AbortSignal): Promise<void>;
  getProfile?(signal: AbortSignal): Promise<ContactProfile | null>;
  saveProfile?(input: ContactInput, signal: AbortSignal): Promise<ContactProfile>;
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
      typeof value.user.name !== 'string' || !value.user.name.trim() || typeof value.user.email !== 'string' ||
      !Number.isFinite(value.expiresAt)) throw new AuthError('invalid-response');
  if (value.expiresAt <= Date.now()) return null;
  // Unknown or future roles never grant administrative UI privileges.
  return { expiresAt: value.expiresAt, user: {
    id: value.user.id, email: value.user.email,
    role: value.user.role === 'ADMIN' || value.user.role === 'MAINTAINER' ? value.user.role : 'USER',
    emailVerified: value.user.emailVerified === true,
    name: value.user.name,
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
  PASSWORD_TOO_SHORT: 'password', PASSWORD_TOO_LONG: 'password',
  INVALID_TOKEN: 'token', TOKEN_EXPIRED: 'token', PROVIDER_NOT_FOUND: 'provider',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'last-account', EMAIL_DELIVERY_FAILED: 'email-delivery',
};
function checkedProfile(value: unknown): ContactProfile {
  if (!object(value) || typeof value.userId !== 'string' || !value.userId ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw new AuthError('invalid-response');
  const profile = { userId: value.userId, updatedAt: value.updatedAt } as ContactProfile;
  for (const { key } of contactFields) {
    if (value[key] !== null && typeof value[key] !== 'string') throw new AuthError('invalid-response');
    profile[key] = value[key] as string | null;
  }
  return profile;
}
function safeOrigin(value: string, development: boolean): string {
  const url = new URL(value);
  const local = development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) throw new AuthError('not-configured');
  return url.origin;
}
export function createAuthClient(options: { baseURL: string; frontendOrigin: string; development?: boolean; fetch?: typeof fetch; profileImageUploadURL?: string }): AuthAdapter {
  const development = options.development === true;
  const base = new URL(options.baseURL);
  safeOrigin(options.baseURL, development);
  base.pathname = base.pathname.replace(/\/+$/, '');
  const frontendOrigin = safeOrigin(options.frontendOrigin, development);
  if (new URL(options.frontendOrigin).pathname !== '/' || !base.pathname.endsWith('/api/v1/auth')) throw new AuthError('not-configured');
  const cooldowns = new Map<string, number>();
  const callback = (path: string) => new URL(path, frontendOrigin).href;
  async function request(path: string, signal: AbortSignal, body?: JsonObject, profileRequest = false): Promise<unknown> {
    const retryAt = cooldowns.get(path);
    if (retryAt && retryAt > Date.now()) throw new AuthError('rate-limited', retryAt);
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)((profileRequest ? base.href.replace(/\/auth$/, '') : base.href) + '/' + path, {
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
      if (response.status === 503 && object(value) && value.code === 'EMAIL_DELIVERY_FAILED') throw new AuthError('email-delivery');
      if (response.status >= 500) throw new AuthError('server');
      if (profileRequest && response.status === 400) throw new AuthError('profile-validation');
      const code = object(value) && typeof value.code === 'string' && Object.prototype.hasOwnProperty.call(codes, value.code) ? codes[value.code] : undefined;
      throw new AuthError(code ?? (response.status === 401 ? (path === 'sign-in/email' ? 'credentials' : 'unauthorized') : response.status === 403 ? 'forbidden' : 'request'));
    }
    return value;
  }
  async function status(path: string, signal: AbortSignal, body: JsonObject) {
    const value = await request(path, signal, body);
    if (!object(value) || value.status !== true) throw new AuthError('invalid-response');
  }
  return {
    ...(options.profileImageUploadURL ? {
      async uploadProfileImage(file: File, signal: AbortSignal) {
        const target = new URL(options.profileImageUploadURL!);
        if (target.origin !== base.origin || target.username || target.password || target.hash || target.search) throw new AuthError('not-configured');
        const body = new FormData(); body.append('image', file);
        let response: Response;
        try { response = await (options.fetch ?? fetch)(target.href, { method: 'POST', credentials: 'include', redirect: 'error', cache: 'no-store', body, signal }); }
        catch { throw new AuthError('network'); }
        if (!response.ok) throw new AuthError(response.status === 401 ? 'unauthorized' : response.status >= 500 ? 'server' : 'request');
        const value: unknown = await response.json().catch(() => null);
        const image = object(value) ? profileImageURL(value.image) : null;
        if (!image) throw new AuthError('invalid-response');
        return image;
      },
    } : {}),
    configured: true, redirectOrigins: ['https://discord.com'], passwordPolicy: { minLength: 12, maxLength: 128 },
    async getSession(signal) {
      const value = await request('get-session', signal);
      if (value === null) return null;
      if (!object(value) || !object(value.user) || !object(value.session)) throw new AuthError('invalid-response');
      const { user, session } = value;
      if (typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' ||
          session.userId !== user.id || typeof session.expiresAt !== 'string') throw new AuthError('invalid-response');
      if (typeof user.name !== 'string' || !user.name.trim()) throw new AuthError('invalid-response');
      return checkedSession({ user: {
        id: user.id, email: user.email, role: user.role === 'ADMIN' || user.role === 'MAINTAINER' ? user.role : 'USER',
        emailVerified: user.emailVerified === true,
        name: user.name,
        ...(typeof user.image === 'string' ? { image: user.image } : {}),
      }, expiresAt: Date.parse(session.expiresAt) });
    },
    async signIn(input, signal) {
      const value = await request('sign-in/email', signal, { email: input.email, password: input.password, rememberMe: true });
      if (!object(value) || value.redirect !== false || !object(value.user)) throw new AuthError('invalid-response');
    },
    registrationAvailable: true,
    createRegistrationRecovery: () => createRegistrationRecovery(base.href.replace(/\/auth$/, ''), options.fetch ?? fetch),
    async signUp(input, signal) {
      if (!validUsername(input.name)) throw new AuthError('username');
      const recovery = createRegistrationRecovery(base.href.replace(/\/auth$/, ''), options.fetch ?? fetch);
      try {
        const result = await recovery.start(input, signal);
        if (result.state !== 'SUCCESS') throw new AuthError(result.state === 'UNCERTAIN' ? 'registration-uncertain' : 'request');
        return 'verify-email';
      } finally { recovery.dispose(); }
    },
    async signOut(signal) {
      const value = await request('sign-out', signal, {});
      if (!object(value) || value.success !== true) throw new AuthError('invalid-response');
    },
    requestPasswordReset: (email, signal) => status('request-password-reset', signal, { email, redirectTo: callback('/reset-password') }),
    completePasswordReset: (token, newPassword, signal) => status('reset-password', signal, { token, newPassword }),
    sendVerificationEmail: (email, signal) => status('send-verification-email', signal, { email, callbackURL: callback('/auth/verified') }),
    async getProfile(signal) {
      const value = await request('me/profile', signal, undefined, true);
      if (!object(value)) throw new AuthError('invalid-response');
      return value.profile === null ? null : checkedProfile(value.profile);
    },
    async saveProfile(input, signal) {
      // Allowlist documented contact fields; never forward identity or authorization fields.
      const body: JsonObject = {};
      for (const { key } of contactFields) body[key] = input[key];
      return checkedProfile(await request('me/profile', signal, body, true));
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
      profileImageUploadURL: process.env.REACT_APP_PROFILE_IMAGE_UPLOAD_URL,
      frontendOrigin: window.location.origin, development: process.env.NODE_ENV !== 'production',
    });
  } catch { return unconfiguredAuthClient; }
}
export const authClient = configuredClient();
