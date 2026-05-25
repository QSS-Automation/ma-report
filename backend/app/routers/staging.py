from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import RefConfigOut, RefreshRequest, RefreshResponse
from app.services.config_service import ConfigService
from app.services.staging_service import StagingService
from app.utils import validate_entity

router = APIRouter(tags=["System"])
_stg = StagingService(); _cfg = ConfigService()
@router.post("/api/staging/refresh", response_model=RefreshResponse)
def refresh_staging(req: RefreshRequest, db: Session = Depends(get_db)):
    from app.utils import validate_entity
    return _stg.rebuild(db, req.user, validate_entity(req.entity))


@router.get("/api/config", response_model=RefConfigOut)
def get_config(entity: str = "QM", db: Session = Depends(get_db)):
    from app.utils import validate_entity
    return _cfg.get_config(db, validate_entity(entity))