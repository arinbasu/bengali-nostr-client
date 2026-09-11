import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AccountProvider } from './contexts/AccountContext.jsx';
import { ProfileProvider } from "./contexts/ProfileContext";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccountProvider>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </AccountProvider>
  </StrictMode>,
);
