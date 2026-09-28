from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import PnlResponse
from app.services.pnl_service import PnlService
from app.services.pnl_service_v2 import PnlServiceV2
from app.utils import validate_entity, check_entity_access

router = APIRouter(prefix="/api/pnl", tags=["P&L"])
_svc = PnlService()
_svc_v2 = PnlServiceV2()

@router.get("", response_model=PnlResponse)
def get_pnl(from_date: date, to_date: date,
            entity: str = "QM", user_id: str = "",
            db: Session = Depends(get_db)):
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    return _svc.get_pnl(db, from_date, to_date, entity)

@router.get("/v2", response_model=PnlResponse)
def get_pnl_v2(from_date: date, to_date: date,
               entity: str = "QM", user_id: str = "",
               db: Session = Depends(get_db)):
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    return _svc_v2.get_pnl(db, from_date, to_date, entity)
