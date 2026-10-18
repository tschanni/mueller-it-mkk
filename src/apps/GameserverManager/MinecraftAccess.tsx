import { useCallback, useEffect, useRef, useState } from 'react';
import './minecraft-access.css';
import { publicAsset } from '../../utils/publicAsset';
import { WhitelistIcon } from './WhitelistIcon';

interface Status {
  enabled: boolean;
  discord: { linked: boolean; membership: string };
  minecraft: null | {
    username: string;
    uuid: string;
    status: string;
    linkedAt: string;
    lastSyncedAt: string | null;
    lastErrorCode: string | null;
    removing: boolean;
    ownershipVerified: boolean;
    stale: boolean;
  };
}
interface ApiError {
  code?: string;
  message: string;
}
class MinecraftRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

/** apiBase includes the deployment prefix, e.g. https://api.example/games.
 * Mount only for a signed-in user; account linking uses the existing settings.
 */
export function MinecraftAccess({
  apiBase,
  accountSettingsUrl = '/settings/accounts',
  onLinkDiscord,
}: {
  apiBase: string;
  accountSettingsUrl?: string;
  onLinkDiscord?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [membership, setMembership] = useState('UNKNOWN');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const endpoint = `${apiBase.replace(/\/$/, '')}/api/v1/me/minecraft`;
  const api = useCallback(
    async (path = '', body?: object, signal?: AbortSignal) => {
      const timeout = new AbortController();
      const abort = () => timeout.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      const timer = setTimeout(abort, body ? 45000 : 10000);
      try {
        const response = await fetch(endpoint + path, {
          method: body ? 'POST' : 'GET',
          credentials: 'include',
          cache: 'no-store',
          redirect: 'error',
          signal: timeout.signal,
          ...(body
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              }
            : {}),
        });
        const data = await response.json();
        if (!data || typeof data !== 'object')
          throw new MinecraftRequestError(
            'Die Serverantwort konnte nicht geprüft werden.',
          );
        if (!response.ok) {
          const fallback =
            response.status === 401
              ? 'Bitte melde dich erneut an.'
              : response.status === 429
                ? 'Zu viele Anfragen. Bitte warte eine Minute.'
                : 'Die Aktion konnte nicht abgeschlossen werden.';
          throw new MinecraftRequestError(
            typeof data.message === 'string' ? data.message : fallback,
            data.code,
          );
        }
        return data;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    const controller = new AbortController();
    // One initial read; refresh remains explicit, including after OAuth return.
    void api('', undefined, controller.signal)
      .then(setStatus)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError({
            message:
              e instanceof MinecraftRequestError
                ? e.message
                : 'Der Status konnte nicht geladen werden.',
          });
      });
    return () => controller.abort();
    // api is scoped to this endpoint; state updates must not trigger reloads.
  }, [api]);
  useEffect(() => {
    if (error && !dialog.current?.open) {
      dialog.current?.showModal();
      closeButton.current?.focus();
    }
  }, [error]);
  async function act(path: string, body: object = {}) {
    setBusy(true);
    try {
      if (path === '/check-discord') {
        const result = await api(path, body);
        setMembership(result.membership);
        setCheckedAt(result.checkedAt);
      } else if (path) {
        setStatus(await api(path, body));
        if (path === '/whitelist') {
          setMembership('MEMBER');
          setCheckedAt(new Date().toISOString());
        }
      }
      const fresh: Status = await api();
      setStatus(fresh);
      if (!fresh.discord.linked) {
        setMembership('UNKNOWN');
        setCheckedAt(null);
      }
    } catch (e) {
      const failure: ApiError =
        e instanceof MinecraftRequestError
          ? e
          : {
              message:
                'Die Verbindung ist fehlgeschlagen. Bitte aktualisiere den Status.',
            };
      setError({
        code: failure.code,
        message:
          failure.message ||
          'Die Verbindung ist fehlgeschlagen. Bitte aktualisiere den Status.',
      });
      if (failure.code === 'DISCORD_NOT_IN_GUILD') {
        setMembership('NOT_MEMBER');
        setCheckedAt(new Date().toISOString());
      }
      if (
        failure.code === 'DISCORD_VERIFICATION_FAILED' ||
        failure.code === 'DISCORD_NOT_LINKED'
      ) {
        setMembership('UNKNOWN');
        setCheckedAt(null);
      }
      // Errors may follow an applied command: read persisted status, never retry a write blindly.
      try {
        setStatus(await api());
      } catch {
        /* Keep the original error. */
      }
    } finally {
      setBusy(false);
    }
  }
  function dismiss() {
    dialog.current?.close();
    setError(null);
  }
  const needsDiscord = error?.code === 'DISCORD_NOT_LINKED';
  const mc = status?.minecraft;
  const labels: Record<string, string> = {
    PENDING: 'Ausstehend',
    WHITELISTED: 'Freigeschaltet',
    ERROR: 'Synchronisationsfehler',
  };
  return (
    <section className="mc98" aria-label="Whitelist" aria-busy={busy}>
      <header className="mc98-header">
        <img src={publicAsset('retro-minecraft.svg')} alt="" />
        <div><span className="mc98-eyebrow">MINECRAFT JAVA EDITION</span><h2>Whitelist</h2><p>Dein Profil. Dein Zugang. Bereit zum Mitspielen.</p></div>
        <button disabled={busy} onClick={() => void act('')}><WhitelistIcon kind="refresh" />Status aktualisieren</button>
      </header>
      <div className={'mc98-summary mc98-tone-' + (!status ? 'neutral' : !status.enabled || mc?.status === 'ERROR' ? 'error' : mc?.stale || mc?.removing ? 'pending' : mc?.status === 'WHITELISTED' ? 'success' : 'neutral')} role="status" aria-live="polite">
        <span className="mc98-summary-icon"><WhitelistIcon kind={mc?.status === 'WHITELISTED' && !mc.stale && !mc.removing ? 'check' : 'shield'} /></span>
        <div><strong>{!status ? 'Status wird geladen …' : !status.enabled ? 'Whitelist derzeit nicht verfügbar' : mc?.removing ? 'Verknüpfung wird entfernt' : mc?.stale ? 'Whitelist-Status bitte aktualisieren' : mc?.status === 'WHITELISTED' ? 'Du bist bereit zum Spielen!' : mc?.status === 'ERROR' ? 'Abgleich fehlgeschlagen' : mc ? 'Dein Profil ist verknüpft' : 'Dein Platz auf dem Server wartet'}</strong>
        <p>{!status ? 'Dein Zugang wird geprüft.' : mc?.removing ? 'Bitte warte, bis die Entfernung abgeschlossen ist.' : !status.enabled ? 'Bitte versuche es später erneut.' : mc?.stale ? 'Der letzte bekannte Status ist veraltet. Aktualisiere ihn vor dem Beitritt.' : mc?.status === 'WHITELISTED' ? 'Dein Minecraft-Profil ist auf der Whitelist freigeschaltet.' : 'Verbinde Discord und dein Minecraft-Profil, um deinen Zugang freizuschalten.'}</p></div>
      </div>
      {status && !status.enabled && <p role="status">Der Minecraft-Zugang ist noch nicht eingerichtet.</p>}
      <div className="mc98-steps">
        <section className="mc98-step">
          <div className="mc98-step-heading"><span className="mc98-step-icon"><WhitelistIcon kind="discord" /></span><div><span className="mc98-eyebrow">SCHRITT 01</span><h3>Discord verbinden</h3></div></div>
          <p>Dein Discord-Konto und die Mitgliedschaft auf Lahadde sind Voraussetzung.</p>
          <p className={'mc98-badge mc98-tone-' + (status?.discord.linked ? 'success' : 'neutral')}>Discord: {status ? status.discord.linked ? 'Verknüpft' : 'Nicht verknüpft' : 'Wird geladen …'}</p>
          {!status?.discord.linked && (onLinkDiscord ? <button disabled={!status || busy} onClick={onLinkDiscord}>Discord-Account verknüpfen</button> : <a className="mc98-button" href={accountSettingsUrl}>Discord-Account verknüpfen</a>)}
          <div className="mc98-membership"><p className={'mc98-badge mc98-tone-' + (membership === 'MEMBER' ? 'success' : membership === 'NOT_MEMBER' ? 'error' : 'pending')}>Lahadde: {membership === 'MEMBER' ? 'Mitglied bestätigt (letzte Prüfung)' : membership === 'NOT_MEMBER' ? 'Kein Mitglied (letzte Prüfung)' : 'Noch nicht bestätigt'}</p>
          {checkedAt && <small>Geprüft: {new Date(checkedAt).toLocaleString('de-DE')}</small>}</div>
          <button disabled={busy || !status?.enabled} onClick={() => void act('/check-discord')}>Discord-Mitgliedschaft prüfen</button>
        </section>
        <section className="mc98-step">
          <div className="mc98-step-heading"><span className="mc98-step-icon"><WhitelistIcon kind="profile" /></span><div><span className="mc98-eyebrow">SCHRITT 02</span><h3>Minecraft-Profil</h3></div></div>
          <p>Trage den Namen deines Minecraft-Java-Profils ein.</p>
          <label htmlFor="mc98-username">Minecraft-Java-Benutzername</label>
          <input id="mc98-username" value={name} onChange={e => setName(e.target.value)} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" placeholder={mc?.username || 'z. B. Steve_123'} disabled={busy || Boolean(mc)} aria-describedby="mc98-name-hint" />
          <small id="mc98-name-hint">3–16 Zeichen: Buchstaben, Zahlen und Unterstriche.</small>
          {mc ? <div className="mc98-profile"><WhitelistIcon kind="check" /><div><strong>{mc.username}</strong><small>Profil verknüpft</small></div></div> : <button disabled={busy || !status?.enabled || !/^[A-Za-z0-9_]{3,16}$/.test(name)} onClick={() => void act('/link', { username: name })}>Minecraft-Account verknüpfen</button>}
          <p className="mc98-note">Die öffentliche Namensauflösung bestätigt keinen Accountbesitz.</p>
        </section>
        <section className="mc98-step">
          <div className="mc98-step-heading"><span className="mc98-step-icon"><WhitelistIcon kind="shield" /></span><div><span className="mc98-eyebrow">SCHRITT 03</span><h3>Zugang freischalten</h3></div></div>
          <p>Alles verbunden? Füge dein Profil zur Server-Whitelist hinzu.</p>
          <p className={'mc98-badge mc98-tone-' + (mc?.removing || mc?.stale || mc?.status === 'PENDING' ? 'pending' : mc?.status === 'WHITELISTED' ? 'success' : mc?.status === 'ERROR' ? 'error' : 'neutral')}>Whitelist: {mc?.removing ? 'Wird entfernt' : mc ? (labels[mc.status] ?? mc.status) : 'Nicht verknüpft'}{mc?.stale && ' – Status veraltet, bitte aktualisieren'}</p>
          <button className="mc98-primary" disabled={busy || !status?.enabled || Boolean(mc?.removing) || (Boolean(status?.discord.linked) && !mc)} onClick={() => void act('/whitelist')}><WhitelistIcon kind="shield" />Zur Whitelist hinzufügen</button>
          {busy && <p role="status">Aktion wird ausgeführt …</p>}
          {mc && <dl className="mc98-sync"><dt>Letzter erfolgreicher Abgleich</dt><dd>{mc.lastSyncedAt ? new Date(mc.lastSyncedAt).toLocaleString('de-DE') : 'Noch keiner'}</dd>{mc.lastErrorCode && <><dt>Fehlercode</dt><dd>{mc.lastErrorCode}</dd></>}</dl>}
        </section>
      </div>
      {mc && <footer className="mc98-account"><div><strong>Verknüpftes Profil: {mc.username}</strong><span>UUID: <span>{mc.uuid}</span></span></div><button disabled={busy || !status?.enabled} onClick={() => void act('/unlink')}>Minecraft-Verknüpfung entfernen</button></footer>}
      <dialog
        className="mc98 mc98-dialog"
        ref={dialog}
        aria-labelledby="mc98-error-title"
        onCancel={dismiss}
      >
        <h2 id="mc98-error-title">
          {needsDiscord
            ? 'Discord-Verknüpfung erforderlich'
            : 'Whitelist: Fehler'}
        </h2>
        <p role="alert">
          {needsDiscord
            ? 'Du hast noch keinen Discord-Account mit deinem Konto verknüpft. Um auf unserem Minecraft-Server spielen zu können, musst du zuerst dein Discord-Profil verbinden.'
            : error?.message}
        </p>
        <div className="mc98-actions">
          {needsDiscord && onLinkDiscord && (
            <button
              onClick={() => {
                dismiss();
                onLinkDiscord();
              }}
            >
              Discord verknüpfen
            </button>
          )}
          {needsDiscord && !onLinkDiscord && (
            <a className="mc98-button" href={accountSettingsUrl}>
              Discord verknüpfen
            </a>
          )}
          <button ref={closeButton} onClick={dismiss}>
            {needsDiscord ? 'Abbrechen' : 'OK'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
