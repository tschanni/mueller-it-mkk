import React from 'react';
import { Taskbar } from '../Taskbar/Taskbar';
import { WindowArea } from '../Window/WindowArea';
import './desktop.css';
import { AppIcon } from '../AppIcon/AppIcon';
import { useWindowManager } from '../../state/WindowManagerContext';

export const Desktop: React.FC = () => {
  const { openWindow } = useWindowManager();

  const openCompany = () =>
    openWindow({ title: 'Müller IT MKK', app: 'company', x: 120, y: 100 });
  const openGallery = () => openWindow({ title: 'Bilder', app: 'gallery', x: 220, y: 120 });
  const openCalculator = () => openWindow({ title: 'Taschenrechner', app: 'calculator', x: 320, y: 140, width: 530, height: 230 });
  const openPong = () => openWindow({ title: 'Pong', app: 'pong', x: 160, y: 160, width: 800, height: 700 });
  const openMusic = () => openWindow({ title: 'Musik', app: 'music', x: 180, y: 180, width: 640, height: 520 });

  return (
    <div className="desktop">
      <div className="icons">
        <AppIcon title="Müller IT MKK" icon="/retro-browser.png" onOpen={openCompany} />
        <AppIcon title="Bilder" icon="/retro-folder.png" onOpen={openGallery} />
        <AppIcon title="Taschenrechner" icon="/retro-calc.svg" onOpen={openCalculator} />
        <AppIcon title="Pong" icon="/game1.png" onOpen={openPong} />
        <AppIcon title="Musik" icon="/music.png" onOpen={openMusic} />
      </div>
      <WindowArea />
      <Taskbar />
    </div>
  );
};
