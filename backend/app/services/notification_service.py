import os
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

TEAMS_WEBHOOK = os.getenv("TEAMS_WEBHOOK_URL", "")


class NotificationService:

    def save(self, db: Session, recipient_id: str, task_id: int,
             ntype: str, message: str):
        """Save notification to DB."""
        db.execute(text("""
            INSERT INTO ops_QM.fact_notification
            (recipient_id, task_id, type, message)
            VALUES (:rid, :tid, :tp, :msg)
        """), {"rid": recipient_id, "tid": task_id, "tp": ntype, "msg": message})
        db.commit()

    def send_teams(self, title: str, message: str, entity: str = ""):
        """Send formatted card to Teams channel via Power Automate webhook."""
        if not TEAMS_WEBHOOK:
            return
        payload = {
            "title": title,
            "message": message,
            "entity": entity,
        }
        try:
            httpx.post(TEAMS_WEBHOOK, json=payload, timeout=5)
        except:
            pass  # never fail the main request due to notification

    # ─────────────────────────────────────────
    # Task Assigned
    # ─────────────────────────────────────────
    def notify_task_assigned(self, db: Session, task_id: int,
                              assignee_id: str, todo: str,
                              due_date: str, entity: str, assigner: str):
        msg = (
            f"📋 NEW TASK ASSIGNED\n"
            f"{'─' * 30}\n"
            f"Task     : {todo}\n"
            f"Assigned : {assignee_id}\n"
            f"By       : {assigner}\n"
            f"Due Date : {due_date}\n"
            f"Entity   : {entity}\n"
            f"{'─' * 30}\n"
            f"Please log in to Quandatics MA to view and action this task."
        )
        self.save(db, assignee_id, task_id, "task_assigned", msg)
        self.send_teams(
            title="📋 New Task Assigned",
            message=msg,
            entity=entity
        )

    # ─────────────────────────────────────────
    # Task Done
    # ─────────────────────────────────────────
    def notify_task_done(self, db: Session, task_id: int,
                         manager_id: str, todo: str,
                         done_by: str, entity: str):
        msg = (
            f"✅ TASK COMPLETED\n"
            f"{'─' * 30}\n"
            f"Task       : {todo}\n"
            f"Completed  : {done_by}\n"
            f"Entity     : {entity}\n"
            f"{'─' * 30}\n"
            f"Please log in to review and mark as Checked."
        )
        self.save(db, manager_id, task_id, "task_done", msg)
        # In-app only — no Teams for routine status updates

    # ─────────────────────────────────────────
    # Task Checked
    # ─────────────────────────────────────────
    def notify_task_checked(self, db: Session, task_id: int,
                            staff_id: str, todo: str,
                            checked_by: str, entity: str):
        msg = (
            f"✔ TASK CHECKED & CLOSED\n"
            f"{'─' * 30}\n"
            f"Task      : {todo}\n"
            f"Checked By: {checked_by}\n"
            f"Entity    : {entity}\n"
            f"{'─' * 30}\n"
            f"Your task has been reviewed and closed."
        )
        self.save(db, staff_id, task_id, "task_checked", msg)

    # ─────────────────────────────────────────
    # Unlock Request
    # ─────────────────────────────────────────
    def notify_unlock_request(self, db: Session, task_id: int,
                               manager_id: str, ref_no: str,
                               requester: str, entity: str,
                               period: str = "", reason: str = ""):
        msg = (
            f"🔓 UNLOCK REQUEST\n"
            f"{'─' * 30}\n"
            f"Invoice  : {ref_no}\n"
            f"Period   : {period}\n"
            f"Requested: {requester}\n"
            f"Entity   : {entity}\n"
            f"Reason   : {reason or 'Not specified'}\n"
            f"{'─' * 30}\n"
            f"Please log in to Quandatics MA → Adj Tasks to review and approve."
        )
        self.save(db, manager_id, task_id, "unlock_request", msg)
        self.send_teams(
            title="🔓 Unlock Request Pending Approval",
            message=msg,
            entity=entity
        )

    # ─────────────────────────────────────────
    # Unlock Approved
    # ─────────────────────────────────────────
    def notify_unlock_approved(self, db: Session, task_id: int,
                                requester_id: str, ref_no: str,
                                approver: str, entity: str,
                                period: str = ""):
        msg = (
            f"✅ UNLOCK APPROVED\n"
            f"{'─' * 30}\n"
            f"Invoice  : {ref_no}\n"
            f"Period   : {period}\n"
            f"Approved : {approver}\n"
            f"Entity   : {entity}\n"
            f"{'─' * 30}\n"
            f"You may now edit and re-save the invoice in Quandatics MA."
        )
        self.save(db, requester_id, task_id, "unlock_approved", msg)
        self.send_teams(
            title="✅ Unlock Request Approved",
            message=msg,
            entity=entity
        )

    # ─────────────────────────────────────────
    # Period Locked
    # ─────────────────────────────────────────
    def notify_lock(self, db: Session, admin_id: str,
                    period: str, entity: str, locked_by: str):
        msg = (
            f"🔒 PERIOD LOCKED\n"
            f"{'─' * 30}\n"
            f"Period   : {period}\n"
            f"Entity   : {entity}\n"
            f"Locked By: {locked_by}\n"
            f"{'─' * 30}\n"
            f"MFRS recognition has been recalculated and staging refreshed."
        )
        self.save(db, admin_id, None, "lock", msg)

    # ─────────────────────────────────────────
    # Reminder — Due Soon
    # ─────────────────────────────────────────
    def notify_due_soon(self, todo: str, assignee: str,
                        due_date: str, entity: str):
        msg = (
            f"⏰ TASK DUE SOON\n"
            f"{'─' * 30}\n"
            f"Task     : {todo}\n"
            f"Assigned : {assignee}\n"
            f"Due Date : {due_date}\n"
            f"Entity   : {entity}\n"
            f"{'─' * 30}\n"
            f"This task is due in 2 days. Please complete it on time."
        )
        self.send_teams(
            title="⏰ Task Due Soon",
            message=msg,
            entity=entity
        )

    # ─────────────────────────────────────────
    # Reminder — Overdue
    # ─────────────────────────────────────────
    def notify_overdue(self, todo: str, assignee: str,
                       due_date: str, entity: str):
        msg = (
            f"🚨 TASK OVERDUE\n"
            f"{'─' * 30}\n"
            f"Task     : {todo}\n"
            f"Assigned : {assignee}\n"
            f"Due Date : {due_date}\n"
            f"Entity   : {entity}\n"
            f"{'─' * 30}\n"
            f"This task is past its due date and still open. Please action immediately."
        )
        self.send_teams(
            title="🚨 Task Overdue",
            message=msg,
            entity=entity
        )