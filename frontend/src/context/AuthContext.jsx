import React, { createContext, useContext, useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import * as microsoftTeams from "@microsoft/teams-js";
import API, { setCurrentUserId, clearCurrentUserId } from "../services/api";
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
  // Explicitly true only when the backend rejected the user with a 403
  // (not found / inactive in ops_QM.users) — distinct from "haven't
  // resolved auth yet", so we don't show Access Denied prematurely.
  const [denied, setDenied] = useState(false);

  useEffect(() => {

    // ── Teams — check sessionStorage first ───────────────────
    const cached = sessionStorage.getItem("teams_user");
    if (cached) {
      const cachedUser = JSON.parse(cached);
      setUser(cachedUser);
      setCurrentUserId(cachedUser.user_id);
      setLoading(false);
      return;
    }

    // ── Teams SSO ─────────────────────────────────────────────
    if (isInTeams() && accounts.length === 0) {
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
          setCurrentUserId(r.data.user_id);
          setLoading(false);
        })
        .catch(e => {
          console.error("[Auth] Teams SSO failed:", e);
          // Only a genuine 403 from the backend (user not found/inactive)
          // counts as "denied". Anything else (timeout, network blip) just
          // fails this attempt — Login screen can retry, not a hard block.
          if (e?.response?.status === 403) setDenied(true);
          setUser(null);
          clearCurrentUserId();
          setLoading(false);
        });
      return;
    }

    // ── Normal browser MSAL flow ──────────────────────────────
    if (accounts.length === 0) {
      instance.ssoSilent(loginRequest)
        .catch(() => setLoading(false));
      return;
    }

    if (accounts.length > 0) {
      API.get("/api/auth/me", { params: { user_id: accounts[0].username } })
        .then(r => {
          setUser(r.data);
          setCurrentUserId(r.data.user_id);
        })
        .catch(e => {
          // FIX: previously this fabricated a fallback identity
          // ({ user_id, display_name, role: "staff" }) on ANY failure,
          // including a 403 "User not found or inactive." from the
          // backend. That meant anyone who could sign into Microsoft —
          // regardless of whether they were in ops_QM.users — got into
          // the app as a synthetic "staff" user. Deny instead.
          if (e?.response?.status === 403) setDenied(true);
          setUser(null);
          clearCurrentUserId();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [accounts]);

  return (
    <AuthContext.Provider value={{ user, loading, denied }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
