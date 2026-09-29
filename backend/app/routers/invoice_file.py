from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.sharepoint_service import SharePointService
from app.utils import validate_entity, check_entity_access

router = APIRouter(prefix="/api/invoice-file", tags=["Invoice file"])
_svc = SharePointService()


@router.get("")
def get_invoice_file(ref: str, doc_date: date, entity: str = "QM", kind: str = "sales",
                     user_id: str = "", db: Session = Depends(get_db)):
    """Locate an invoice file in SharePoint and return its link:
    {url, name, matches}. The link opens with the user's own SharePoint
    permissions.
      kind=sales    — ref = Ref. 1 (sales invoice no.), file '{ref}_….pdf'
      kind=purchase — ref = Ref. 2 (supplier invoice no.), file
                      '<PV no.>--<Supplier>_<ref>_<description>'"""
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    if kind == "purchase":
        return _svc.find_purchase_invoice(entity, ref, doc_date)
    if kind != "sales":
        raise HTTPException(400, f"Unknown invoice kind: {kind}")
    return _svc.find_sales_invoice(entity, ref, doc_date)
