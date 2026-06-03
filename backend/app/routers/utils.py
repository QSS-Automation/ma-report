from fastapi import HTTPException
import re as regex


def validate_entity(entity: str) -> str:
    """Allow only alphanumeric entity codes — prevents SQL injection."""
    if not regex.match(r'^[A-Za-z0-9_]{1,20}$', entity):
        raise HTTPException(status_code=400, detail=f"Invalid entity code: {entity}")
    return entity