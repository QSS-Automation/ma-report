from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import LockPeriodRequest, LockPeriodResponse, MfrsResponse
from app.services.mfrs_service import MfrsService
from app.utils import validate_entity

router = APIRouter(prefix="/api/mfrs", tags=["MFRS"])
_svc = MfrsService()
@router.get("", response_model=MfrsResponse)
def get_mfrs(journal_type: Literal["SALES","PURCHASE"],
             from_date: date, to_date: date,
             entity: str = "QM",
             db: Session = Depends(get_db)):
    return _svc.get_mfrs(db, journal_type, from_date, to_date, validate_entity(entity))
@router.post("/lock", response_model=LockPeriodResponse)
def lock_period(req: LockPeriodRequest, db: Session = Depends(get_db)):
    validate_entity(req.entity)  # validate entity from request body
    return _svc.lock_period(db, req)
