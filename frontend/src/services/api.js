import axios from "axios"
import * as mock from "./mockApi";

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || "" });

// ── Local-only mock mode ────────────────────────────────────────────────
// Set REACT_APP_DEV_MOCK_DATA=1 in your own untracked local .env to review
// the UI/wording with realistic fake data when the real backend/DB is
// unreachable (e.g. VPN/firewall blocks the internalops DB). Never set in
// production — every exported function below still has its normal
// signature and axios call; MOCK just short-circuits before that call and
// resolves with a fabricated `{ data }` shape matching the real response.
const MOCK = process.env.REACT_APP_DEV_MOCK_DATA === "1";
const asResponse = (data) => new Promise((resolve) => setTimeout(() => resolve({ data }), 350));

// ── Auto-inject the logged-in user's id into every request ─────────────────
// Set once by AuthContext.jsx right after it resolves the logged-in user
// (both the browser MSAL flow and the Teams SSO flow). This lets every
// existing api.js export and every existing component call site keep its
// original signature — no changes needed anywhere else in the app — while
// still ensuring every request the backend can check against
// check_entity_access() actually carries a user_id.
let currentUserId = null;
export const setCurrentUserId = (id) => { currentUserId = id; };
export const clearCurrentUserId = () => { currentUserId = null; };

API.interceptors.request.use(config => {
  if (!currentUserId) return config;

  if ((config.method || "get").toLowerCase() === "get") {
    // Don't clobber a user_id a caller explicitly set already.
    if (!config.params || config.params.user_id === undefined) {
      config.params = { ...config.params, user_id: currentUserId };
    }
  } else if (config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
    if (config.data.user_id === undefined) {
      config.data = { ...config.data, user_id: currentUserId };
    }
  }
  return config;
});

export const getPnl         = (entity, from, to)       => MOCK ? asResponse(mock.mockPnl(entity, from, to))       : API.get("/api/pnl",                     { params: { entity, from_date: from, to_date: to } });
export const getPnlV2       = (entity, from, to)       => MOCK ? asResponse(mock.mockPnlV2(entity, from, to))     : API.get("/api/pnl/v2",                  { params: { entity, from_date: from, to_date: to } });
export const getBs          = (entity, from, to)       => MOCK ? asResponse(mock.mockBs(entity, from, to))       : API.get("/api/bs",                      { params: { entity, from_date: from, to_date: to } });
export const getSales       = (entity, from, to)       => MOCK ? asResponse({ invoices: mock.mockSales(entity, from, to) })    : API.get("/api/adjustment/sales",        { params: { entity, from_date: from, to_date: to } });
export const getPurchases   = (entity, from, to)       => MOCK ? asResponse({ invoices: mock.mockPurchases(entity, from, to) }): API.get("/api/adjustment/purchases",    { params: { entity, from_date: from, to_date: to } });
export const saveSplits     = (data)                   => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/adjustment/splits",      data);
export const saveManualLine = (data)                   => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/adjustment/manual-line", data);
export const getMfrs        = (entity, jt, from, to)   => MOCK ? asResponse(mock.mockMfrs(entity, jt, from, to)) : API.get("/api/mfrs",                    { params: { entity, journal_type: jt, from_date: from, to_date: to } });
export const lockPeriod     = (data)                   => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/mfrs/lock",              data);
export const getConfig      = (entity = "QM")          => MOCK ? asResponse(mock.mockConfig(entity))             : API.get("/api/config",                  { params: { entity } });
export const refreshStaging = (entity, user)           => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/staging/refresh",        { entity, user });
export const getUsers       = ()                       => MOCK ? asResponse(mock.mockUsers())                    : API.get("/api/auth/users");
export const getEntities    = ()                       => MOCK ? asResponse(mock.mockEntities())                 : API.get("/api/auth/entities");
export const getLog = (entity, role, userId, from, to) => MOCK ? asResponse(mock.mockLog())                      : API.get("/api/log", { params: { entity, role, user_id: userId, from_date: from, to_date: to } });
export const getTasks       = (entity, role, userId)   => MOCK ? asResponse(mock.mockTasks())                    : API.get("/api/tasks",                   { params: { entity, role, user_id: userId } });
export const createTask     = (data)                   => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/tasks",                  data);
export const updateTask     = (id, data)               => MOCK ? asResponse({ status: "ok" })                    : API.patch(`/api/tasks/${id}`,           data);
export const getOrderList   = (entity)                 => MOCK ? asResponse(mock.mockOrderList())                : API.get("/api/order-list", { params: { entity } });
export const unlockSplit = (data) => MOCK ? asResponse({ status: "ok" }) : API.post("/api/mfrs/unlock", data);
export const exportExcel = (entity, from, to)          => API.get("/api/export/excel", {params: { entity, from_date: from, to_date: to },responseType: 'blob'});
export const getAccounts = (entity, jt)                => MOCK ? asResponse(mock.mockAccounts())                 : API.get("/api/adjustment/accounts", { params: { entity, journal_type: jt } });
export const getOrderListEnhanced = (entity, level)    => MOCK ? asResponse(mock.mockOrderListEnhanced())        : API.get("/api/order-list-enhanced", { params: { entity, level } });
export const linkPoToSo     = (data)                   => MOCK ? asResponse({ status: "ok" })                    : API.post("/api/order-list-enhanced/link-po", data);
export const getPendingLinks = (entity)                => MOCK ? asResponse([])                                  : API.get("/api/order-list-enhanced/pending-links", { params: { entity } });
export default API;
