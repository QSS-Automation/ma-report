import axios from "axios"

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || "" });

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

export const getPnl         = (entity, from, to)       => API.get("/api/pnl",                     { params: { entity, from_date: from, to_date: to } });
export const getBs          = (entity, from, to)       => API.get("/api/bs",                      { params: { entity, from_date: from, to_date: to } });
export const getSales       = (entity, from, to)       => API.get("/api/adjustment/sales",        { params: { entity, from_date: from, to_date: to } });
export const getPurchases   = (entity, from, to)       => API.get("/api/adjustment/purchases",    { params: { entity, from_date: from, to_date: to } });
export const saveSplits     = (data)                   => API.post("/api/adjustment/splits",      data);
export const saveManualLine = (data)                   => API.post("/api/adjustment/manual-line", data);
export const getMfrs        = (entity, jt, from, to)   => API.get("/api/mfrs",                    { params: { entity, journal_type: jt, from_date: from, to_date: to } });
export const lockPeriod     = (data)                   => API.post("/api/mfrs/lock",              data);
export const getConfig      = (entity = "QM")          => API.get("/api/config",                  { params: { entity } });
export const refreshStaging = (entity, user)           => API.post("/api/staging/refresh",        { entity, user });
export const getEntities    = ()                       => API.get("/api/auth/entities");
export const getLog = (entity, role, userId, from, to) => API.get("/api/log", { params: { entity, role, user_id: userId, from_date: from, to_date: to } });
export const getTasks       = (entity, role, userId)   => API.get("/api/tasks",                   { params: { entity, role, user_id: userId } });
export const createTask     = (data)                   => API.post("/api/tasks",                  data);
export const updateTask     = (id, data)               => API.patch(`/api/tasks/${id}`,           data);
export const getOrderList   = (entity)                 => API.get("/api/order-list", { params: { entity } });
export const unlockSplit = (data) => API.post("/api/mfrs/unlock", data);
export const exportExcel = (entity, from, to)          => API.get("/api/export/excel", {params: { entity, from_date: from, to_date: to },responseType: 'blob'});
export const getAccounts = (entity, jt)                => API.get("/api/adjustment/accounts", { params: { entity, journal_type: jt } });
export const getOrderListEnhanced = (entity, level)    => API.get("/api/order-list-enhanced", { params: { entity, level } });
export default API;
