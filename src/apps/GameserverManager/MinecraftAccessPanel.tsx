import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useAuthWindow } from '../../auth/useAuthWindow';
import { MinecraftAccess } from './MinecraftAccess';
import { minecraftApiBase } from './minecraftApiBase';

export function MinecraftAccessPanel() {
  const { session, status, configured, busy } = useAuth();
  const open = useAuthWindow();
  if (status === 'loading') return <p role="status">Sitzung wird geprüft …</p>;
  if (!session) return <section className="mc98 mc98-gate" aria-label="Whitelist"><h2>Whitelist</h2><p>Bitte melde dich an, um deinen Minecraft-Zugang zu verwalten.</p><button disabled={!configured || busy} onClick={() => open('auth-login')}>Anmelden</button></section>;
  if (!session.user.emailVerified) return <section className="mc98 mc98-gate" aria-label="Whitelist"><h2>Whitelist</h2><p>Bitte bestätige zuerst deine E-Mail-Adresse.</p><button onClick={() => open('auth-account')}>Mein Konto</button></section>;
  const apiBase = minecraftApiBase();
  if (!apiBase) return <p role="alert">Der Minecraft-Zugang ist nicht korrekt konfiguriert.</p>;
  return <MinecraftAccess key={session.user.id} apiBase={apiBase} onLinkDiscord={() => open('auth-account')} />;
}
