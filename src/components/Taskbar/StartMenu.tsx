import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useAuthWindow } from '../../auth/useAuthWindow';
import { publicAsset } from '../../utils/publicAsset';
import { ProfileImage } from '../../auth/ProfileImage';

export function StartMenu() {
  const { session, status, busy, logout } = useAuth();
  const openWindow = useAuthWindow();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  function close() { setOpen(false); start.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  return <div className="start-menu-root" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
  }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={start} className="start-button" aria-label="Start" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'desktop-start-menu' : undefined}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}>
      <span className="start-flag" aria-hidden="true" />Start
    </button>
    {open && <div id="desktop-start-menu" className="start-menu" role="menu" aria-label="Startmenü" ref={menu} onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
    }}>
      <div className="start-menu-content">
        <div className="start-menu-user">{session && <ProfileImage image={session.user.image} name={session.user.username} />}<span>{session ? session.user.username : status === 'loading' ? 'Sitzung wird geprüft…' : 'Nicht angemeldet'}</span></div>
        {session ? <>
          <button role="menuitem" onClick={() => { close(); openWindow('auth-account'); }}><img src={publicAsset('/retro-user.svg')} alt="" />Mein Konto</button>
          <button role="menuitem" disabled={busy} onClick={() => { close(); void logout(); }}><img src={publicAsset('/retro-login.svg')} alt="" />Abmelden</button>
        </> : <>
          <button role="menuitem" onClick={() => { close(); openWindow('auth-login'); }}><img src={publicAsset('/retro-login.svg')} alt="" />Anmelden</button>
          <button role="menuitem" onClick={() => { close(); openWindow('auth-register'); }}><img src={publicAsset('/retro-register.svg')} alt="" />Registrieren</button>
        </>}
      </div>
    </div>}
  </div>;
}
