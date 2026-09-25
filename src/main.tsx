import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { AuthGate } from './auth/AuthGate';
import './index.css';
// Loaded last so the component system wins on the cascade.
import './styles/system.css';

// Apply the saved theme before the first paint, so the login screen matches
// the app instead of flashing the dark default.
try {
  const saved = localStorage.getItem('rsapp_theme_mode');
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
} catch {
  document.documentElement.setAttribute('data-theme', 'light');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
);
