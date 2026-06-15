import React, { createContext, useContext, useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import API from "../services/api";
import { loginRequest } from "../auth/msalConfig";
 
const AuthContext = createContext(null);
 
export function AuthProvider({ children }) {
  const { accounts, instance } = useMsal();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    if (accounts.length === 0) {
      instance.ssoSilent(loginRequest)
        .catch(() => {
          setLoading(false);
        });
      return;
    }
 
    if (accounts.length > 0) {
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
