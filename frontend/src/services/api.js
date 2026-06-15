import axios from "axios"

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || "" });


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
export const getLog         = (entity, role, userId)   => API.get("/api/log",                     { params: { entity, role, user_id: userId } });
export const getTasks       = (entity, role, userId)   => API.get("/api/tasks",                   { params: { entity, role, user_id: userId } });
export const createTask     = (data)                   => API.post("/api/tasks",                  data);
export const updateTask     = (id, data)               => API.patch(`/api/tasks/${id}`,           data);
export const getOrderList   = (entity)                 => API.get("/api/order-list", { params: { entity } });

export default API;
