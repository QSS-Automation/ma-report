"""Export router — generates downloadable Excel report."""
from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.utils import validate_entity
from app.services.export_service import generate_excel

router = APIRouter(prefix="/api/export", tags=["Export"])

@router.get("/excel")
def export_excel(
    entity: str = "QM",
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db)
):
    validate_entity(entity)
    fd = from_date or date.today().replace(month=1, day=1)
    td = to_date   or date.today()
    xlsx_bytes = generate_excel(db, entity, fd, td)
    filename = f"MA_Report_{entity}_{fd.strftime('%Y%m')}_{td.strftime('%Y%m')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
