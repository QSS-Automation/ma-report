import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { Loader2 } from "lucide-react";
import { loginRequest } from "../../auth/msalConfig";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

const isInTeams = () =>
  window.parent !== window ||
  window.navigator.userAgent.toLowerCase().includes("teams") ||
  window.location.search.includes("inTeams=1");

export default function Login() {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [inTeams, setInTeams] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if(!isInTeams()) return;

    // Detected Teams — auto SSO
    setInTeams(true);
    setLoading(true);

    import("@microsoft/teams-js").then(({ app, authentication }) => {
      app.initialize()
        .then(() => authentication.getAuthToken())
        .then(async token => {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const userId = payload.preferred_username || payload.upn || payload.email || "";
        
          // Try to establish MSAL session silently
          try {
            await instance.ssoSilent({ ...loginRequest, loginHint: userId });
          } catch(e) {
            console.log("[Login] ssoSilent skipped:", e.message);
          }
        
          return API.get("/api/auth/me", { params: { user_id: userId } });
        })
        .then(() => {
          setLoading(false);
        })
        .catch(e => {
          console.error("[Login] Teams SSO failed:", e);
          setError("SSO failed: "+(e?.message || e?.errorCode || e?.error || String(e)));
          setLoading(false);
        });
    }).catch(e => {
      console.error("[Login] teams-js import failed:", e);
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    if(loading) return;
    if(inTeams){
      // Don't redirect in Teams iframe — show error instead
      setError("Please close and reopen this tab in Teams to sign in.");
      return;
    }
    setLoading(true);
    try{
      await instance.loginRedirect(loginRequest);
    }catch(e){
      console.error("[Login] loginRedirect failed:", e);
      setLoading(false);
    }
  };

  if(inTeams && loading) return(
    <div className="flex h-screen items-center justify-center bg-background text-[14px] text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Signing in with Teams…
    </div>
  );

  return(
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm rounded-lg border-border bg-card p-8 text-center shadow-lg">
        <div className="mb-2 text-[28px] font-bold text-foreground">
          Quandatics MA
        </div>
        <div className="mb-8 text-[14px] text-muted-foreground">
          Management Accounting Report
        </div>
        {error&&(
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <Button
          onClick={handleLogin}
          disabled={loading}
          className="mx-auto flex h-auto items-center gap-2.5 rounded-lg px-6 py-3 text-sm font-semibold"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading?"Signing in…":"Sign in with Microsoft"}
        </Button>
      </Card>
    </div>
  );
}
