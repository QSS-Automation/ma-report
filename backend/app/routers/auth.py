from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db, run
from app.utils import validate_entity

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.get("/me")
def get_me(user_id: str, db: Session = Depends(get_db)):
    rows = run(db,
        "SELECT user_id, display_name, role FROM ops_QM.users WHERE user_id=:uid AND is_active=1",
        {"uid": user_id})
    if not rows:
        raise HTTPException(status_code=403, detail="User not found or inactive.")
    r = rows[0]
    return {"user_id": r["user_id"], "display_name": r["display_name"], "role": r["role"]}

# ── NEW: returns all active users for task assignment dropdown ──
@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    rows = run(db,
        "SELECT user_id, display_name, role FROM ops_QM.users WHERE is_active=1 ORDER BY display_name",
        {})
    return rows

@router.get("/entities")
def get_entities(db: Session = Depends(get_db)):
    """Return all active entities for the entity dropdown."""
    rows = run(db,
        "SELECT entity_code, display_name FROM ops_QM.ref_entities WHERE is_active=1 ORDER BY entity_code",
        {})
    return rows