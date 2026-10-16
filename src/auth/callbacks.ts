export type AuthReturn =
  { kind: 'desktop' } | { kind: 'oauth'; failed: boolean; verificationRequired?: true } |
  { kind: 'verified'; failed: boolean } | { kind: 'reset'; token: string | null } | { kind: 'account'; failed: boolean };
/** No query values are displayed or logged. Reset tokens live only in memory. */
export function readAuthReturn(url: URL): AuthReturn {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/auth/callback' || path === '/auth/error') {
    return { kind: 'oauth', failed: path === '/auth/error' || url.searchParams.has('error'),
      ...(url.searchParams.get('error') === 'email_not_verified' ? { verificationRequired: true as const } : {}),
    };
  }
  if (path === '/auth/verified') return { kind: 'verified', failed: url.searchParams.has('error') };
  if (path === '/settings/accounts') return { kind: 'account', failed: url.searchParams.has('error') };
  if (path === '/reset-password') {
    const tokens = url.searchParams.getAll('token');
    return { kind: 'reset', token: !url.searchParams.has('error') && tokens.length === 1 && tokens[0] ? tokens[0] : null };
  }
  return { kind: 'desktop' };
}
