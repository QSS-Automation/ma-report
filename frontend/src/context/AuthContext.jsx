import React, { createContext, useContext, useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import * as microsoftTeams from "@microsoft/teams-js";
import API from "../services/api";
import { loginRequest, teamsLoginRequest } from "../auth/msalConfig";

const AuthContext = createContext(null);

const isInTeams = () =>
  window.parent !== window ||
  window.navigator.userAgent.toLowerCase().includes("teams") ||
  window.location.search.includes("inTeams=1");

export function AuthProvider({ children }) {
  const { accounts, instance } = useMsal();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  
    // ── Teams — check sessionStorage first ───────────────────
    const cached = sessionStorage.getItem("teams_user");
    if(cached){
      setUser(JSON.parse(cached));
      setLoading(false);
      return;
    }
  
    // ── Teams SSO ─────────────────────────────────────────────
    if(isInTeams() && accounts.length === 0){
      microsoftTeams.app.initialize()
        .then(() => microsoftTeams.authentication.getAuthToken())
        .then(token => {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const userId = payload.preferred_username || payload.upn || payload.email || "";
          return API.get("/api/auth/me", { params: { user_id: userId } });
        })
        .then(r => {
          // Store in sessionStorage — persists across re-renders
          sessionStorage.setItem("teams_user", JSON.stringify(r.data));
          setUser(r.data);
          setLoading(false);
        })
        .catch(e => {
          console.error("[Auth] Teams SSO failed:", e);
          setLoading(false);
        });
      return;
    }
  
    // ── Normal browser MSAL flow ──────────────────────────────
    if(accounts.length === 0){
      instance.ssoSilent(loginRequest)
        .catch(() => setLoading(false));
      return;
    }
  
    if(accounts.length > 0){
      API.get("/api/auth/me", { params: { user_id: accounts[0].username } })
        .then(r => setUser(r.data))
        .catch(() => setUser({
          user_id:      accounts[0].username,
          display_name: accounts[0].name,
          role:         "staff"
        }))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [accounts]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
