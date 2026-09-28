from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.db.database import get_db, run
from app.services.notification_service import NotificationService
from app.utils import validate_entity, check_entity_access

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])
_notif = NotificationService()

@router.get("")
def get_tasks(entity: str = "QM", role: str = "manager",
              user_id: str = "", db: Session = Depends(get_db)):
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    if role == "admin":
        rows = run(db,
            "SELECT * FROM ops_QM.fact_adj_task WHERE entity=:e ORDER BY created_at DESC",
            {"e": entity})
    elif role == "staff":
        rows = run(db,
            "SELECT * FROM ops_QM.fact_adj_task WHERE entity=:e AND assigned_to=:uid ORDER BY created_at DESC",
            {"e": entity, "uid": user_id})
    else:
        rows = run(db,
            "SELECT * FROM ops_QM.fact_adj_task WHERE entity=:e ORDER BY created_at DESC",
            {"e": entity})
    return rows

@router.post("")
def create_task(body: dict, db: Session = Depends(get_db)):
    entity = validate_entity(body.get("entity", "QM"))
    check_entity_access(db, body.get("created_by", ""), entity)
    now = datetime.now()
    # FIX: every task was hardcoded to status='open' on creation. AdjTasks.jsx's
    # "Approve Unlock" button only renders when
    # (task_type == 'unlock_request' AND status == 'unlock_pending') — so an
    # unlock request created here with status='open' would show up in the
    # Unlock Requests tab, but with no way to actually approve it. Unlock
    # requests must start life as 'unlock_pending' instead.
    initial_status = "unlock_pending" if body.get("task_type") == "unlock_request" else "open"
    r = db.execute(text("""
        INSERT INTO ops_QM.fact_adj_task
        (entity, task_type, todo, description, remark, source,
         source_key, journal_type, ref_no, assigned_to, created_by, due_date,
         status, priority, created_at, updated_at, updated_by)
        VALUES (:entity,:task_type,:todo,:description,:remark,:source,
                :source_key,:journal_type,:ref_no,:assigned_to,:created_by,:due_date,
                :status,:priority,:now,:now,:created_by)
    """), {**body, "now": now,
              "task_type": body.get("task_type", "general"),
              "status": initial_status,
              "priority": body.get("priority", "normal"),
              "source_key": body.get("source_key"),
              "journal_type": body.get("journal_type"),
              "ref_no": body.get("ref_no")})
    db.commit()
    task_id = r.lastrowid

    # Notify assignee via Teams + in-app — only when there IS a specific
    # assignee. Unlock requests go to a manager/admin generally (no single
    # assigned_to), so skip this rather than call notify_task_assigned with
    # assignee_id=None, which it isn't designed to handle.
    if body.get("assigned_to"):
        _notif.notify_task_assigned(
            db, task_id,
            assignee_id=body["assigned_to"],
            todo=body["todo"],
            due_date=body.get("due_date", "—"),
            entity=body.get("entity", "QM"),
            assigner=body.get("created_by", "Manager")
        )
    return {"status": "ok", "id": task_id}

@router.patch("/{task_id}")
def update_task(task_id: int, body: dict, db: Session = Depends(get_db)):
    entity = validate_entity(body.get("entity", "QM"))
    check_entity_access(db, body.get("updated_by", ""), entity)
    now = datetime.now()
    db.execute(text("""
        UPDATE ops_QM.fact_adj_task
        SET status=:status, remark=:remark,
            updated_at=:now, updated_by=:updated_by
        WHERE id=:id
    """), {"status": body["status"], "remark": body.get("remark", ""),
              "now": now, "updated_by": body.get("updated_by"), "id": task_id})
    db.commit()

    if body["status"] == "unlocked" and body.get("source_key"):
        from app.services.mfrs_service import MfrsService
        MfrsService().unlock_period(
            db,
            source_key=body["source_key"],
            journal_type=body.get("journal_type", "SALES"),
            entity=body.get("entity", "QM"),
            user=body.get("updated_by", "system")
        )

    # Notify manager when staff marks done
    if body["status"] == "done" and body.get("manager_id"):
        _notif.notify_task_done(
            db, task_id,
            manager_id=body["manager_id"],
            todo=body.get("todo", "Task"),
            done_by=body.get("updated_by", "Staff"),
            entity=body.get("entity", "QM")
        )
    return {"status": "ok"}
