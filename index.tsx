import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { SyncProvider } from './services/sync';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find the root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <SyncProvider>
      <App />
    </SyncProvider>
  </StrictMode>,
);
