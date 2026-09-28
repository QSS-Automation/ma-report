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
def get_entities(user_id: str, db: Session = Depends(get_db)):
    urows = run(db,
        "SELECT entity_scope FROM ops_QM.users WHERE user_id=:uid AND is_active=1",
        {"uid": user_id})
    if not urows:
        raise HTTPException(status_code=403, detail="User not found or inactive.")

    if urows[0]["entity_scope"] == "all":
        rows = run(db,
            "SELECT entity_code, display_name FROM ops_QM.ref_entities WHERE is_active=1 ORDER BY entity_code",
            {})
    else:
        rows = run(db, """
            SELECT re.entity_code, re.display_name
            FROM ops_QM.ref_entities re
            INNER JOIN ops_QM.user_entities ue ON ue.entity_code = re.entity_code
            WHERE re.is_active = 1 AND ue.user_id = :uid
            ORDER BY re.entity_code
        """, {"uid": user_id})
    return rows
