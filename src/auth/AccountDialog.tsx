import React, { useEffect, useState } from 'react';
import { useWindowManager } from '../state/WindowManagerContext';
import { useAuth } from './AuthContext';
import { AuthUser, LinkedAccount } from './client';
import { useAuthWindow } from './useAuthWindow';
import { ContactProfileForm } from './ContactProfileForm';
import { ProfileImageEditor } from './ProfileImageEditor';
import { MinecraftAccount } from './MinecraftAccount';

function AccountDetails({ user }: { user: AuthUser }) {
  const { busy, listAccounts, linkDiscord, unlinkAccount, resendVerification } = useAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmRemoval, setConfirmRemoval] = useState<string | null>(null);
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
      <dt>Rolle</dt><dd>{user.role === 'ADMIN' ? 'Administrator' : user.role === 'MAINTAINER' ? 'Maintainer' : 'Benutzer'}</dd>
    </dl>
      {!user.emailVerified && <button disabled={busy} onClick={() => void resendVerification(user.email)}>Bestätigungsmail erneut senden</button>}
    </fieldset>
    <ProfileImageEditor user={user} />
    <MinecraftAccount />
    <p>Ihr Benutzername ist vorerst nicht änderbar.</p>
    {user.emailVerified ? <details className="auth-contact-details"><summary>Kontaktinformationen</summary><ContactProfileForm key={user.id} /></details> : <p role="status">Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre optionalen Kontaktdaten zu bearbeiten.</p>}
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
