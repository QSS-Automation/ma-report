import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./auth/msalConfig";
import { AuthProvider } from "./context/AuthContext";
 
const msalInstance = new PublicClientApplication(msalConfig);
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(err => {
    console.warn("Redirect promise error (ignored):", err);
  }).finally(() => {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(
      
        <MsalProvider instance={msalInstance}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MsalProvider>
    
    );
  });
});
