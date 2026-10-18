import { useCallback, useEffect, useRef, useState } from 'react';
import './minecraft-access.css';

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
    <section className="mc98" aria-label="Minecraft-Zugang" aria-busy={busy}>
      <h2>Minecraft-Zugang</h2>
      {status && !status.enabled && (
        <p role="status">Der Minecraft-Zugang ist noch nicht eingerichtet.</p>
      )}
      <p>
        Discord:{' '}
        {status
          ? status.discord.linked
            ? 'Verknüpft'
            : 'Nicht verknüpft'
          : 'Wird geladen …'}
      </p>
      {!status?.discord.linked &&
        (onLinkDiscord ? (
          <button onClick={onLinkDiscord}>Discord-Account verknüpfen</button>
        ) : (
          <a href={accountSettingsUrl}>Discord-Account verknüpfen</a>
        ))}
      <p>
        Lahadde:{' '}
        {membership === 'MEMBER'
          ? 'Mitglied bestätigt (letzte Prüfung)'
          : membership === 'NOT_MEMBER'
            ? 'Kein Mitglied (letzte Prüfung)'
            : 'Noch nicht bestätigt'}
        {checkedAt && ` – ${new Date(checkedAt).toLocaleString('de-DE')}`}
      </p>
      <button
        disabled={busy || !status?.enabled}
        onClick={() => void act('/check-discord')}
      >
        Discord-Mitgliedschaft prüfen
      </button>
      <p>
        Whitelist: {mc ? (labels[mc.status] ?? mc.status) : 'Nicht verknüpft'}
        {mc?.stale && ' – Status veraltet, bitte aktualisieren'}
      </p>
      {mc && (
        <dl>
          <dt>Minecraft-Name</dt>
          <dd>{mc.username}</dd>
          <dt>UUID</dt>
          <dd>{mc.uuid}</dd>
          <dt>Letzter erfolgreicher Abgleich</dt>
          <dd>
            {mc.lastSyncedAt
              ? new Date(mc.lastSyncedAt).toLocaleString('de-DE')
              : 'Noch keiner'}
          </dd>
          {mc.lastErrorCode && (
            <>
              <dt>Fehlercode</dt>
              <dd>{mc.lastErrorCode}</dd>
            </>
          )}
        </dl>
      )}
      <p>Die öffentliche Namensauflösung bestätigt keinen Accountbesitz.</p>
      <label>
        Minecraft-Java-Benutzername{' '}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          pattern="[A-Za-z0-9_]{3,16}"
          disabled={busy || Boolean(mc)}
        />
      </label>
      <div className="mc98-actions">
        <button
          disabled={
            busy ||
            !status?.enabled ||
            Boolean(mc) ||
            !/^[A-Za-z0-9_]{3,16}$/.test(name)
          }
          onClick={() => void act('/link', { username: name })}
        >
          Minecraft-Account verknüpfen
        </button>
        <button
          disabled={
            busy ||
            !status?.enabled ||
            Boolean(mc?.removing) ||
            (Boolean(status?.discord.linked) && !mc)
          }
          onClick={() => void act('/whitelist')}
        >
          Zur Whitelist hinzufügen
        </button>
        <button
          disabled={busy || !status?.enabled || !mc}
          onClick={() => void act('/unlink')}
        >
          Minecraft-Verknüpfung entfernen
        </button>
        <button disabled={busy} onClick={() => void act('')}>
          Status aktualisieren
        </button>
      </div>
      <dialog
        className="mc98 mc98-dialog"
        ref={dialog}
        aria-labelledby="mc98-error-title"
        onCancel={dismiss}
      >
        <h2 id="mc98-error-title">
          {needsDiscord
            ? 'Discord-Verknüpfung erforderlich'
            : 'Minecraft-Zugang: Fehler'}
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
