import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { dropNoopResizeEvents } from '@/utils/popup-resize';
import '@/styles/global.css';

// Must run before React mounts, so the filter is registered ahead of any
// listener the UI libraries add.
dropNoopResizeEvents();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
