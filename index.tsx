
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initWebAnalytics } from './utils/webAnalytics';

// First-Party-Tracking initialisieren (Seitenaufrufe, Klicks, Sessions).
// Selbst-verdrahtet über window-Events, respektiert Opt-out. Siehe TRACKING.md.
initWebAnalytics();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
