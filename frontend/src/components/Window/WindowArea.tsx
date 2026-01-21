import React from 'react';
import { useWindowManager } from '../../state/WindowManagerContext';
import { Win98Window } from '../../state/WindowManagerContext';
import { WinWindow } from './WinWindow';
import './window.css';

export const WindowArea: React.FC = () => {
  const { windows } = useWindowManager();

  return (
    <div className="window-area">
      {windows.map((w) => (
        <WinWindow key={w.id} win={w} />
      ))}
    </div>
  );
};
