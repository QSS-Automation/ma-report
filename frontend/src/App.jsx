import React, { useState, useEffect } from "react";
import PnL from "./components/PnL/PnL";
import BS from "./components/BS/BS";
import Sales from "./components/Sales/Sales";
import Purchases from "./components/Purchases/Purchases";
import MFRS from "./components/MFRS/MFRS";
import Log from "./components/AdjLog/AdjLog";
import AdjTasks from "./components/AdjTasks/AdjTasks";
import Toast from "./components/Shared/Toast";
import { getConfig, getEntities } from "./services/api";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Auth/Login";
console.log("TENANT:", process.env.REACT_APP_MS_TENANT_ID);
console.log("CLIENT:", process.env.REACT_APP_MS_CLIENT_ID);

const NAV = [
  {
    section: "Financial Reports",
    items: [
      {
        id: "pnl", label: "P&L Statement",
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M4 11l2.5-3.5 2 2.5L11 5"/></svg>,
      },
      {
        id: "tb", label: "Balance Sheet",
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M5.5 3v3.5M10.5 3v3.5"/></svg>,
      },
    ],
  },
  {
    section: "Adjustment",
    items: [
      {
        id: "sales", label: "Sales", roles: ["staff","manager","admin"],
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 1v8M5.5 6l2.5 3 2.5-3"/></svg>,
      },
      {
        id: "pur", label: "Purchases", roles: ["staff","manager","admin"],
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 7V1M5.5 4l2.5-3 2.5 3"/></svg>,
      },
      {
        id: "adjtask", label: "Adj. Tasks", roles: ["staff","manager","admin"],
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 7l2 2 4-4"/></svg>,
      },
      {
        id: "adjlog", label: "Log", roles: ["manager","admin"],
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9h4"/></svg>,
      },
    ],
  },
  {
    section: "MFRS",
    items: [
      {
        id: "mfrs-sales", label: "Sales",
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 1v8M5.5 6l2.5 3 2.5-3"/></svg>,
      },
      {
        id: "mfrs-pur", label: "Purchases",
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 7V1M5.5 4l2.5-3 2.5 3"/></svg>,
      },
    ],
  },
];

export default function App() {
  // ── ALL hooks first — no early returns before this block ──
  const isAuthenticated = useIsAuthenticated();
  const { user, loading } = useAuth();
  const [tab,          setTab]          = useState("pnl");
  const [mfrsSub,      setMfrsSub]      = useState("sales");
  const [refreshLabel, setRefreshLabel] = useState("");
  const [entity,       setEntity]       = useState("QM");
  const [entities,     setEntities]     = useState([{ entity_code: "QM", display_name: "Quandatics Malaysia" }]);

  // Fetch config refresh label
  useEffect(() => {
    if (!isAuthenticated) return;
    getConfig(entity)
      .then((r) => {
        const ts = r.data?.staging_refreshed_at;
        if (ts) {
          const mins = Math.round((Date.now() - new Date(ts)) / 60000);
          setRefreshLabel(mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, entity]);

  // Fetch available entities
  useEffect(() => {
    if (!isAuthenticated) return;
    getEntities()
      .then(r => { if (r.data?.length) setEntities(r.data); })
      .catch(() => {});
  }, [isAuthenticated]);

  // ── Early returns AFTER all hooks ──
  if (!isAuthenticated) return <Login />;
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#888780", fontSize:13 }}>
      Loading…
    </div>
  );

  const handleNav = (id) => {
    if (id === "mfrs-sales") { setTab("mfrs"); setMfrsSub("sales"); }
    else if (id === "mfrs-pur") { setTab("mfrs"); setMfrsSub("pur"); }
    else setTab(id);
  };

  const activeId = tab === "mfrs" ? `mfrs-${mfrsSub}` : tab;

  return (
    <div className="shell">

      {/* ── Sidebar ── */}
      <div className="sb">
        <div className="sb-brand">
          <div className="sb-logo">Q</div>
          <div>
            <div className="sb-name">Quandatics</div>
            <div className="sb-tag">Management Accounts</div>
          </div>
        </div>

       

        {NAV.map((group) => (
          <React.Fragment key={group.section}>
            <div className="sb-sec">{group.section}</div>
            {group.items
              .filter(item => !item.roles || item.roles.includes(user?.role))
              .map((item) => (
                <div
                  key={item.id}
                  className={"sb-item" + (activeId === item.id ? " on" : "")}
                  onClick={() => handleNav(item.id)}
                >
                  {item.icon}
                  {item.label}
                </div>
              ))}
          </React.Fragment>
        ))}

        <div className="sb-foot">
          v1.0 · {entity} · 2026
          {refreshLabel && (
            <span style={{ marginLeft: 6, color: "#b4b2a9" }}>
              · refreshed {refreshLabel}
            </span>
          )}
          {user && (
            <div style={{ marginTop: 6, color: "#b4b2a9", fontSize: 10 }}>
              {user.display_name} · {user.role}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="main">
        <div style={{ display: tab==="pnl"   ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><PnL       entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="tb"    ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><BS        entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="sales" ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Sales     entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="pur"   ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Purchases entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="mfrs"  ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><MFRS      entity={entity} setEntity={setEntity} entities={entities} defaultSub={mfrsSub} /></div>
        <div style={{ display: tab==="adjtask" ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><AdjTasks  entity={entity} entities={entities} /></div>
        <div style={{ display: tab==="adjlog"  ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Log       entity={entity} entities={entities} /></div>
      </div>

      <Toast />
    </div>
  );
}
