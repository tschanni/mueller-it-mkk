import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useWindowManager } from '../state/WindowManagerContext';
import { publicAsset } from '../utils/publicAsset';
import { useAuth } from './AuthContext';
import { useAuthWindow } from './useAuthWindow';
import './auth.css';

export function AuthWindows() {
  const { notice, session, entryWindow, reauthentication } = useAuth();
  const { windows, closeWindow } = useWindowManager();
  const open = useAuthWindow();
  const handled = useRef(0);
  const handledEntry = useRef<string | null>(null);
  const usernamePrompt = useRef<string | null>(null);
  const handledReauthentication = useRef(0);
  useEffect(() => {
    if (reauthentication && handledReauthentication.current !== reauthentication) {
      handledReauthentication.current = reauthentication; open('auth-login');
    }
    if (entryWindow && entryWindow !== handledEntry.current) { handledEntry.current = entryWindow; open(entryWindow); }
    if (session?.user.needsUsername && usernamePrompt.current !== session.user.id) {
      usernamePrompt.current = session.user.id; open('auth-account');
    }
    if (notice && handled.current !== notice.id) { handled.current = notice.id; open('auth-message'); }
    if (session) {
      for (const win of windows) {
        if ((win.app === 'auth-login' && !reauthentication) || win.app === 'auth-register') closeWindow(win.id);
      }
    }
  }, [notice, session, open, windows, closeWindow, entryWindow, reauthentication]);
  return null;
}

function Intro({ children }: { children: React.ReactNode }) {
  return <div className="auth-intro"><img src={publicAsset('/mueller-it-mkk-logo.png')} alt="" width="80" height="80" /><div>{children}</div></div>;
}
function ConnectionNote() {
  const { configured, status } = useAuth();
  if (!configured) return <p className="auth-connection" role="status">Die Serveranbindung für die Anmeldung wird vorbereitet. Anmelden und Registrieren sind derzeit nicht verfügbar.</p>;
  if (status === 'unavailable') return <p className="auth-connection" role="status">Der Anmeldedienst ist momentan nicht erreichbar. Bitte versuchen Sie es erneut.</p>;
  return null;
}
function FormErrors({ errors }: { errors: string[] }) {
  return errors.length ? <div className="auth-errors" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div> : null;
}
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const emailError = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';

export function LoginDialog({ windowId }: { windowId: string }) {
  const { login, discord, resendVerification, configured, busy } = useAuth();
  const { closeWindow } = useWindowManager();
  const open = useAuthWindow();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = [...(!validEmail(email.trim()) ? [emailError] : []), ...(!password ? ['Bitte geben Sie Ihr Passwort ein.'] : [])];
    setErrors(invalid);
    if (invalid.length) return;
    const secret = password;
    setPassword('');
    if (await login({ email: email.trim(), password: secret })) closeWindow(windowId);
  }
  return <form aria-label="Anmeldedaten" className="auth-dialog" onSubmit={submit} noValidate aria-busy={busy}>
    <Intro><p>Geben Sie Ihre E-Mail-Adresse und Ihr Passwort für die Anmeldung bei Mueller IT MKK Welt ein.</p></Intro>
    <ConnectionNote />
    <FormErrors errors={errors} />
    <div className="auth-fields">
      <label htmlFor="login-email">E-Mail:</label><input id="login-email" type="email" autoComplete="username" autoFocus required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="login-password">Passwort:</label><input id="login-password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
    </div>
    <div className="auth-actions"><button type="submit" disabled={!configured || busy}>{busy ? 'Bitte warten…' : 'Anmelden'}</button><button type="button" onClick={() => closeWindow(windowId)}>Abbrechen</button></div>
    <div className="auth-alternative"><button type="button" disabled={!configured || busy} onClick={() => { setPassword(''); void discord(); }}><img src={publicAsset('/discord.svg')} alt="" width="20" height="20" />Mit Discord anmelden</button></div>
    <div className="auth-links"><button type="button" disabled={busy} onClick={() => { setPassword(''); open('auth-register'); }}>Neues Konto erstellen</button><button type="button" disabled={busy} onClick={() => { setPassword(''); open('auth-reset'); }}>Passwort vergessen?</button></div>
    <div className="auth-links"><button type="button" disabled={!configured || busy} onClick={() => {
      if (!validEmail(email.trim())) { setErrors([emailError]); return; }
      setErrors([]); setPassword(''); void resendVerification(email.trim());
    }}>Bestätigungsmail erneut senden</button></div>
  </form>;
}

export function RegistrationDialog({ windowId }: { windowId: string }) {
  const { register, configured, busy, passwordPolicy } = useAuth();
  const { closeWindow } = useWindowManager();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = [
      ...(!name.trim() ? ['Bitte geben Sie Ihren Namen ein.'] : []),
      ...(!username.trim() ? ['Bitte geben Sie einen Benutzernamen ein.'] : []),
      ...(username.trim() && !/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim()) ? ['Der Benutzername muss 3 bis 30 Zeichen lang sein und darf nur Buchstaben, Ziffern, Unterstriche und Punkte enthalten.'] : []),
      ...(!validEmail(email.trim()) ? [emailError] : []),
      ...(!password ? ['Bitte geben Sie ein Passwort ein.'] : []),
      ...(passwordPolicy && (password.length < passwordPolicy.minLength || password.length > passwordPolicy.maxLength) ? [`Das Passwort muss zwischen ${passwordPolicy.minLength} und ${passwordPolicy.maxLength} Zeichen lang sein.`] : []),
      ...(password !== confirmation ? ['Die Passwörter stimmen nicht überein.'] : []),
    ];
    setErrors(invalid);
    if (invalid.length) return;
    const secret = password;
    setPassword(''); setConfirmation('');
    if (await register({ name: name.trim(), username: username.trim(), email: email.trim(), password: secret })) closeWindow(windowId);
  }
  return <form aria-label="Registrierungsdaten" className="auth-dialog" onSubmit={submit} noValidate aria-busy={busy}>
    <Intro><p>Erstellen Sie ein Benutzerkonto für Müller IT MKK.</p></Intro>
    <ConnectionNote /><FormErrors errors={errors} />
    <div className="auth-fields">
      <label htmlFor="register-display-name">Name:</label><input id="register-display-name" autoComplete="name" required value={name} disabled={busy} onChange={e => setName(e.target.value)} />
      <label htmlFor="register-name">Benutzername:</label><input id="register-name" autoComplete="username" autoFocus required value={username} disabled={busy} onChange={e => setUsername(e.target.value)} />
      <label htmlFor="register-email">E-Mail:</label><input id="register-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="register-password">Passwort:</label><input id="register-password" type="password" autoComplete="new-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
      <label htmlFor="register-confirm">Passwort bestätigen:</label><input id="register-confirm" type="password" autoComplete="new-password" required value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} />
    </div>
    {passwordPolicy && <p>Verwenden Sie {passwordPolicy.minLength} bis {passwordPolicy.maxLength} Zeichen für Ihr Passwort.</p>}
    <div className="auth-actions"><button type="submit" disabled={!configured || busy}>{busy ? 'Bitte warten…' : 'Registrieren'}</button><button type="button" onClick={() => closeWindow(windowId)}>Abbrechen</button></div>
  </form>;
}

export function PasswordResetDialog({ windowId }: { windowId: string }) {
  const { resetPassword, configured, busy } = useAuth();
  const { closeWindow } = useWindowManager();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validEmail(email.trim())) { setErrors([emailError]); return; }
    setErrors([]);
    if (await resetPassword(email.trim())) closeWindow(windowId);
  }
  return <form aria-label="Passwort zurücksetzen" className="auth-dialog" onSubmit={submit} noValidate aria-busy={busy}>
    <Intro><p>Geben Sie Ihre E-Mail-Adresse ein, um Hinweise zum Zurücksetzen Ihres Passworts anzufordern.</p></Intro>
    <ConnectionNote /><FormErrors errors={errors} />
    <div className="auth-fields"><label htmlFor="reset-email">E-Mail:</label><input id="reset-email" type="email" autoComplete="email" autoFocus required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></div>
    <div className="auth-actions"><button type="submit" disabled={!configured || busy}>{busy ? 'Bitte warten…' : 'Nachricht anfordern'}</button><button type="button" onClick={() => closeWindow(windowId)}>Abbrechen</button></div>
  </form>;
}

export function NewPasswordDialog({ windowId }: { windowId: string }) {
  const { completePasswordReset, hasResetToken, configured, passwordPolicy, busy } = useAuth();
  const { closeWindow } = useWindowManager();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = [
      ...(!password ? ['Bitte geben Sie ein Passwort ein.'] : []),
      ...(passwordPolicy && (password.length < passwordPolicy.minLength || password.length > passwordPolicy.maxLength) ? [`Das Passwort muss zwischen ${passwordPolicy.minLength} und ${passwordPolicy.maxLength} Zeichen lang sein.`] : []),
      ...(password !== confirmation ? ['Die Passwörter stimmen nicht überein.'] : []),
    ];
    setErrors(invalid);
    if (invalid.length) return;
    const secret = password; setPassword(''); setConfirmation('');
    if (await completePasswordReset(secret)) closeWindow(windowId);
  }
  return <form className="auth-dialog" aria-label="Neues Passwort" onSubmit={submit} noValidate aria-busy={busy}>
    <Intro><p>Wählen Sie ein neues Passwort. Anschließend melden Sie sich erneut an.</p></Intro>
    <ConnectionNote /><FormErrors errors={errors} />
    {!hasResetToken && <p role="alert">Der Link ist ungültig oder abgelaufen. Bitte fordern Sie eine neue Nachricht an.</p>}
    <div className="auth-fields">
      <label htmlFor="new-password">Neues Passwort:</label><input id="new-password" type="password" autoFocus autoComplete="new-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
      <label htmlFor="new-password-confirm">Passwort bestätigen:</label><input id="new-password-confirm" type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
    </div>
    <div className="auth-actions"><button disabled={!configured || !hasResetToken || busy}>{busy ? 'Bitte warten…' : 'Passwort speichern'}</button><button type="button" onClick={() => closeWindow(windowId)}>Abbrechen</button></div>
  </form>;
}

export function AuthMessage({ windowId }: { windowId: string }) {
  const { notice, dismissNotice } = useAuth();
  const { closeWindow } = useWindowManager();
  return <div className="auth-dialog"><div className="auth-intro" role="alert"><span className="auth-message-icon" aria-hidden="true">i</span><div><strong>{notice?.title}</strong><p>{notice?.text}</p></div></div><div className="auth-actions"><button autoFocus onClick={() => { dismissNotice(); closeWindow(windowId); }}>OK</button></div></div>;
}
