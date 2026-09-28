import React, { useState, useEffect } from "react";
import { getUsers } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

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

  // Load users and default assignee when modal opens
  useEffect(() => {
    if (!open) return;
    if (isManager) {
      getUsers()
        .then(r => {
          const data = Array.isArray(r.data) ? r.data : [];
          setUsers(data);
          // Default to first user so assignee is never empty
          if (data.length > 0) {
            setForm(f => ({ ...f, assignee: f.assignee || data[0].user_id }));
          }
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

  // Inline field errors (replaces the old browser alert() popups).
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) setErrors({}); }, [open]);
  const u = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: undefined })); };
  const uv = k => v => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })); };

  const handleSave = () => {
    const next = {};
    if (!form.todo.trim()) next.todo = "Enter a task title.";
    if (!form.assignee)    next.assignee = "Select who this task is assigned to.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave(form);
  };
  const FieldError = ({ k }) => errors[k] ? <p className="text-[11px] font-medium text-destructive">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>✓ New Adjustment Task</DialogTitle>
          <DialogDescription>Flag an unusual item that needs correction.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.src} onValueChange={uv("src")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="purchases">Purchases</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Task Title</Label>
            <Input value={form.todo} onChange={u("todo")} placeholder="e.g. Wrong invoice amount — INV-2025-002"
              aria-invalid={!!errors.todo} className={errors.todo ? "border-destructive" : undefined} />
            <FieldError k="todo" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.desc} onChange={u("desc")} placeholder="Describe the issue" />
          </div>

          <div className="space-y-1.5">
            <Label>Remark</Label>
            <Input value={form.remark} onChange={u("remark")} placeholder="Optional note or reference" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              {isManager ? (
                <Select value={form.assignee} onValueChange={uv("assignee")}>
                  <SelectTrigger aria-invalid={!!errors.assignee} className={errors.assignee ? "border-destructive" : undefined}><SelectValue placeholder="— Select assignee" /></SelectTrigger>
                  <SelectContent>
                    {users.map(usr => (
                      <SelectItem key={usr.user_id} value={usr.user_id}>
                        {usr.display_name}{usr.role === "manager" ? " (Manager)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={user?.display_name || ""} readOnly className="bg-muted text-muted-foreground" />
              )}
              <FieldError k="assignee" />
            </div>

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due} onChange={u("due")} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
