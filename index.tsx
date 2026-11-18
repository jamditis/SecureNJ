import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { I18nProvider } from './services/i18n';
import { SyncProvider } from './services/sync';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find the root element');
}

// A different site can put this app in a frame and trick the user into a
// click, for example on "Delete all". The app does not run in a frame.
if (window.self !== window.top) {
  throw new Error('This app does not run inside a frame. Open it in its own tab.');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <SyncProvider>
        <App />
      </SyncProvider>
    </I18nProvider>
  </StrictMode>,
);

// The service worker keeps a copy of the app files, so that the app opens
// with no connection. It is not used in dev mode, where files change often.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
