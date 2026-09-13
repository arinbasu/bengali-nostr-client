import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AccountProvider } from "./contexts/AccountContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import { closeAllRelays } from "./lib/nostr";

// Close all relay WebSocket connections when the page is being unloaded.
// `pagehide` is the reliable event on iOS Safari (beforeunload often doesn't fire).
window.addEventListener("pagehide", () => {
  closeAllRelays();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AccountProvider>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </AccountProvider>
  </StrictMode>
);