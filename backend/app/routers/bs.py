from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import BsResponse
from app.services.bs_service import BsService
from app.utils import validate_entity

router = APIRouter(prefix="/api/bs", tags=["Balance Sheet"])
_svc = BsService()
@router.get("", response_model=BsResponse)
def get_bs(from_date: date, to_date: date,
           entity: str = "QM",
           db: Session = Depends(get_db)):
    return _svc.get_bs(db, from_date, to_date, validate_entity(entity))