from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import PnlResponse
from app.services.pnl_service import PnlService
from app.utils import validate_entity
router = APIRouter(prefix="/api/pnl", tags=["P&L"])
_svc = PnlService()
@router.get("", response_model=PnlResponse)
def get_pnl(from_date: date, to_date: date,
            entity: str = "QM",
            db: Session = Depends(get_db)):
    return _svc.get_pnl(db, from_date, to_date, validate_entity(entity))