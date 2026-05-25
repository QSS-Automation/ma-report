from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db, run

router = APIRouter(prefix="/api/log", tags=["Log"])

@router.get("")
def get_log(entity: str = "QM", role: str = "manager",
            user_id: str = "", db: Session = Depends(get_db)):
    # admin sees all entities, others filtered
    if role == "admin":
        rows = run(db, """
            SELECT * FROM ops_QM.fact_adj_log
            ORDER BY ts DESC LIMIT 500
        """, {})
    elif role == "staff":
        rows = run(db, """
            SELECT * FROM ops_QM.fact_adj_log
            WHERE entity=:e AND user_id=:uid
            ORDER BY ts DESC LIMIT 200
        """, {"e": entity, "uid": user_id})
    else:  # manager
        rows = run(db, """
            SELECT * FROM ops_QM.fact_adj_log
            WHERE entity=:e
            ORDER BY ts DESC LIMIT 500
        """, {"e": entity})
    return rows

@router.post("")
def write_log(entry: dict, db: Session = Depends(get_db)):
    from sqlalchemy import text
    from datetime import datetime
    db.execute(text("""
        INSERT INTO ops_QM.fact_adj_log
        (entity, user_id, action_type, journal_type, source_key,
         ref_no, period, detail, old_value, new_value)
        VALUES (:entity,:user_id,:action_type,:journal_type,:source_key,
                :ref_no,:period,:detail,:old_value,:new_value)
    """), {**entry, "ts": datetime.now()})
    db.commit()
    return {"status": "ok"}