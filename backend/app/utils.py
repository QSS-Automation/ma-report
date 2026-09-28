from fastapi import HTTPException
from sqlalchemy.orm import Session
import re as regex


def validate_entity(entity: str) -> str:
    """Allow only alphanumeric entity codes — prevents SQL injection."""
    if not regex.match(r'^[A-Za-z0-9_]{1,20}$', entity):
        raise HTTPException(status_code=400, detail=f"Invalid entity code: {entity}")
    return entity


def check_entity_access(db: Session, user_id: str, entity: str) -> None:
    """Raise 403 if user_id is not permitted to access this entity.

    entity_scope='all'        → unrestricted, any active entity is allowed
    entity_scope='restricted' → must have a matching row in user_entities
    """
    from app.db.database import run

    if not user_id:
        raise HTTPException(status_code=403, detail="Missing user_id.")

    urows = run(db,
        "SELECT entity_scope FROM ops_QM.users WHERE user_id=:uid AND is_active=1",
        {"uid": user_id})
    if not urows:
        raise HTTPException(status_code=403, detail="User not found or inactive.")

    if urows[0]["entity_scope"] == "all":
        return

    allowed = run(db,
        "SELECT 1 FROM ops_QM.user_entities WHERE user_id=:uid AND entity_code=:e",
        {"uid": user_id, "e": entity})
    if not allowed:
        raise HTTPException(status_code=403, detail=f"You do not have access to entity '{entity}'.")
