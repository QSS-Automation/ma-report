import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../auth/msalConfig";

export default function Login() {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [isTeams, setIsTeams] = useState(false);


    const handleTeamsSSO = async () => {
    setLoading(true);
    try {
      // Teams SSO — silent token acquisition using Teams identity
      const { authentication } = await import("@microsoft/teams-js");
      authentication.getAuthToken({
        successCallback: async (token) => {
          // Exchange Teams token for MSAL token silently
          await instance.ssoSilent({
            ...loginRequest,
            loginHint: "", // Teams provides identity
          }).catch(() => {
            // Fallback to redirect if silent fails
            instance.loginRedirect(loginRequest);
          });
        },
        failureCallback: () => {
          instance.loginRedirect(loginRequest);
        }
      });
    } catch {
      instance.loginRedirect(loginRequest);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    // Detect if running inside Teams
    import("@microsoft/teams-js").then(({ app }) => {
      app.initialize().then(() => {
        app.getContext().then(() => {
          setIsTeams(true);
          // Auto-trigger SSO in Teams
          handleTeamsSSO();
        }).catch(() => {
          setIsTeams(false);
        });
      }).catch(() => setIsTeams(false));
    }).catch(() => setIsTeams(false));
  }, []);


  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isTeams) {
        await handleTeamsSSO();
      } else {
        await instance.loginRedirect(loginRequest);
      }
    } catch (e) {
      console.error("Login error:", e);
      setLoading(false);
    }
  };

  if (isTeams && loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#888780", fontSize:13 }}>
      Signing in…
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0d1117" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, fontWeight:700, color:"#e6edf3", marginBottom:8 }}>Quandatics MA</div>
        <div style={{ color:"#8b949e", marginBottom:32, fontSize:13 }}>Management Accounting Report</div>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            display:"flex", alignItems:"center", gap:10,
            background: loading ? "#0f3d6b" : "#185FA5",
            color:"#fff", border:"none",
            padding:"12px 24px", borderRadius:8, fontSize:14,
            fontWeight:600, cursor: loading ? "not-allowed" : "pointer",
            margin:"0 auto", opacity: loading ? 0.7 : 1,
            transition:"all .15s"
          }}>
          {loading ? "Signing in…" : "Sign in with Microsoft"}
        </button>
      </div>
    </div>
  );
}
