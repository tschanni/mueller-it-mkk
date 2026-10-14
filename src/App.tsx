import React from 'react';
import './App.css';
import { WindowManagerProvider } from './state/WindowManagerContext';
import { Desktop } from './components/Desktop/Desktop';
import { ServerCacheProvider } from './apps/GameserverManager/ServerCache';

function App() {
  return (
    <ServerCacheProvider>
      <WindowManagerProvider>
        <Desktop />
      </WindowManagerProvider>
    </ServerCacheProvider>
  );
}

export default App;
