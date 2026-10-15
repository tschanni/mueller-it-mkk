import { useWindowManager } from '../state/WindowManagerContext';

export type AuthWindow = 'auth-login' | 'auth-register' | 'auth-reset' | 'auth-new-password' | 'auth-account' | 'auth-message';
const titles: Record<AuthWindow, string> = {
  'auth-login': 'Mueller IT MKK Welt Anmeldung', 'auth-register': 'Neues Konto erstellen',
  'auth-reset': 'Passwort vergessen', 'auth-account': 'Mein Konto', 'auth-message': 'Meldung',
  'auth-new-password': 'Passwort zurücksetzen',
};
export function useAuthWindow() {
  const { windows, openWindow, restoreWindow } = useWindowManager();
  return (app: AuthWindow) => {
    if (windows.some(w => w.id === app)) { restoreWindow(app); return; }
    openWindow({ id: app, app, title: titles[app],
      x: Math.max(4, Math.min(150, (window.innerWidth - 440) / 2)),
      y: Math.max(4, Math.min(100, window.innerHeight / 8)), width: 440 });
  };
}
