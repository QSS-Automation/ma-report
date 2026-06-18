import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../auth/msalConfig";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";

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
        .then(() => authentication.getAuthToken({
          resources: [`api://${process.env.REACT_APP_MS_CLIENT_ID}`]
        }))
        .then(token => {
          // Decode token to get user email
          const payload = JSON.parse(atob(token.split(".")[1]));
          const userId = payload.preferred_username || payload.upn || payload.email || "";
          // Load user from backend
          return API.get("/api/auth/me", { params: { user_id: userId } });
        })
        .then(() => {
          // Auth successful — page will re-render via AuthContext
          setLoading(false);
        })
        .catch(e => {
          console.error("[Login] Teams SSO failed:", e);
          setError("Teams sign-in failed: "+e.message);
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
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
        height:"100vh",color:"#888780",fontSize:13}}>
      Signing in with Teams…
    </div>
  );

  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
        height:"100vh",background:"#0d1117"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,fontWeight:700,color:"#e6edf3",marginBottom:8}}>
          Quandatics MA
        </div>
        <div style={{color:"#8b949e",marginBottom:32,fontSize:13}}>
          Management Accounting Report
        </div>
        {error&&(
          <div style={{color:"#F09595",fontSize:12,marginBottom:16,
              background:"#2d1515",padding:"8px 16px",borderRadius:6}}>
            {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            display:"flex",alignItems:"center",gap:10,
            background: loading?"#0f3d6b":"#185FA5",
            color:"#fff",border:"none",
            padding:"12px 24px",borderRadius:8,fontSize:14,
            fontWeight:600,cursor: loading?"not-allowed":"pointer",
            margin:"0 auto",opacity: loading?0.7:1,
            transition:"all .15s"
          }}>
          {loading?"Signing in…":"Sign in with Microsoft"}
        </button>
      </div>
    </div>
  );
}
