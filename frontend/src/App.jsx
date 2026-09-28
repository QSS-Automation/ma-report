import React, { useState, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, Sun, Moon, ChevronDown, Loader2 } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./components/ui/select";
import PnL from "./components/PnL/PnL";
import BS from "./components/BS/BS";
import Sales from "./components/Sales/Sales";
import Purchases from "./components/Purchases/Purchases";
import MFRS from "./components/MFRS/MFRS";
import Log from "./components/AdjLog/AdjLog";
import AdjTasks from "./components/AdjTasks/AdjTasks";
import Toast from "./components/Shared/Toast";
import { getEntities } from "./services/api";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Auth/Login";
import OrderListTab from "./components/OrderList/OrderListTab";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "./components/ui/dropdown-menu";
import { useTheme } from "./context/ThemeContext";
import { cn } from "./lib/utils";

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
function StatusScreen({ title, children }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center text-[13px] text-muted-foreground">
      {title && <div className="mb-2.5 font-display text-[22px] font-bold text-foreground">{title}</div>}
      {children}
    </div>
  );
}

function AccessDenied() {
  return (
    <StatusScreen title="Access Denied">
      <div className="mb-1">Your account isn't registered for the Quandatics MA Report.</div>
      <div>Contact your administrator to request access.</div>
    </StatusScreen>
  );
}

// Only ever shown when REACT_APP_DEV_USER_ID (local-dev bypass) is set and
// its lookup failed for a reason other than "denied" — surfaces the real
// cause (e.g. the backend can't reach the database) instead of silently
// falling back to the Login screen's "Sign in with Microsoft" button,
// which can't work locally anyway (no localhost redirect URI in Azure AD).
function DevError({ message }) {
  return (
    <StatusScreen title="Dev bypass — lookup failed">
      <div className="max-w-md">{message}</div>
      <div className="mt-3 max-w-md text-[11px] text-subtle">
        Fix the underlying issue (usually the backend can't reach the database) and reload — this screen only appears because REACT_APP_DEV_USER_ID is set in your local .env.
      </div>
    </StatusScreen>
  );
}

// Shell surfaces (top bar + sidebar) use fixed neutral hexes rather than
// the shared tokens so they stay plain white / cool dark-grey in both
// themes (the dark palette must not drift warm/yellow).
const SB_BORDER = "border-[#e5e7eb] dark:border-[#33383e]";
const SB_BG = "bg-white dark:bg-[#1b1e22]";
const SB_HOVER = "hover:bg-[#f3f5f8] dark:hover:bg-[#282c31]";
const SB_TOGGLE_BTN = cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-subtle transition-colors hover:text-foreground", SB_HOVER);
// DS Ops Hub mockup `.nav`: 14px, 40px tall, 8px radius, ink text.
const SB_ITEM_BASE = cn(
  "relative flex min-h-10 w-full select-none items-center gap-2.5 rounded-lg bg-transparent px-3 text-left text-sm text-[#1b2422] transition-colors duration-150 cursor-pointer dark:text-[#d8dadd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  SB_HOVER
);
// Active fill is the fixed brand blue in both themes. Keep `dark:text-white`
// here: Tailwind compiles dark: variants as a two-class selector, which
// out-ranks a plain `.text-white` — so the active item's white text wins
// over SB_ITEM_BASE's dark:text-*.
const SB_ITEM_ON = "bg-[#007FFF] text-white dark:text-white font-semibold hover:bg-[#007FFF] dark:hover:bg-[#007FFF]";

// Two nav items are both labelled "Sales"/"Purchases" — prefix the MFRS ones
// wherever the section heading isn't visible (mobile strip).
const shortLabel = (item) => (item.id.startsWith("mfrs-") ? `MFRS ${item.label}` : item.label);

function Brand({ collapsed = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[15px] font-extrabold text-primary-foreground">Q</div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14px] font-bold">Quandatics</div>
          <div className="truncate text-[11.5px] font-medium text-subtle">MA Report</div>
        </div>
      )}
    </div>
  );
}

// One Entity selector for the whole app. In the collapsed rail it shrinks
// to just the entity code.
function EntitySelect({ entity, entities, onChange, collapsed = false }) {
  return (
    <Select value={entity} onValueChange={onChange}>
      <SelectTrigger aria-label="Entity" title="Entity"
        className={cn("h-9 [&>span]:truncate", collapsed ? "w-12 justify-center px-1 [&>svg]:hidden" : "w-full")}>
        {collapsed ? <span className="text-xs font-semibold">{entity}</span> : <SelectValue />}
      </SelectTrigger>
      <SelectContent align="start">
        {entities.map(e => (
          <SelectItem key={e.entity_code} value={e.entity_code}>
            {e.entity_code}{e.display_name ? ` — ${e.display_name}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Desktop sidebar nav (md and up). `collapsed` shrinks it to an icon rail.
function SidebarNav({ nav, activeId, user, onNav, collapsed = false }) {
  return (
    <>
      <nav className={cn("flex-1 overflow-y-auto pb-3 pt-1", collapsed ? "px-2" : "px-3")}>
        {nav.map((group) => {
          const items = group.items.filter(item => !item.roles || item.roles.includes(user?.role));
          if (!items.length) return null;
          return (
            <div key={group.section} className={cn(collapsed && "mt-2 pt-2 first:mt-0 first:pt-0")}>
              {!collapsed && (
                <div className="px-3 pb-1.5 pt-4 text-xs font-semibold text-muted-foreground">{group.section}</div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isOn = activeId === item.id;
                  const fullLabel = `${group.section} · ${item.label}`;
                  const el = (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isOn ? "page" : undefined}
                      aria-label={collapsed ? fullLabel : undefined}
                      className={cn(SB_ITEM_BASE, isOn && SB_ITEM_ON, collapsed && "justify-center px-0")}
                      onClick={() => onNav(item.id)}
                    >
                      <span className={cn("shrink-0", isOn ? "opacity-100" : "opacity-60")}>{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                  if (!collapsed) return el;
                  return (
                    <Tooltip key={item.id} delayDuration={200}>
                      <TooltipTrigger asChild>{el}</TooltipTrigger>
                      <TooltipContent side="right">{fullLabel}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}

// Phones / small tablets (below md): the sidebar becomes a horizontally
// scrolling strip of nav chips under the top bar (mockup's small-screen layout).
function MobileNav({ nav, activeId, user, onNav }) {
  const items = nav.flatMap(g => g.items).filter(item => !item.roles || item.roles.includes(user?.role));
  return (
    <nav className={cn("flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-2 md:hidden", SB_BORDER, SB_BG)}>
      {items.map(item => {
        const isOn = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isOn ? "page" : undefined}
            onClick={() => onNav(item.id)}
            className={cn(SB_ITEM_BASE, "w-auto shrink-0 whitespace-nowrap", isOn && SB_ITEM_ON)}
          >
            {shortLabel(item)}
          </button>
        );
      })}
    </nav>
  );
}

// Account button + menu. `compact` = avatar only (collapsed rail, phones);
// `side` = which way the menu opens (up from the sidebar's bottom edge).
function AccountMenu({ user, entity, compact = false, side = "top" }) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const initials = (user?.display_name || user?.user_id || "?")
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className={cn("flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors", !compact && "w-full", SB_BG, SB_HOVER)} aria-label="Account menu">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
            {initials}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-[#1b2422] dark:text-[#d8dadd]">{user?.display_name || "—"}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">{user?.role}</span>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-subtle transition-transform", (side === "top") !== open && "rotate-180")} />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={side === "top" ? "start" : "end"} side={side} sideOffset={8} className={cn("w-60 rounded-xl border p-0 shadow-lg", SB_BORDER, SB_BG)}>
        <DropdownMenuLabel className={cn("border-b px-4 py-3 font-normal", SB_BORDER)}>
          <div className="text-sm font-semibold text-[#1b2422] dark:text-white">{user?.display_name || "—"}</div>
          <div className="mb-2 truncate text-xs text-subtle">{user?.user_id}</div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold capitalize text-primary">
            {user?.role} · {entity}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={toggleTheme} className={cn("rounded-none px-4 py-2.5 text-sm", SB_HOVER)}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Every nav id is also a URL hash route (#/pnl, #/mfrs-pur, …) so refresh,
// bookmarks and the browser Back button all land on the right tab.
const NAV_IDS = NAV.flatMap(g => g.items.map(i => i.id));
const readRoute = () => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return NAV_IDS.includes(id) ? id : "pnl";
};
// Which mounted tab component a route renders into (both MFRS routes share one).
const slotOf = (route) => (route.startsWith("mfrs-") ? "mfrs" : route);

export default function App() {
  // ── ALL hooks first — no early returns before this block ──
  const isAuthenticated = useIsAuthenticated();
  const { user, loading, denied, devError } = useAuth();
  const [route,        setRoute]        = useState(readRoute);
  // Tabs are mounted the first time they're opened (not all at startup),
  // then kept mounted so switching back keeps their filters/results.
  const [visited,      setVisited]      = useState(() => new Set([slotOf(readRoute())]));
  const [entity,       setEntity]       = useState("QM");
  const [entities,     setEntities]     = useState([{ entity_code: "QM", display_name: "Quandatics Malaysia" }]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Teams users never set isAuthenticated (they bypass MSAL entirely and
  // authenticate via Teams' own SSO token + sessionStorage caching), so
  // this must stay OR — requiring AND would permanently lock out every
  // Teams user, since isAuthenticated can never become true for them.
  // The actual "was this user rejected by the backend" check lives in
  // the separate `denied` flag below, not in this readiness check.
  const isReady = isAuthenticated || !!user;

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setVisited(v => (v.has(slotOf(route)) ? v : new Set([...v, slotOf(route)])));
  }, [route]);

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
    <StatusScreen>
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
    </StatusScreen>
  );
  if (denied) return <AccessDenied />;
  if (devError) return <DevError message={devError} />;
  if (!isAuthenticated && !user) return <Login />;

  // A role-restricted route (e.g. #/adjlog for staff) falls back to P&L.
  const allowed = (id) => {
    const item = NAV.flatMap(g => g.items).find(i => i.id === id);
    return !!item && (!item.roles || item.roles.includes(user?.role));
  };
  const activeId = allowed(route) ? route : "pnl";
  const tab = slotOf(activeId);
  const mfrsSub = activeId === "mfrs-pur" ? "pur" : "sales";

  const handleNav = (id) => { window.location.hash = "/" + id; };

  const slot = (key, node) => visited.has(key) && (
    <div key={key} className={cn("min-h-0 flex-1 flex-col overflow-hidden", tab === key ? "flex" : "hidden")}>{node}</div>
  );

  return (
    <TooltipProvider>
    <div className="flex h-screen flex-col bg-background text-foreground">

      {/* ── Phones (below md): slim bar with brand · entity · account, then the nav strip ── */}
      <header className={cn("flex h-14 shrink-0 items-center gap-2 border-b px-3 md:hidden", SB_BORDER, SB_BG)}>
        <Brand />
        <div className="ml-auto flex items-center gap-2">
          <div className="w-32"><EntitySelect entity={entity} entities={entities} onChange={setEntity} /></div>
          <AccountMenu user={user} entity={entity} compact side="bottom" />
        </div>
      </header>
      <MobileNav nav={NAV} activeId={activeId} user={user} onNav={handleNav} />

      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar (md and up): brand + collapse, entity, nav, account ── */}
        <aside className={cn("hidden shrink-0 flex-col border-r transition-[width] duration-150 md:flex", SB_BORDER, SB_BG, sidebarCollapsed ? "w-16" : "w-[228px]")}>
          <div className={cn("flex items-center gap-2 pb-2 pt-4", sidebarCollapsed ? "flex-col px-2" : "px-4")}>
            <Brand collapsed={sidebarCollapsed} />
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(SB_TOGGLE_BTN, !sidebarCollapsed && "ml-auto")}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <div className={cn("pb-2", sidebarCollapsed ? "flex justify-center px-2" : "px-3")}>
            {!sidebarCollapsed && <div className="px-1 pb-1 text-xs font-semibold text-muted-foreground">Entity</div>}
            <EntitySelect entity={entity} entities={entities} onChange={setEntity} collapsed={sidebarCollapsed} />
          </div>
          <SidebarNav nav={NAV} activeId={activeId} user={user} onNav={handleNav} collapsed={sidebarCollapsed} />
          <div className={cn("border-t p-2", SB_BORDER, sidebarCollapsed && "flex justify-center")}>
            <AccountMenu user={user} entity={entity} compact={sidebarCollapsed} side="top" />
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {slot("pnl",        <PnL          entity={entity} />)}
          {slot("tb",         <BS           entity={entity} />)}
          {slot("sales",      <Sales        entity={entity} />)}
          {slot("pur",        <Purchases    entity={entity} />)}
          {slot("mfrs",       <MFRS         entity={entity} defaultSub={mfrsSub} />)}
          {slot("adjtask",    <AdjTasks     entity={entity} />)}
          {slot("adjlog",     <Log          entity={entity} />)}
          {slot("order-list", <OrderListTab entity={entity} user={user} />)}
        </main>
      </div>

      <Toast />
    </div>
    </TooltipProvider>
  );
}
