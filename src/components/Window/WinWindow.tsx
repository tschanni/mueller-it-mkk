import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { useWindowManager, Win98Window } from '../../state/WindowManagerContext';
import { CompanyPage } from '../../apps/CompanyPage/CompanyPage';
import { Gallery } from '../../apps/Gallery/Gallery';
import { Calculator } from '../../apps/Calculator/Calculator';
import { Pong } from '../../apps/Pong/Pong';
import { Music } from '../../apps/Music/Music';
import { Impressum } from '../../apps/Impressum/Impressum';

export const WinWindow: React.FC<{ win: Win98Window }> = ({ win }) => {
  const { closeWindow, minimizeWindow, focusWindow, moveWindow, focusedId } = useWindowManager();
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const x = e.clientX - offsetRef.current.x;
      const y = e.clientY - offsetRef.current.y;
      moveWindow(win.id, Math.max(0, x), Math.max(0, y));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, moveWindow, win.id]);

  const onMouseDownTitle = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    };
    setDragging(true);
    focusWindow(win.id);
  };

  const isFocused = focusedId === win.id;
  const style = {
    left: win.x,
    top: win.y,
    zIndex: win.zIndex,
    width: win.width,
    height: win.height,
  } as React.CSSProperties;

  return (
    <div
      ref={ref}
      className={classNames('window', { hidden: win.isMinimized })}
      style={style}
      onMouseDown={() => focusWindow(win.id)}
    >
      <div className={classNames('title-bar', { focused: isFocused })} onMouseDown={onMouseDownTitle}>
        <div className="title-bar-text">{win.title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => minimizeWindow(win.id)} />
          <button aria-label="Maximize" disabled />
          <button aria-label="Close" onClick={() => closeWindow(win.id)} />
        </div>
      </div>
      <div className="window-body">
        {win.app === 'company' && <CompanyPage />}
        {win.app === 'gallery' && <Gallery />}
        {win.app === 'calculator' && <Calculator />}
        {win.app === 'pong' && <Pong />}
        {win.app === 'music' && <Music />}
        {win.app === 'impressum' && <Impressum />}
      </div>
    </div>
  );
};
