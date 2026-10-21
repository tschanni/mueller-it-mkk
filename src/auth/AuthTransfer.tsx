import { publicAsset } from '../utils/publicAsset';
import { RegistrationOutcome } from './registrationRecovery';

export function AuthTransfer({ kind, outcome, onClose, onCheck, onBack }: {
  kind: 'registration' | 'login'; outcome: RegistrationOutcome;
  onClose: () => void; onCheck?: () => void; onBack?: () => void;
}) {
  const loading = outcome.state === 'LOADING';
  const success = outcome.state === 'SUCCESS';
  const uncertain = outcome.state === 'UNCERTAIN';
  const title = loading ? kind === 'registration' ? 'Deine Registrierung wird verarbeitet …' : 'Anmeldung läuft …'
    : success ? kind === 'registration' ? 'Registrierung angenommen' : 'Anmeldung bestätigt'
      : uncertain ? kind === 'registration' ? 'Registrierung wird möglicherweise noch verarbeitet' : 'Anmeldung konnte nicht bestätigt werden'
        : outcome.message ? 'Anfrage konnte nicht abgeschlossen werden' : 'Anmeldeserver nicht erreichbar';
  return <section className="auth-dialog auth-transfer" aria-busy={loading} aria-label="Datenübertragung">
    {loading ? <div className="auth-transfer-animation" aria-hidden="true">
      <img src={publicAsset('/retro-server.svg')} alt="" width="48" height="48" />
      <span className="auth-transfer-channel"><i /><i /><i /></span>
      <svg width="48" height="48" viewBox="0 0 48 48" shapeRendering="crispEdges">
        <path fill="#000" d="M10 2h28v44H10z" /><path fill="#808080" d="M12 4h24v40H12z" />
        <path fill="#fff" d="M12 4h24v2H14v36h-2z" /><path fill="#c0c0c0" d="M16 8h16v8H16zm0 12h16v8H16zm0 12h16v8H16z" />
        <path fill="#000" d="M18 10h12v2H18zm0 12h12v2H18zm0 12h12v2H18z" /><path fill="#00a000" d="M28 14h2v2h-2zm0 12h2v2h-2zm0 12h2v2h-2z" />
      </svg>
    </div> : <div className={`auth-transfer-result auth-transfer-${outcome.state.toLowerCase()}`} aria-hidden="true">{success ? '✉' : uncertain ? 'i' : '×'}</div>}
    <div role={outcome.state === 'ERROR' ? 'alert' : 'status'} aria-live="polite"><h2>{title}</h2>
      <p>{loading ? 'Bitte warte einen Moment.' : success
        ? kind === 'registration' ? 'Falls für diese E-Mail-Adresse eine Bestätigung erforderlich ist, erhältst du eine entsprechende Nachricht. Bitte prüfe auch deinen Spam-Ordner.' : 'Du bist angemeldet.'
        : uncertain ? kind === 'registration'
          ? 'Wir konnten das Ergebnis deiner Registrierung nicht eindeutig bestätigen. Bitte prüfe dein E-Mail-Postfach und versuche nicht sofort, dich erneut zu registrieren.'
          : 'Wir konnten deine Anmeldung nicht eindeutig bestätigen. Bitte warte einen Moment, bevor du dich erneut bewusst anmeldest.'
          : outcome.message || 'Die Verbindung konnte nicht hergestellt werden. Bitte versuche es später erneut.'}</p>
    </div>
    <div className="auth-actions">{uncertain && onCheck && <button onClick={onCheck}>Status erneut prüfen</button>}
      {!loading && onBack && <button onClick={onBack}>Zur Anmeldung</button>}
      <button onClick={onClose}>{loading ? 'Abbrechen' : 'Schließen'}</button>
    </div>
    <img className="auth-transfer-brand" src={publicAsset('/mueller-it-mkk-logo.png')} alt="Müller IT MKK" width="40" height="40" />
  </section>;
}
