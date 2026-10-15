import React from 'react';
import { Taskbar } from '../Taskbar/Taskbar';
import { WindowArea } from '../Window/WindowArea';
import './desktop.css';
import { AppIcon } from '../AppIcon/AppIcon';
import { useWindowManager } from '../../state/WindowManagerContext';
import { AuthWindows } from '../../auth/AuthWindows';
import { useAuth } from '../../auth/AuthContext';
import { useAuthWindow } from '../../auth/useAuthWindow';

export const Desktop: React.FC = () => {
  const { session } = useAuth();
  const openAuthWindow = useAuthWindow();
  const { openWindow, windows, restoreWindow } = useWindowManager();

  const openCompany = () =>
    openWindow({ title: 'Müller IT MKK', app: 'company', x: 120, y: 100 });
  const openGallery = () => openWindow({ title: 'Bilder', app: 'gallery', x: 220, y: 120 });
  const openCalculator = () => openWindow({ title: 'Taschenrechner', app: 'calculator', x: 320, y: 140, width: 530, height: 230 });
  const openPong = () => openWindow({ title: 'Pong', app: 'pong', x: 160, y: 160, width: 800, height: 700 });
  const openMusic = () => openWindow({ title: 'Musik', app: 'music', x: 180, y: 180, width: 640, height: 520 });

  const openGameservers = () => {
    const existing = windows.find(w => w.app === 'gameservers');
    if (existing) { restoreWindow(existing.id); return; }
    openWindow({ id: 'gameserver-manager', title: 'Gameserver-Manager – Müller IT MKK', app: 'gameservers', x: Math.min(160, Math.max(0, window.innerWidth - 820)), y: 110, width: 800, height: 580 });
  };

  return (
    <div className="desktop">
      <div className="icons">
        <AppIcon title={session ? 'Mein Konto' : 'Anmelden'} icon="/retro-login.svg" onOpen={() => openAuthWindow(session ? 'auth-account' : 'auth-login')} />
        <AppIcon title="Müller IT MKK" icon="/retro-browser.png" onOpen={openCompany} />
        <AppIcon title="Bilder" icon="/retro-folder.png" onOpen={openGallery} />
        <AppIcon title="Taschenrechner" icon="/retro-calc.svg" onOpen={openCalculator} />
        <AppIcon title="Pong" icon="/game1.png" onOpen={openPong} />
        <AppIcon title="Musik" icon="/music.png" onOpen={openMusic} />
        <AppIcon title="Gameserver-Manager" icon="/retro-server.svg" onOpen={openGameservers} />
      </div>
      <WindowArea />
      <AuthWindows />
      <Taskbar />
    </div>
  );
};
