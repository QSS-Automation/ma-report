import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./auth/msalConfig";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

const msalInstance = new PublicClientApplication(msalConfig);

function renderApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <ThemeProvider>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </ThemeProvider>
  );
}

msalInstance.initialize().then(() => {
  // Handle redirect response before rendering. A rejected promise here
  // (e.g. stale/mismatched redirect state in sessionStorage) must not
  // block the app from mounting — without this catch, render() never
  // runs and the page stays blank with only a console error.
  msalInstance.handleRedirectPromise()
    .catch((e) => console.error("[MSAL] handleRedirectPromise failed:", e))
    .finally(renderApp);
});