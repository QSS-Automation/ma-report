import React, { useState, useEffect } from "react";
import TaskModal from "../Shared/TaskModal";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import { getTasks, createTask, updateTask } from "../../services/api";

const ST_META = {
  open:           { label: "Open",           cls: "task-st-open"      },
  inprog:         { label: "In Progress",    cls: "task-st-inprog"    },
  done:           { label: "Done",           cls: "task-st-done"      },
  checked:        { label: "Checked",        cls: "task-st-checked"   },
  cancelled:      { label: "Cancelled",      cls: "task-st-cancelled" },
  unlock_pending: { label: "Unlock Pending", cls: "task-st-open"      },
  unlocked:       { label: "Unlocked",       cls: "task-st-done"      },
};

export default function AdjTasks({ entity = "QM", entities = [] }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [fStatus, setFStatus] = useState("all");
  const [fSrc,    setFSrc]    = useState("all");
  const [fEntity, setFEntity] = useState("all");
  const [modal,   setModal]   = useState(false);
  const [subTab,  setSubTab]  = useState("general");

  // ── Load tasks from DB ──────────────────────────────────────────
  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getTasks(entity || "QM", user.role, user.user_id);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast("⚠ Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [entity, user?.user_id]);

  // ── Create task — saves to DB then reloads ──────────────────────
  const create = async (form) => {
    try {
      const payload = {
        entity:      entity,
        todo:        form.todo,
        description: form.desc,
        remark:      form.remark,
        source:      form.src,
        assigned_to: form.assignee,
        due_date:    form.due,
        task_type:   "general",
        created_by:  user?.user_id,
      };
      await createTask(payload);
      await loadTasks();
      setModal(false);
      showToast("✓ Task created.");
    } catch (e) {
      showToast("⚠ Failed to create task: " + e.message);
    }
  };

  // ── Update task status — saves to DB then reloads ───────────────
  const upd = async (id, status, extraFields = {}) => {
    try {
      await updateTask(id, {
        status,
        updated_by: user?.user_id,
        entity,
        ...extraFields,
      });
      await loadTasks();
      showToast("Task #" + id + " → " + (ST_META[status]?.label || status));
    } catch (e) {
      showToast("⚠ Failed to update task: " + e.message);
    }
  };

  // ── Filtering ───────────────────────────────────────────────────
  const visibleTasks = isManager
    ? tasks
    : tasks.filter(t =>
        t.assigned_to === user?.user_id ||
        t.assigned_to === user?.display_name
      );

  const unlockRequests = visibleTasks.filter(t => t.task_type === "unlock_request");
  const generalTasks   = visibleTasks.filter(t => t.task_type === "general" || !t.task_type);
  const displayed      = isManager
    ? (subTab === "unlock" ? unlockRequests : generalTasks)
    : visibleTasks;

  const filtered = displayed.filter(t =>
    (fStatus === "all" || t.status === fStatus) &&
    (fSrc    === "all" || t.source === fSrc || t.src === fSrc) &&
    (fEntity === "all" || t.entity === fEntity)
  );

  const openCount = visibleTasks.filter(t =>
    t.status === "open" || t.status === "inprog"
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>

      {/* ── Header ── */}
      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 7l2 2 4-4"/>
          </svg>
          Adjustment Tasks <span className="pg-badge">{openCount} open</span>
        </div>
        <div className="pg-actions">
          {isManager && (
            <button className="pg-btn" onClick={() => setModal(true)}>+ New Task</button>
          )}
        </div>
      </div>

      {/* ── Manager sub-tabs ── */}
      {isManager && (
        <div style={{ display: "flex", gap: 8, padding: "8px 18px", borderBottom: "1px solid #e8e7e0" }}>
          <button
            className={"view-tab" + (subTab === "general" ? " on" : "")}
            onClick={() => setSubTab("general")}>
            Tasks
            {generalTasks.length > 0 && (
              <span className="pg-badge" style={{ marginLeft: 6 }}>{generalTasks.length}</span>
            )}
          </button>
          <button
            className={"view-tab" + (subTab === "unlock" ? " on" : "")}
            onClick={() => setSubTab("unlock")}>
            Unlock Requests
            {unlockRequests.length > 0 && (
              <span className="pg-badge" style={{ marginLeft: 6, background: "#E24B4A" }}>
                {unlockRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="filter">
        <span className="f-lbl">Status</span>
        <select className="f-sel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="inprog">In Progress</option>
          <option value="done">Done</option>
          <option value="checked">Checked</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="f-lbl">Entity</span>
        <select className="f-sel" value={fEntity} onChange={e => setFEntity(e.target.value)}>
          <option value="all">All</option>
          {entities.map(e => (
            <option key={e.entity_code} value={e.entity_code}>{e.entity_code}</option>
          ))}
        </select>
        <div className="f-div"/>
        <span className="f-lbl">Source</span>
        <select className="f-sel" value={fSrc} onChange={e => setFSrc(e.target.value)}>
          <option value="all">All</option>
          <option value="sales">Sales</option>
          <option value="pur">Purchases</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="content" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#888780", fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {["#", "Todo", "Description", "Remark", "Source", "Assigned To", "Due Date", "Status", "Action"].map(h => (
                  <th key={h} style={{
                    padding: "8px 12px", fontSize: 9, fontWeight: 700, color: "#888780",
                    textTransform: "uppercase", borderBottom: "1px solid #e8e7e0",
                    whiteSpace: h === "Action" ? "nowrap" : "normal"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const meta = ST_META[t.status] || ST_META.open;
                const src  = t.source || t.src;
                let actions = null;

                if (!isManager) {
                  if (t.status === "open")
                    actions = (
                      <button className="btn-save" style={{ marginRight: 4 }}
                        onClick={() => upd(t.id, "inprog")}>Start</button>
                    );
                  if (t.status === "inprog")
                    actions = (
                      <button className="btn-save" style={{ background: "#1D9E75", marginRight: 4 }}
                        onClick={() => upd(t.id, "done", {
                          manager_id: t.created_by,
                          todo: t.todo,
                        })}>Mark Done</button>
                    );
                }

                if (isManager) {
                  if (t.status === "done")
                    actions = (
                      <button className="btn-save" style={{ background: "#185FA5", marginRight: 4 }}
                        onClick={() => upd(t.id, "checked")}>✓ Check</button>
                    );
                  if (t.task_type === "unlock_request" && t.status === "unlock_pending")
                    actions = (
                      <button className="btn-save" style={{ background: "#1D9E75", marginRight: 4 }}
                        onClick={() => upd(t.id, "unlocked")}>Approve Unlock</button>
                    );
                  if (!["cancelled", "checked", "unlocked"].includes(t.status))
                    actions = (
                      <>{actions}
                        <button className="btn-del"
                          onClick={() => upd(t.id, "cancelled")}>Cancel</button>
                      </>
                    );
                }

                return (
                  <tr key={t.id} className="task-row">
                    <td style={{ color: "#888780", fontSize: 10 }}>#{t.id}</td>
                    <td style={{ fontWeight: 500 }}>{t.todo}</td>
                    <td style={{ color: "#5f5e5a", fontSize: 10 }}>{t.description || t.desc}</td>
                    <td style={{ color: "#888780", fontSize: 10 }}>{t.remark || "—"}</td>
                    <td>
                      {src === "sales"
                        ? <span className="bdg bdg-ps" style={{ fontSize: 8 }}>Sales</span>
                        : <span className="bdg" style={{ fontSize: 8, background: "#E8F5E9", color: "#1B5E20" }}>Purchases</span>}
                    </td>
                    <td style={{ fontSize: 10 }}>{t.assigned_to}</td>
                    <td style={{ fontSize: 10 }}>{t.due_date || t.due || "—"}</td>
                    <td><span className={"task-inline-badge " + meta.cls}>{meta.label}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {actions || <span style={{ color: "#c8c6c0", fontSize: 9 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#888780" }}>
                    No tasks match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <TaskModal
        open={modal}
        defaultSrc="sales"
        onClose={() => setModal(false)}
        onSave={create}
      />
    </div>
  );
}
