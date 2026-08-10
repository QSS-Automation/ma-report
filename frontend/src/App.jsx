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
import OrderListTab from "./components/OrderList/OrderListTab";

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
  {
    section: "Order List",
    items: [
      {
        id: "order-list", label: "Order List",
        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 6h14M5 6v7M11 6v7"/></svg>,
      },
    ],
  },
];

// Shown when the user successfully signs into Microsoft (isAuthenticated)
// but is not found / inactive in ops_QM.users — i.e. AuthContext resolved
// `user` to null. This is the actual access gate now that Azure AD
// "Assignment required" is no longer doing that job.
function AccessDenied() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0d1117", color: "#8b949e", fontSize: 13, textAlign: "center",
      padding: 24,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#e6edf3", marginBottom: 10 }}>
        Access Denied
      </div>
      <div style={{ marginBottom: 4 }}>
        Your account isn't registered for the Quandatics MA Report.
      </div>
      <div>
        Contact your administrator to request access.
      </div>
    </div>
  );
}

export default function App() {
  // ── ALL hooks first — no early returns before this block ──
  const isAuthenticated = useIsAuthenticated();
  const { user, loading, denied } = useAuth();
  const [tab,          setTab]          = useState("pnl");
  const [mfrsSub,      setMfrsSub]      = useState("sales");
  const [refreshLabel, setRefreshLabel] = useState("");
  const [entity,       setEntity]       = useState("QM");
  const [entities,     setEntities]     = useState([{ entity_code: "QM", display_name: "Quandatics Malaysia" }]);

  // Teams users never set isAuthenticated (they bypass MSAL entirely and
  // authenticate via Teams' own SSO token + sessionStorage caching), so
  // this must stay OR — requiring AND would permanently lock out every
  // Teams user, since isAuthenticated can never become true for them.
  // The actual "was this user rejected by the backend" check lives in
  // the separate `denied` flag below, not in this readiness check.
  const isReady = isAuthenticated || !!user;

  // Fetch config refresh label
  useEffect(() => {
    if (!isReady) return;
    getConfig(entity)
      .then((r) => {
        const ts = r.data?.staging_refreshed_at;
        if (ts) {
          const mins = Math.round((Date.now() - new Date(ts)) / 60000);
          setRefreshLabel(mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`);
        }
      })
      .catch(() => {});
  }, [isReady, entity]);

  // Fetch available entities — scoped to this specific user (see
  // /api/auth/entities: entity_scope='all' users get everything,
  // 'restricted' users get only what's in ops_QM.user_entities).
  useEffect(() => {
    if (!isReady || !user) return;
    getEntities()
      .then(r => {
        if (!r.data?.length) return;
        setEntities(r.data);
        // FIX: `entity` state defaults to "QM" on load. If this user is
        // restricted and "QM" isn't in their allowed list, every API call
        // (sales, order-list, tasks, log, etc.) keeps silently requesting
        // "QM" forever — even though the <select> visually shows the only
        // actually-allowed option (e.g. "QArmour"), since a browser
        // <select> falls back to displaying the first <option> when the
        // controlled `value` doesn't match any of them. Reconcile state
        // with reality: if the current entity isn't allowed, switch to
        // the first one that is.
        const allowedCodes = r.data.map(e => e.entity_code);
        if (!allowedCodes.includes(entity)) {
          setEntity(r.data[0].entity_code);
        }
      })
      .catch(() => {});
  }, [isReady, user, entity]);

  // ── Early returns AFTER all hooks ──
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#888780", fontSize:13 }}>
      Loading…
    </div>
  );
  if (denied) return <AccessDenied />;
  if (!isAuthenticated && !user) return <Login />;

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
        <div style={{ display: tab==="pnl"        ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><PnL          entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="tb"         ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><BS           entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="sales"      ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Sales        entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="pur"        ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Purchases    entity={entity} setEntity={setEntity} entities={entities} /></div>
        <div style={{ display: tab==="mfrs"       ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><MFRS         entity={entity} setEntity={setEntity} entities={entities} defaultSub={mfrsSub} /></div>
        <div style={{ display: tab==="adjtask"    ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><AdjTasks     entity={entity} entities={entities} /></div>
        <div style={{ display: tab==="adjlog"     ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><Log          entity={entity} entities={entities} /></div>
        <div style={{ display: tab==="order-list" ? "flex":"none", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 }}><OrderListTab entity={entity} setEntity={setEntity} entities={entities} /></div>
      </div>

      <Toast />
    </div>
  );
}
