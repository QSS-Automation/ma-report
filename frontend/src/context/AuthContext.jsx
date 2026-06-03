import React, { createContext, useContext, useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { loginRequest } from "../auth/msalConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { accounts, instance } = useMsal();
  const [user, setUser] = useState(null);   // {user_id, display_name, role}
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  // Try silent SSO first — if MS session exists, auto-login without button click
  if (accounts.length === 0) {
    instance.ssoSilent(loginRequest)
      .catch(() => {
        // No existing session — user must click Sign In
        setLoading(false);
      });
    return;
  }

  if (accounts.length > 0) {
    axios.get(`/api/auth/me?user_id=${accounts[0].username}`)

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
