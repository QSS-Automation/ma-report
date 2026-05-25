from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.schemas import (AdjustmentResponse, ManualLineIn, ManualLineResponse,
    SaveSplitsRequest, SaveSplitsResponse)
from app.services.adjustment_service import AdjustmentService
from app.utils import validate_entity

router = APIRouter(prefix="/api/adjustment", tags=["Adjustment"])
_svc = AdjustmentService()

@router.get("/sales", response_model=AdjustmentResponse)
def get_sales(from_date: date, to_date: date, entity: str = "QM", db: Session = Depends(get_db)):
    return _svc.get_invoices(db, "SALES", from_date, to_date, validate_entity(entity))

@router.get("/purchases", response_model=AdjustmentResponse)
def get_purchases(from_date: date, to_date: date, entity: str = "QM", db: Session = Depends(get_db)):
    return _svc.get_invoices(db, "PURCHASE", from_date, to_date, validate_entity(entity))

@router.post("/splits", response_model=SaveSplitsResponse)
def save_splits(req: SaveSplitsRequest, db: Session = Depends(get_db)):
    validate_entity(req.entity)
    return _svc.save_splits(db, req)

@router.post("/manual-line", response_model=ManualLineResponse)
def save_manual_line(req: ManualLineIn, db: Session = Depends(get_db)):
    return _svc.save_manual_line(db, req)