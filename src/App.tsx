import React from 'react';
import './App.css';
import { WindowManagerProvider } from './state/WindowManagerContext';
import { Desktop } from './components/Desktop/Desktop';
import { ServerCacheProvider } from './apps/GameserverManager/ServerCache';
import { AuthProvider } from './auth/AuthContext';

function App() {
  return (
    <AuthProvider>
      <ServerCacheProvider>
        <WindowManagerProvider>
          <Desktop />
        </WindowManagerProvider>
      </ServerCacheProvider>
    </AuthProvider>
  );
}

export default App;
