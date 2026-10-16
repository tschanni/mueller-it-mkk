import React, { useEffect, useState } from 'react';
import { useWindowManager } from '../state/WindowManagerContext';
import { useAuth } from './AuthContext';
import { AuthUser, LinkedAccount } from './client';
import { useAuthWindow } from './useAuthWindow';
import { ProfileImage, profileImageURL } from './ProfileImage';

function AccountDetails({ user }: { user: AuthUser }) {
  const { busy, updateImage, listAccounts, linkDiscord, unlinkAccount, resendVerification } = useAuth();
  const [image, setImage] = useState(user.image || '');
  const [imageError, setImageError] = useState('');
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmRemoval, setConfirmRemoval] = useState<string | null>(null);
  useEffect(() => { setImage(user.image || ''); }, [user.image]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    let closed = false;
    setLoading(true); setLoadError(false); setAccounts(null); setConfirmRemoval(null);
    void listAccounts(abort.signal).then(value => {
      if (!closed && !abort.signal.aborted) setAccounts(value);
    }).catch(() => { if (!closed) setLoadError(true); }).finally(() => {
      clearTimeout(timer); if (!closed) setLoading(false);
    });
    return () => { closed = true; abort.abort(); clearTimeout(timer); };
  }, [listAccounts, revision]);
  const hasDiscord = accounts?.some(account => account.providerId === 'discord');
  return <>
    <fieldset><legend>Benutzerkonto</legend><dl className="auth-account-fields">
      <dt>Benutzername</dt><dd>{user.name}</dd>
      <dt>Benutzer-ID</dt><dd>{user.id}</dd>
      <dt>E-Mail</dt><dd>{user.email}</dd>
      <dt>E-Mail-Bestätigung</dt><dd>{user.emailVerified ? 'Bestätigt' : 'Nicht bestätigt'}</dd>
      <dt>Rolle</dt><dd>{user.role === 'ADMIN' ? 'Administrator' : 'Benutzer'}</dd>
    </dl>
      {!user.emailVerified && <button disabled={busy} onClick={() => void resendVerification(user.email)}>Bestätigungsmail erneut senden</button>}
    </fieldset>
    <fieldset><legend>Profilbild</legend>
      <div className="auth-profile-preview"><ProfileImage image={user.image} name={user.name || 'Benutzer'} size={64} /><p>Verwenden Sie die HTTPS-Adresse eines öffentlich erreichbaren Bildes.</p></div>
      <form aria-label="Profilbild ändern" noValidate onSubmit={event => {
        event.preventDefault();
        const url = profileImageURL(image);
        if (!url) { setImageError('Bitte geben Sie eine gültige HTTPS-Bildadresse ohne Zugangsdaten ein.'); return; }
        setImageError(''); void updateImage(url);
      }}>
        {imageError && <p role="alert">{imageError}</p>}
        <div className="auth-fields"><label htmlFor="account-image">Bildadresse:</label><input id="account-image" type="url" autoComplete="off" placeholder="https://…" value={image} disabled={busy} onChange={event => setImage(event.target.value)} /></div>
        <div className="auth-actions"><button disabled={busy}>Profilbild speichern</button></div>
      </form>
    </fieldset>
    <fieldset><legend>Kontaktdaten (optional)</legend>
      <p id="contact-unavailable" className="auth-feedback auth-feedback-warning" role="status">Das Kontaktformular wird vorbereitet. Speichern ist derzeit nicht verfügbar.</p>
      <p>Alle Kontaktdaten können leer bleiben. Ihr Benutzername ist vorerst nicht änderbar.</p>
      <div className="auth-fields" aria-describedby="contact-unavailable">
        {['Vorname', 'Nachname', 'Straße', 'Hausnummer', 'Postleitzahl', 'Ort'].map((label, index) => <React.Fragment key={label}>
          <label htmlFor={`contact-${index}`}>{label}:</label><input id={`contact-${index}`} disabled value="" readOnly />
        </React.Fragment>)}
      </div>
      <div className="auth-actions"><button disabled>Kontaktdaten speichern</button></div>
    </fieldset>
    <fieldset><legend>Verknüpfte Anmeldekonten</legend>
      {loading && <p role="status">Anmeldekonten werden geladen…</p>}
      {loadError && <p>Die Anmeldekonten konnten nicht geladen werden. <button disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Erneut laden</button></p>}
      {accounts && !accounts.length && <p>Keine Anmeldekonten gemeldet.</p>}
      {accounts && <ul className="auth-account-list">{accounts.map(account => <li key={account.id}>
        <span>{account.providerId === 'discord' ? 'Discord' : account.providerId === 'credential' ? 'E-Mail und Passwort' : account.providerId}</span>
        {account.providerId === 'discord' && <button disabled={busy || accounts.length <= 1} onClick={() => setConfirmRemoval(account.id)}>Discord-Verknüpfung entfernen</button>}
      </li>)}</ul>}
      {accounts?.length === 1 && hasDiscord && <p>Das letzte Anmeldekonto kann nicht entfernt werden.</p>}
      {confirmRemoval && accounts && accounts.length > 1 && <fieldset><legend>Verknüpfung entfernen?</legend>
        <p>Danach ist die Anmeldung über dieses Discord-Konto nicht mehr möglich. Ihr anderes Anmeldekonto bleibt bestehen.</p>
        <div className="auth-actions"><button disabled={busy} onClick={async () => {
          if (await unlinkAccount(confirmRemoval)) { setConfirmRemoval(null); setRevision(value => value + 1); }
        }}>Entfernen bestätigen</button><button disabled={busy} onClick={() => setConfirmRemoval(null)}>Abbrechen</button></div>
      </fieldset>}
      {!user.emailVerified && <p>Bestätigen Sie Ihre E-Mail-Adresse, bevor Sie Discord verknüpfen.</p>}
      <p>Verwenden Sie bei Discord dieselbe bestätigte E-Mail-Adresse. Konten werden nicht automatisch verknüpft.</p>
      <button disabled={busy || loading || !accounts || hasDiscord || !user.emailVerified} onClick={() => void linkDiscord()}>{hasDiscord ? 'Discord ist verknüpft' : 'Discord-Konto verknüpfen'}</button>
    </fieldset>
  </>;
}

export function AccountDialog({ windowId }: { windowId: string }) {
  const { session, logout, busy } = useAuth();
  const { closeWindow } = useWindowManager();
  const open = useAuthWindow();
  return <div className="auth-dialog">
    {session ? <><p>Angemeldet als <strong>{session.user.name}</strong></p>
      <AccountDetails key={session.user.id} user={session.user} />
      <div className="auth-actions"><button disabled={busy} onClick={() => void logout()}>{busy ? 'Bitte warten…' : 'Abmelden'}</button><button onClick={() => closeWindow(windowId)}>Schließen</button></div></> :
      <><p>Sie sind nicht angemeldet.</p><div className="auth-actions"><button onClick={() => open('auth-login')}>Anmelden</button><button onClick={() => closeWindow(windowId)}>Schließen</button></div></>}
  </div>;
}
