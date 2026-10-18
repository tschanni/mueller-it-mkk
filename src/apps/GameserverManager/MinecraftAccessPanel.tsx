import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useAuthWindow } from '../../auth/useAuthWindow';
import { MinecraftAccess } from './MinecraftAccess';

export function MinecraftAccessPanel() {
  const { session, status, configured, busy } = useAuth();
  const open = useAuthWindow();
  if (status === 'loading') return <p role="status">Sitzung wird geprüft …</p>;
  if (!session) return <section className="mc98 mc98-gate" aria-label="Whitelist"><h2>Whitelist</h2><p>Bitte melde dich an, um deinen Minecraft-Zugang zu verwalten.</p><button disabled={!configured || busy} onClick={() => open('auth-login')}>Anmelden</button></section>;
  if (!session.user.emailVerified) return <section className="mc98 mc98-gate" aria-label="Whitelist"><h2>Whitelist</h2><p>Bitte bestätige zuerst deine E-Mail-Adresse.</p><button onClick={() => open('auth-account')}>Mein Konto</button></section>;
  const local = process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost';
  const authBase = process.env.REACT_APP_AUTH_API_BASE_URL || (local ? 'http://localhost:3001/api/v1/auth' : 'https://api.mueller-it-mkk.de/games/api/v1/auth');
  // Share the existing auth origin and deployment prefix; never the public API adapter.
  const match = /^(https?:\/\/[^?#]+)\/api\/v1\/auth\/?$/.exec(authBase);
  if (!match) return <p role="alert">Der Minecraft-Zugang ist nicht korrekt konfiguriert.</p>;
  const url = new URL(match[1]);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.hostname === 'localhost'))) return <p role="alert">Der Minecraft-Zugang ist nicht korrekt konfiguriert.</p>;
  return <MinecraftAccess key={session.user.id} apiBase={match[1]} onLinkDiscord={() => open('auth-account')} />;
}
