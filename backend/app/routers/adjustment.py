from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db, run
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


@router.get("/accounts")
def get_accounts(entity: str = "QM", journal_type: str = "SALES", db: Session = Depends(get_db)):
    validate_entity(entity)
    if journal_type == "SALES":
        gl_filter = "acc_type IN ('SL','SA') OR acc_no = '399-9000'"
        de_filter = "acc_type = 'CA' AND acc_no LIKE '3%'"
    else:
        gl_filter = "acc_type IN ('CO','CL','CA') OR acc_no = '410-1000'"
        de_filter = "acc_type = 'CL' AND acc_no LIKE '4%'"

    gl_rows = run(db, f"""
        SELECT acc_no, acc_desc, acc_type FROM curated_acc_{entity}.dim_account
        WHERE {gl_filter} ORDER BY acc_no
    """, {})
    de_rows = run(db, f"""
        SELECT acc_no, acc_desc, acc_type FROM curated_acc_{entity}.dim_account
        WHERE {de_filter} ORDER BY acc_no
    """, {})
    return {"accounts": gl_rows, "de_accounts": de_rows}

