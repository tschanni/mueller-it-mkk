import React from 'react';
import './taskbar.css';
import { useWindowManager } from '../../state/WindowManagerContext';

export const Taskbar: React.FC = () => {
  const { windows, toggleMinimize } = useWindowManager();

  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="taskbar">
      <button className="start-button" aria-label="Start">
        <span className="start-flag" />
        Start
      </button>
      <div className="task-buttons">
        {windows.map(w => (
          <button
            key={w.id}
            className={`task-button ${w.isMinimized ? '' : 'active'}`}
            onClick={() => toggleMinimize(w.id)}
            title={w.title}
          >
            {w.title}
          </button>
        ))}
      </div>
      <div className="clock" aria-label="Uhr">
        {time}
      </div>
    </div>
  );
};
