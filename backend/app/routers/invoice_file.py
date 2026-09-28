from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.sharepoint_service import SharePointService
from app.utils import validate_entity, check_entity_access

router = APIRouter(prefix="/api/invoice-file", tags=["Invoice file"])
_svc = SharePointService()


@router.get("")
def get_invoice_file(ref: str, doc_date: date, entity: str = "QM",
                     user_id: str = "", db: Session = Depends(get_db)):
    """Locate the sales invoice PDF '{ref}_….pdf' in SharePoint and return
    its link: {url, name, matches}. The link opens with the user's own
    SharePoint permissions."""
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    return _svc.find_sales_invoice(entity, ref, doc_date)
