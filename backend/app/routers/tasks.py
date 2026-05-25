from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.db.database import get_db, run
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])
_notif = NotificationService()

@router.get("")
def get_tasks(entity: str = "QM", role: str = "manager",
              user_id: str = "", db: Session = Depends(get_db)):
    if role == "admin":
        rows = run(db,
            "SELECT * FROM ops_QM.fact_adj_task ORDER BY created_at DESC", {})
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
    now = datetime.now()
    r = db.execute(text("""
        INSERT INTO ops_QM.fact_adj_task
        (entity, task_type, todo, description, remark, source,
         source_key, ref_no, assigned_to, created_by, due_date,
         status, priority, created_at, updated_at, updated_by)
        VALUES (:entity,:task_type,:todo,:description,:remark,:source,
                :source_key,:ref_no,:assigned_to,:created_by,:due_date,
                'open',:priority,:now,:now,:created_by)
    """), {**body, "now": now,
              "task_type": body.get("task_type", "general"),
              "priority": body.get("priority", "normal"),
              "source_key": body.get("source_key"),
              "ref_no": body.get("ref_no")})
    db.commit()
    task_id = r.lastrowid

    # Notify assignee via Teams + in-app
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
    now = datetime.now()
    db.execute(text("""
        UPDATE ops_QM.fact_adj_task
        SET status=:status, remark=:remark,
            updated_at=:now, updated_by=:updated_by
        WHERE id=:id
    """), {"status": body["status"], "remark": body.get("remark", ""),
              "now": now, "updated_by": body.get("updated_by"), "id": task_id})
    db.commit()

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