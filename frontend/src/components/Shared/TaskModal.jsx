import React, { useState, useEffect } from "react";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function TaskModal({ open, defaultSrc, onClose, onSave }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  const [form, setForm] = useState({
    todo: "", desc: "", remark: "",
    src: defaultSrc || "sales",
    assignee: isManager ? "" : (user?.user_id || ""),
    due: ""
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (open && isManager) {
      API.get("/api/auth/users")
        .then(r => {
          // Fix: ensure r.data is always an array
          const data = Array.isArray(r.data) ? r.data : [];
          setUsers(data);
        })
        .catch(() => setUsers([]));
    }
  }, [open, isManager]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({
        todo: "", desc: "", remark: "",
        src: defaultSrc || "sales",
        assignee: isManager ? "" : (user?.user_id || ""),
        due: ""
      });
    }
  }, [open]);

  if (!open) return null;
  const u = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 460 }}>
        <div className="modal-title">✓ New Adjustment Task</div>
        <div className="modal-sub">Flag an unusual item that needs correction.</div>

        <div className="modal-field">
          <label>Source</label>
          <select value={form.src} onChange={u("src")}>
            <option value="sales">Sales</option>
            <option value="pur">Purchases</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Task Title</label>
          <input type="text" value={form.todo} onChange={u("todo")}
            placeholder="e.g. Wrong invoice amount — INV-2025-002"/>
        </div>

        <div className="modal-field">
          <label>Description</label>
          <input type="text" value={form.desc} onChange={u("desc")}
            placeholder="Describe the issue"/>
        </div>

        <div className="modal-field">
          <label>Remark</label>
          <input type="text" value={form.remark} onChange={u("remark")}
            placeholder="Optional note or reference"/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="modal-field" style={{ marginBottom: 0 }}>
            <label>Assigned To</label>
            {/* Role-gate the assignee field */}
            {isManager ? (
              <select value={form.assignee} onChange={u("assignee")}>
                <option value="">— Select assignee</option>
                {users.map(usr => (
                  <option key={usr.user_id} value={usr.user_id}>
                    {usr.display_name}
                    {usr.role === "manager" ? " (Manager)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={user?.display_name || ""}
                readOnly
                style={{ background: "#f5f5f0", color: "#888780" }}
              />
            )}
          </div>

          <div className="modal-field" style={{ marginBottom: 0 }}>
            <label>Due Date</label>
            <input type="date" value={form.due} onChange={u("due")}
              style={{ width: "100%", fontSize: 11, padding: "7px 10px",
                border: "1px solid #e8e7e0", borderRadius: 6 }}/>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-modal-submit"
            onClick={() => { if (form.todo.trim() && form.assignee) onSave(form); }}>
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
