import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { useWindowManager, Win98Window } from '../../state/WindowManagerContext';
import { CompanyPage } from '../../apps/CompanyPage/CompanyPage';
import { Gallery } from '../../apps/Gallery/Gallery';
import { Calculator } from '../../apps/Calculator/Calculator';
import { Pong } from '../../apps/Pong/Pong';
import { Music } from '../../apps/Music/Music';
import { GameserverManager } from '../../apps/GameserverManager/GameserverManager';
import { Impressum } from '../../apps/Impressum/Impressum';
import { AuthMessage, LoginDialog, NewPasswordDialog, PasswordResetDialog, RegistrationDialog } from '../../auth/AuthWindows';
import { AccountDialog } from '../../auth/AccountDialog';

export const WinWindow: React.FC<{ win: Win98Window }> = ({ win }) => {
  const { closeWindow, minimizeWindow, focusWindow, moveWindow, maximizeWindow, focusedId } = useWindowManager();
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
    if (win.isMaximized || (e.target as HTMLElement).closest('button')) return;
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
    left: win.isMaximized ? 0 : Math.min(win.x, Math.max(0, window.innerWidth - 100)),
    top: win.isMaximized ? 0 : Math.min(win.y, Math.max(0, window.innerHeight - 100)),
    zIndex: win.zIndex,
    width: win.isMaximized ? '100%' : win.width,
    height: win.isMaximized ? 'calc(100% - 34px)' : win.height,
  } as React.CSSProperties;

  return (
    <div
      role="dialog"
      aria-label={win.title}
      ref={ref}
      className={classNames('window', { hidden: win.isMinimized, 'gameserver-window': win.app === 'gameservers', 'auth-window': win.app.startsWith('auth-'), maximized: win.isMaximized })}
      style={style}
      onMouseDown={() => focusWindow(win.id)}
    >
      <div className={classNames('title-bar', { focused: isFocused })} onMouseDown={onMouseDownTitle} onDoubleClick={() => maximizeWindow(win.id)}>
        <div className="title-bar-text">{win.title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => minimizeWindow(win.id)} />
          <button aria-label={win.isMaximized ? "Restore" : "Maximize"} onClick={() => maximizeWindow(win.id)} />
          <button aria-label="Close" onClick={() => closeWindow(win.id)} />
        </div>
      </div>
      <div className="window-body">
        {win.app === 'auth-login' && <LoginDialog windowId={win.id} />}
        {win.app === 'auth-register' && <RegistrationDialog windowId={win.id} />}
        {win.app === 'auth-reset' && <PasswordResetDialog windowId={win.id} />}
        {win.app === 'auth-new-password' && <NewPasswordDialog windowId={win.id} />}
        {win.app === 'auth-account' && <AccountDialog windowId={win.id} />}
        {win.app === 'auth-message' && <AuthMessage windowId={win.id} />}
        {win.app === 'gameservers' && <GameserverManager />}
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
