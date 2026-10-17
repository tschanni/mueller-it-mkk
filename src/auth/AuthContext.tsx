import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthAdapter, AuthError, AuthSession, LinkedAccount, LoginInput, RegistrationInput, authClient, checkedRedirect, checkedSession, safeAuthMessage } from './client';
import { ContactInput, ContactProfile } from './contactProfile';
import { readAuthReturn } from './callbacks';

type Status = 'loading' | 'anonymous' | 'authenticated' | 'unavailable';
export type NoticeKind = 'success' | 'warning' | 'error' | 'info';
export interface AuthNotice { id: number; title: string; text: string; kind: NoticeKind }
interface AuthState {
  session: AuthSession | null;
  status: Status;
  busy: boolean;
  configured: boolean;
  registrationAvailable: boolean;
  passwordPolicy: AuthAdapter['passwordPolicy'];
  notice: AuthNotice | null;
  notify: (text: string, title?: string, kind?: NoticeKind) => void;
  dismissNotice: () => void;
  login: (input: LoginInput) => Promise<boolean>;
  register: (input: RegistrationInput) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  discord: () => Promise<boolean>;
  refresh: () => Promise<void>;
  entryWindow: 'auth-login' | 'auth-new-password' | 'auth-account' | null;
  hasResetToken: boolean;
  completePasswordReset: (password: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
  getProfile: (signal: AbortSignal) => Promise<ContactProfile | null>;
  saveProfile: (input: ContactInput, signal: AbortSignal) => Promise<ContactProfile>;
  listAccounts: (signal: AbortSignal) => Promise<LinkedAccount[]>;
  linkDiscord: () => Promise<boolean>;
  unlinkAccount: (accountId: string) => Promise<boolean>;
  reauthentication: number | null;
}
const Context = createContext<AuthState | null>(null);
const navigate = (url: string) => window.location.assign(url);
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new AuthError('network'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function AuthProvider({ children, adapter = authClient, redirect = navigate }: {
  children: React.ReactNode;
  adapter?: AuthAdapter;
  redirect?: (url: string) => void;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<Status>(adapter.configured ? 'loading' : 'unavailable');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [reauthentication, setReauthentication] = useState<number | null>(null);
  const reauthenticationId = useRef(0);
  const [entry] = useState(() => {
    const value = readAuthReturn(new URL(window.location.href));
    return value.kind === 'reset' ? { kind: 'reset' as const, hasToken: !!value.token } : value;
  });
  const [resetToken, setResetToken] = useState(() => {
    const value = readAuthReturn(new URL(window.location.href));
    return value.kind === 'reset' ? value.token : null;
  });
  const [entryWindow, setEntryWindow] = useState<AuthState['entryWindow']>(null);
  const returnHandled = useRef(false);
  const oauthChecked = useRef(false);
  const noticeId = useRef(0);
  const current = useRef<AuthSession | null>(null);
  const mounted = useRef(false);
  const identityVersion = useRef(0);
  const revision = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const restoring = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => { revision.current++; }, []);
  const notify = useCallback((text: string, title = 'Anmeldung', kind: NoticeKind = 'info') => {
    setNotice({ id: ++noticeId.current, text, title, kind });
  }, []);
  const apply = useCallback((value: AuthSession | null) => {
    if (current.current?.user.id !== value?.user.id) identityVersion.current++;
    current.current = value;
    setSession(value); setStatus(value ? 'authenticated' : 'anonymous');
  }, []);
  const refresh = useCallback(async () => {
    if (!adapter.configured || operation.current || restoring.current) return;
    const abort = new AbortController();
    restoring.current = abort;
    const version = revision.current;
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const result = checkedSession(await abortable(adapter.getSession(abort.signal), abort.signal));
      if (!mounted.current || abort.signal.aborted || version !== revision.current) return;
      if (current.current && !result) notify(new AuthError('expired').message, 'Sitzung beendet', 'warning');
      apply(result);
      if (entry.kind === 'oauth' && !entry.failed && !oauthChecked.current) {
        oauthChecked.current = true;
        if (!result) { setEntryWindow('auth-login'); notify(new AuthError('oauth').message, 'Discord-Anmeldung', 'error'); }
      }
    } catch (error) {
      if (!mounted.current || version !== revision.current) return;
      const rejected = error instanceof AuthError && ['expired', 'unauthorized'].includes(error.code);
      if (rejected) { apply(null); setEntryWindow('auth-login'); }
      else setStatus(current.current ? 'authenticated' : 'unavailable');
      notify(safeAuthMessage(error), 'Sitzungsprüfung', rejected ? 'warning' : 'error');
      if (entry.kind === 'oauth' && !entry.failed && !oauthChecked.current) {
        oauthChecked.current = true; setEntryWindow('auth-login'); notify(safeAuthMessage(error), 'Anfrage fehlgeschlagen', error instanceof AuthError && ['expired', 'unauthorized', 'verification', 'rate-limited', 'fresh-session', 'contract-pending'].includes(error.code) ? 'warning' : 'error');
      }
    } finally {
      clearTimeout(timer);
      if (restoring.current === abort) restoring.current = null;
    }
  }, [adapter, apply, notify, entry]);

  useEffect(() => {
    mounted.current = true;
    if (!returnHandled.current) {
      returnHandled.current = true;
      if (entry.kind !== 'desktop') window.history.replaceState(null, '', '/');
      if (entry.kind === 'oauth' && entry.failed) {
        setEntryWindow('auth-login');
        notify(entry.verificationRequired ? 'Bitte best\u00e4tigen Sie zuerst Ihre E-Mail-Adresse. Starten Sie danach die Discord-Anmeldung erneut.' : new AuthError('oauth').message, 'Discord-Anmeldung', entry.verificationRequired ? 'warning' : 'error');
      }
      if (entry.kind === 'verified') {
        setEntryWindow('auth-login');
        notify(entry.failed ? new AuthError('token').message : 'Ihre E-Mail-Adresse wurde bestätigt. Sie können sich jetzt anmelden.', 'E-Mail-Bestätigung', entry.failed ? 'error' : 'success');
      }
      if (entry.kind === 'reset') {
        setEntryWindow(entry.hasToken ? 'auth-new-password' : 'auth-login');
        if (!entry.hasToken) notify(new AuthError('token').message, 'Link abgelaufen', 'warning');
      }
      if (entry.kind === 'account') {
        setEntryWindow('auth-account');
        if (entry.failed) notify('Das Discord-Konto konnte nicht verknüpft werden. Bitte versuchen Sie es erneut.', 'Mein Konto', 'error');
      }
    }
    void refresh();
    const visible = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const interval = setInterval(visible, 60000);
    return () => {
      mounted.current = false; invalidate();
      operation.current?.abort(); restoring.current?.abort(); restoring.current = null;
      clearInterval(interval);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [adapter, refresh, notify, invalidate, entry]);

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const remaining = session.expiresAt - Date.now();
      if (remaining > 0) { timer = setTimeout(expire, Math.min(remaining, 2147483647)); return; }
      invalidate(); restoring.current?.abort(); restoring.current = null;
      apply(null); notify(new AuthError('expired').message, 'Sitzung beendet', 'warning');
    };
    timer = setTimeout(expire, Math.min(Math.max(0, session.expiresAt - Date.now()), 2147483647));
    return () => clearTimeout(timer);
  }, [session, apply, notify, invalidate]);

  const handleFailure = useCallback((error: unknown) => {
    if (error instanceof AuthError && ['expired', 'unauthorized'].includes(error.code)) { apply(null); setEntryWindow('auth-login'); }
    if (error instanceof AuthError && error.code === 'fresh-session') setReauthentication(++reauthenticationId.current);
    if (error instanceof AuthError && error.code === 'token') { setResetToken(null); setEntryWindow('auth-login'); }
    notify(safeAuthMessage(error), 'Anfrage fehlgeschlagen', error instanceof AuthError && ['expired', 'unauthorized', 'verification', 'rate-limited', 'fresh-session', 'contract-pending'].includes(error.code) ? 'warning' : 'error');
  }, [apply, notify]);
  const listAccounts = useCallback(async (signal: AbortSignal) => {
    const version = identityVersion.current;
    try {
      if (!adapter.listAccounts) throw new AuthError('not-configured');
      const result = await abortable(adapter.listAccounts(signal), signal);
      if (version !== identityVersion.current) throw new AuthError('network');
      return result;
    } catch (error) {
      if (mounted.current && !signal.aborted && version === identityVersion.current) handleFailure(error);
      throw error;
    }
  }, [adapter, handleFailure]);

  const profileRequest = useCallback(async <T,>(signal: AbortSignal, action: () => Promise<T>): Promise<T> => {
    const owner = current.current;
    const version = identityVersion.current;
    try {
      if (!owner || owner.expiresAt <= Date.now()) throw new AuthError('expired');
      if (!owner.user.emailVerified) throw new AuthError('verification');
      const result = await abortable(action(), signal);
      if (!mounted.current || signal.aborted || version !== identityVersion.current) throw new AuthError('network');
      return result;
    } catch (error) {
      if (mounted.current && !signal.aborted && version === identityVersion.current) handleFailure(error);
      throw error;
    }
  }, [handleFailure]);
  const getProfile = useCallback((signal: AbortSignal) => profileRequest(signal, async () => {
    if (!adapter.getProfile) throw new AuthError('not-configured');
    const userId = current.current!.user.id;
    const profile = await adapter.getProfile(signal);
    if (profile && profile.userId !== userId) throw new AuthError('invalid-response');
    return profile;
  }), [adapter, profileRequest]);
  const saveProfile = useCallback((input: ContactInput, signal: AbortSignal) => profileRequest(signal, async () => {
    if (!adapter.saveProfile) throw new AuthError('not-configured');
    const userId = current.current!.user.id;
    const profile = await adapter.saveProfile(input, signal);
    if (profile.userId !== userId) throw new AuthError('invalid-response');
    return profile;
  }), [adapter, profileRequest]);

  async function run(action: (signal: AbortSignal) => Promise<void>): Promise<boolean> {
    if (operation.current) return false;
    if (!adapter.configured) { notify(new AuthError('not-configured').message); return false; }
    const abort = new AbortController();
    operation.current = abort; revision.current++;
    restoring.current?.abort(); restoring.current = null;
    setBusy(true);
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      await abortable(action(abort.signal), abort.signal);
      return !abort.signal.aborted && mounted.current;
    } catch (error) {
      if (mounted.current) {
        handleFailure(error);
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (operation.current === abort) operation.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const acceptSession = async (signal: AbortSignal) => {
    const value = checkedSession(await adapter.getSession(signal));
    if (!mounted.current || signal.aborted) return;
    if (!value) throw new AuthError('invalid-response');
    apply(value);
  };
  return <Context.Provider value={{
    session, status, busy, configured: adapter.configured, registrationAvailable: adapter.registrationAvailable === true, passwordPolicy: adapter.passwordPolicy,
    notice, notify, dismissNotice: () => setNotice(null), refresh,
    login: input => run(async signal => {
      await adapter.signIn(input, signal); await acceptSession(signal);
      if (mounted.current && !signal.aborted) { setReauthentication(null); notify('Sie sind angemeldet.', 'Anmeldung', 'success'); }
    }),
    register: input => run(async signal => {
      if (!adapter.registrationAvailable) throw new AuthError('contract-pending');
      const next = await adapter.signUp(input, signal);
      if (!mounted.current || signal.aborted) return;
      if (next === 'session') await acceptSession(signal);
      else if (next === 'verify-email') notify('Bitte prüfen Sie Ihren Posteingang und bestätigen Sie Ihre E-Mail-Adresse, bevor Sie sich anmelden.', 'Registrierung', 'success');
      else if (next === 'sign-in') notify('Ihr Konto wurde erstellt. Sie können sich jetzt anmelden.', 'Registrierung', 'success');
      else throw new AuthError('invalid-response');
    }),
    logout: () => run(async signal => {
      await adapter.signOut(signal);
      if (mounted.current && !signal.aborted) { apply(null); setReauthentication(null); notify('Sie wurden erfolgreich abgemeldet.', 'Abmeldung', 'success'); }
    }),
    resetPassword: email => run(async signal => {
      await adapter.requestPasswordReset(email, signal);
      if (mounted.current && !signal.aborted) notify('Falls für diese E-Mail-Adresse ein Konto besteht, erhalten Sie eine Nachricht mit weiteren Schritten.', 'Passwort zurücksetzen', 'success');
    }),
    entryWindow, hasResetToken: !!resetToken,
    completePasswordReset: password => run(async signal => {
      if (!resetToken || !adapter.completePasswordReset) throw new AuthError('token');
      await adapter.completePasswordReset(resetToken, password, signal);
      if (mounted.current && !signal.aborted) {
        setResetToken(null); apply(null); setEntryWindow('auth-login');
        notify('Ihr Passwort wurde geändert. Bitte melden Sie sich mit dem neuen Passwort an.', 'Passwort zurücksetzen', 'success');
      }
    }),
    resendVerification: email => run(async signal => {
      if (!adapter.sendVerificationEmail) throw new AuthError('not-configured');
      await adapter.sendVerificationEmail(email, signal);
      if (mounted.current && !signal.aborted) notify('Bitte prüfen Sie Ihren Posteingang. Falls eine Bestätigung erforderlich ist, erhalten Sie eine Nachricht.', 'E-Mail-Bestätigung', 'success');
    }),
    getProfile, saveProfile,
    listAccounts, reauthentication,
    linkDiscord: () => run(async signal => {
      if (!current.current?.user.emailVerified) throw new AuthError('verification');
      if (!adapter.linkDiscord) throw new AuthError('not-configured');
      const url = checkedRedirect(await adapter.linkDiscord(signal), adapter.redirectOrigins);
      if (mounted.current && !signal.aborted) redirect(url);
    }),
    unlinkAccount: accountId => run(async signal => {
      if (!adapter.unlinkAccount) throw new AuthError('not-configured');
      await adapter.unlinkAccount(accountId, signal);
    }),
    discord: () => run(async signal => {
      const returnURL = new URL(window.location.pathname, window.location.origin).href;
      const url = checkedRedirect(await adapter.startDiscord(returnURL, signal), adapter.redirectOrigins);
      if (mounted.current && !signal.aborted) redirect(url);
    }),
  }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider fehlt.');
  return value;
}
