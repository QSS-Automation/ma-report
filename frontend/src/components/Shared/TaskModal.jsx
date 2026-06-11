// Step 1 — add useEffect + axios import at top
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export default function TaskModal({ open, defaultSrc, onClose, onSave }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  // Pre-fill assignee: manager starts blank, staff pre-fills themselves
  const [form, setForm] = useState({
    todo: "", desc: "", remark: "",
    src: defaultSrc || "sales",
    assignee: isManager ? "" : (user?.user_id || ""),
    due: ""
  });
  const [users, setUsers] = useState([]);

  // Step 2 — fetch users from backend
  useEffect(() => {
    if (open && isManager) {
      axios.get("/api/auth/users")
        .then(r => setUsers(r.data))
        .catch(() => {});
    }
  }, [open, isManager]);

  if (!open) return null;
  const u = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 460 }}>
        <div className="modal-title">✓ New Adjustment Task</div>
        <div className="modal-sub">Flag an unusual item that needs correction.</div>

        {/* ... Source, Todo, Description, Remark fields unchanged ... */}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="modal-field" style={{ marginBottom: 0 }}>
            <label>Assigned To</label>

            // Step 3 — role-gate the assignee field
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