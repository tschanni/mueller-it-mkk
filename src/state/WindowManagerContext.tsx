import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppComponentType = 'company' | 'gallery' | 'calculator' | 'pong' | 'music' | 'impressum' | 'gameservers' | 'auth-login' | 'auth-register' | 'auth-reset' | 'auth-new-password' | 'auth-account' | 'auth-message';

export interface Win98Window {
  id: string;
  title: string;
  app: AppComponentType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
  isMinimized: boolean;
  zIndex: number;
}

interface WindowManagerContextValue {
  windows: Win98Window[];
  focusedId: string | null;
  openWindow: (w: Omit<Win98Window, 'id' | 'zIndex' | 'isMinimized'> & { id?: string }) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  focusWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
}

const WindowManagerContext = createContext<WindowManagerContextValue | undefined>(undefined);

let idCounter = 1;

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<Win98Window[]>([]);
  const [topZ, setTopZ] = useState(1);
  const [focusedId, setFocusedId] = useState<string | null>(windows[0]?.id ?? null);

  const focusWindow = useCallback((id: string) => {
    setTopZ((prev) => prev + 1);
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, zIndex: topZ + 1 } : w));
    setFocusedId(id);
  }, [topZ]);

  const openWindow = useCallback((w: Omit<Win98Window, 'id' | 'zIndex' | 'isMinimized'> & { id?: string }) => {
    const newId = w.id ?? String(idCounter++);
    setTopZ((prev) => prev + 1);
    setWindows((prev) => ([...prev, { ...w, id: newId, isMinimized: false, zIndex: topZ + 1 }]));
    setFocusedId(newId);
    return newId;
  }, [topZ]);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter(w => w.id !== id));
    setFocusedId((curr) => (curr === id ? null : curr));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    setFocusedId((curr) => (curr === id ? null : curr));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setTopZ((prev) => prev + 1);
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: topZ + 1 } : w));
    setFocusedId(id);
  }, [topZ]);

  const toggleMinimize = useCallback((id: string) => {
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, isMinimized: !w.isMinimized } : w));
    setFocusedId((curr) => (curr === id ? null : id));
    setTopZ((prev) => prev + 1);
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, zIndex: topZ + 1 } : w));
  }, [topZ]);

  const maximizeWindow = useCallback((id: string) => { setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)); }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const value = useMemo<WindowManagerContextValue>(() => ({
    windows,
    focusedId,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMinimize,
    focusWindow,
    moveWindow,
    maximizeWindow,
  }), [windows, focusedId, openWindow, closeWindow, minimizeWindow, restoreWindow, toggleMinimize, focusWindow, moveWindow, maximizeWindow]);

  return (
    <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider');
  return ctx;
};
