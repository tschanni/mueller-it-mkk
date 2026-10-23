export type AuthReturn =
  { kind: 'desktop' } | { kind: 'oauth'; failed: boolean; verificationRequired?: true; message?: string } |
  { kind: 'verified'; failed: boolean } | { kind: 'reset'; token: string | null } | { kind: 'account'; failed: boolean; message?: string };

// Only codes emitted by the installed Better Auth OAuth callback or Discord are
// classified. Never render error_description or an unrecognized query value.
const oauthMessages: Record<string, string> = {
  access_denied: 'Die Discord-Autorisierung wurde abgebrochen oder abgelehnt.',
  state_mismatch: 'Die Sicherheitsprüfung der Discord-Anmeldung ist fehlgeschlagen. Bitte starten Sie sie erneut.',
  invalid_code: 'Der Discord-Anmeldecode konnte nicht eingelöst werden. Bitte starten Sie die Anmeldung erneut.',
  account_not_linked: 'Dieses Discord-Konto ist noch nicht mit Ihrem Benutzerkonto verknüpft. Melden Sie sich zuerst mit E-Mail und Passwort an und verknüpfen Sie es unter Mein Konto.',
  account_already_linked_to_different_user: 'Dieses Discord-Konto ist bereits mit einem anderen Benutzerkonto verknüpft.',
  unable_to_link_account: 'Das Discord-Konto konnte nicht verknüpft werden.',
  email_does_not_match: 'Die E-Mail-Adresse des Discord-Kontos stimmt nicht mit der Ihres Benutzerkontos überein.',
  email_not_verified: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Starten Sie danach die Discord-Anmeldung erneut.',
};
function oauthMessage(url: URL): string | undefined {
  const errors = url.searchParams.getAll('error');
  return errors.length === 1 && Object.prototype.hasOwnProperty.call(oauthMessages, errors[0])
    ? oauthMessages[errors[0]] : undefined;
}
/** Error codes are allowlisted before the URL is scrubbed; raw query values are never displayed or logged. */
export function readAuthReturn(url: URL): AuthReturn {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/auth/callback' || path === '/auth/error') {
    const message = oauthMessage(url);
    return { kind: 'oauth', failed: path === '/auth/error' || url.searchParams.has('error'),
      ...(url.searchParams.get('error') === 'email_not_verified' ? { verificationRequired: true as const } : {}),
      ...(message ? { message } : {}),
    };
  }
  if (path === '/auth/verified') return { kind: 'verified', failed: url.searchParams.has('error') };
  if (path === '/settings/accounts') {
    const message = oauthMessage(url);
    return { kind: 'account', failed: url.searchParams.has('error'), ...(message ? { message } : {}) };
  }
  if (path === '/reset-password') {
    const tokens = url.searchParams.getAll('token');
    return { kind: 'reset', token: !url.searchParams.has('error') && tokens.length === 1 && tokens[0] ? tokens[0] : null };
  }
  return { kind: 'desktop' };
}
