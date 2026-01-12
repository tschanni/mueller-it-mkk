import React from 'react';
import './App.css';
import { WindowManagerProvider } from './state/WindowManagerContext';
import { Desktop } from './components/Desktop/Desktop';

function App() {
  return (
    <WindowManagerProvider>
      <Desktop />
    </WindowManagerProvider>
  );
}

export default App;
