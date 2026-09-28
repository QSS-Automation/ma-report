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
  // Local-dev-bypass-only: set when REACT_APP_DEV_USER_ID's lookup fails
  // for a reason other than "denied" (e.g. the backend/DB is unreachable),
  // so App.jsx can show what's actually wrong instead of silently falling
  // back to a Login screen whose "Sign in with Microsoft" button can't
  // work locally anyway (no localhost redirect URI registered in Azure AD).
  const [devError, setDevError] = useState("");

  useEffect(() => {

    // ── Local dev UI-review bypass — NEVER set in production ──
    // Skips the backend entirely (no /api/auth/me call) so the app shell
    // and tab layouts can be reviewed even while the database is
    // unreachable. Only for visually checking the redesign — any data a
    // tab fetches from the API will still fail until the DB is reachable.
    if (process.env.REACT_APP_DEV_FAKE_USER) {
      setUser({ user_id: "dev@local", display_name: "Local Dev", role: "admin" });
      setCurrentUserId("dev@local");
      setLoading(false);
      return;
    }

    // ── Local dev bypass — NEVER set in production ───────────
    // Azure AD's app registration only allows redirecting back to the
    // production Static Web App URL (the localhost redirect URI was
    // removed on go-live), so the interactive MSAL flow can never
    // complete on a local dev server regardless of client/tenant ID.
    // When REACT_APP_DEV_USER_ID is present (only in a developer's own
    // untracked local frontend/.env — the real Azure Static Web App env
    // vars never define it), skip Teams/MSAL entirely and resolve the
    // user directly, exactly like the post-login lookup below does.
    const devUserId = process.env.REACT_APP_DEV_USER_ID;
    if (devUserId) {
      API.get("/api/auth/me", { params: { user_id: devUserId } })
        .then(r => { setUser(r.data); setCurrentUserId(r.data.user_id); })
        .catch(e => {
          if (e?.response?.status === 403) {
            setDenied(true);
          } else {
            setDevError(
              `Could not look up "${devUserId}": ` +
              (e?.response?.data?.detail || e?.message || String(e))
            );
          }
          setUser(null);
          clearCurrentUserId();
        })
        .finally(() => setLoading(false));
      return;
    }

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
    <AuthContext.Provider value={{ user, loading, denied, devError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
