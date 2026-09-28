import React, { useState, useEffect } from "react";
import TaskModal from "../Shared/TaskModal";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import { getTasks, createTask, updateTask } from "../../services/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { PageShell, FilterBar, FilterLabel } from "../ui/page-shell";
import { FilterPill } from "../ui/filter-pill";
import { TableSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";

// Sticky first (identifying) column keeps the task's Todo visible while the
// rest of the row scrolls horizontally — needs its own *opaque* background
// matching its row so scrolled columns don't bleed through underneath it.
const STICKY = "sticky left-0 z-10";

const ST_META = {
  open:           { label: "Open",           variant: "warning"     },
  inprog:         { label: "In Progress",    variant: "default"     },
  done:           { label: "Done",           variant: "success"     },
  checked:        { label: "Checked",        variant: "default"     },
  cancelled:      { label: "Cancelled",      variant: "muted"       },
  unlock_pending: { label: "Unlock Pending", variant: "warning"     },
  unlocked:       { label: "Unlocked",       variant: "success"     },
};

// Status filter options differ per list: unlock requests have their own
// statuses, which the old single list didn't offer at all.
const STATUS_OPTIONS = {
  general: ["open", "inprog", "done", "checked", "cancelled"],
  unlock:  ["unlock_pending", "unlocked", "cancelled"],
};

export default function AdjTasks({ entity = "QM" }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [fStatus, setFStatus] = useState("all");
  const [fSrc,    setFSrc]    = useState("all");
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
    (fSrc    === "all" || t.source === fSrc || t.src === fSrc)
  );
  // Tasks are already fetched for the global entity, so no separate entity filter.
  const statusOpts = isManager && subTab === "unlock" ? STATUS_OPTIONS.unlock : STATUS_OPTIONS.general;

  const openCount = visibleTasks.filter(t =>
    t.status === "open" || t.status === "inprog"
  ).length;

  return (
    <PageShell>
          <PageHeader
            eyebrow="Adjustment"
            title="Adjustment Tasks"
            subtitle={`${entity} · ${openCount} open`}
            actions={isManager && (
              <Button size="sm" onClick={() => setModal(true)}>+ New Task</Button>
            )}
          />

          {/* Manager sub-tabs (left) + filters (right), one line */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {isManager ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <FilterPill active={subTab === "general"} onClick={() => { setSubTab("general"); setFStatus("all"); }}>
                  Tasks
                  {generalTasks.length > 0 && <Badge>{generalTasks.length}</Badge>}
                </FilterPill>
                <FilterPill active={subTab === "unlock"} onClick={() => { setSubTab("unlock"); setFStatus("all"); }}>
                  Unlock Requests
                  {unlockRequests.length > 0 && <Badge variant="destructive">{unlockRequests.length}</Badge>}
                </FilterPill>
              </div>
            ) : <div />}

            <FilterBar>
              <FilterLabel>Status</FilterLabel>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statusOpts.map(s => <SelectItem key={s} value={s}>{ST_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FilterLabel>Source</FilterLabel>
              <Select value={fSrc} onValueChange={setFSrc}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="purchases">Purchases</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
              <h3 className="text-base font-semibold">{isManager ? (subTab === "unlock" ? "Unlock requests" : "Tasks") : "My tasks"}</h3>
              <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "task" : "tasks"}</p>
            </div>
            {loading && !tasks.length ? <TableSkeleton cols={9} rows={6} /> : filtered.length === 0 ? (
              <EmptyState title="No tasks" hint="Nothing matches the current filters." />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      {["#", "Todo", "Description", "Remark", "Source", "Assigned To", "Due Date", "Status", "Action"].map(h => (
                        <TableHead key={h} className={cn(h === "Action" && "whitespace-nowrap", h === "Todo" && [STICKY, "min-w-[140px] bg-card"])}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(t => {
                      const meta = ST_META[t.status] || ST_META.open;
                      const src  = t.source || t.src;
                      let actions = null;

                      if (!isManager) {
                        if (t.status === "open")
                          actions = (
                            <Button size="sm" className="mr-1" onClick={() => upd(t.id, "inprog")}>Start</Button>
                          );
                        if (t.status === "inprog")
                          actions = (
                            <Button size="sm" variant="success" className="mr-1"
                              onClick={() => upd(t.id, "done", {
                                manager_id: t.created_by,
                                todo: t.todo,
                              })}>Mark Done</Button>
                          );
                      }

                      if (isManager) {
                        if (t.status === "done")
                          actions = (
                            <Button size="sm" className="mr-1"
                              onClick={() => upd(t.id, "checked")}>✓ Check</Button>
                          );
                        if (t.task_type === "unlock_request" && t.status === "unlock_pending")
                          actions = (
                            <Button size="sm" variant="success" className="mr-1"
                              onClick={() => upd(t.id, "unlocked", {
                                // FIX: this button was only sending {status:"unlocked"}
                                // with no source_key/journal_type — so tasks.py's
                                // `if body["status"]=="unlocked" and body.get("source_key")`
                                // check silently failed and MfrsService().unlock_period()
                                // never actually ran. The task LOOKED approved (status
                                // flipped), but the invoice stayed locked and its MFRS
                                // rows were never removed. `t` already has both fields
                                // from the GET /api/tasks response — just wasn't being
                                // read.
                                source_key: t.source_key,
                                journal_type: t.journal_type,
                              })}>Approve Unlock</Button>
                          );
                        if (!["cancelled", "checked", "unlocked"].includes(t.status))
                          actions = (
                            <>{actions}
                              <Button size="sm" variant="outline"
                                onClick={() => upd(t.id, "cancelled")}>Cancel</Button>
                            </>
                          );
                      }

                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-[11px] text-muted-foreground">#{t.id}</TableCell>
                          <TableCell className={cn(STICKY, "bg-card font-medium")}>{t.todo}</TableCell>
                          <TableCell className="min-w-[240px] text-[13.5px] leading-snug text-muted-foreground">{t.description || t.desc}</TableCell>
                          <TableCell className="min-w-[160px] text-[13.5px] leading-snug text-muted-foreground">{t.remark || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={src === "sales" ? "default" : "success"}>
                              {src === "sales" ? "Sales" : "Purchases"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[11px]">{t.assigned_to}</TableCell>
                          <TableCell className="text-[11px]">{t.due_date || t.due || "—"}</TableCell>
                          <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap">
                            {actions || <span className="text-[10px] text-muted-foreground/60">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

      <TaskModal
          key={modal ? "open" : "closed"}
          open={modal}
          defaultSrc="sales"
          onClose={() => setModal(false)}
          onSave={create}
      />
    </PageShell>
  );
}
