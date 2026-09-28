"""Order List Enhanced — SO level grouping with PO matching."""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import get_db, run
from app.utils import validate_entity, check_entity_access

router = APIRouter(prefix="/api/order-list-enhanced", tags=["Order List Enhanced"])

@router.get("")
def get_order_list_enhanced(entity: str = "QM", level: str = "committed",
                             user_id: str = "", db: Session = Depends(get_db)):
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)

    so_filter = {
        "committed": "1=1",
        "accrued":   "s.billing_status = 'Invoiced'",
        "realised":  "s.payment_status = 'Fully Paid'"
    }.get(level, "1=1")

    po_filter = {
        "committed": "1=1",
        "accrued":   "p.line_status = 'Invoiced'",
        "realised":  "p.payment_status = 'Fully Paid'"
    }.get(level, "1=1")

    so_rows = run(db, f"""
        SELECT
            s.so_no, s.so_date, s.so_dtl_key, s.proj_no,
            s.item_code, s.description, s.qty, s.currency_code,
            s.so_amount, s.iv_no, s.iv_date, s.iv_amount,
            s.cn_nos, s.cn_amount, s.paid_amount,
            s.last_payment_date, s.outstanding,
            s.billing_status, s.payment_status,
            s.linked_po_no, s.linked_vendor, s.po_form_status
        FROM staging_rr_{entity}.RR_so_lines s
        WHERE s.proj_no IS NOT NULL AND s.proj_no != ''
          AND {so_filter}
        ORDER BY s.proj_no, s.so_no, s.so_dtl_key
    """, {})

    po_rows = run(db, f"""
        SELECT
            p.po_no, p.po_date, p.po_dtl_key, p.proj_no,
            p.item_code, p.description, p.qty, p.currency_code,
            p.po_amount, p.pi_no, p.pi_date, p.pi_amount,
            p.cn_nos, p.cn_amount, p.paid_amount,
            p.last_payment_date, p.outstanding,
            p.po_billing_status, p.line_status, p.payment_status,
            p.total_po_amount, p.billed_amount, p.unbilled_amount,
            p.linked_so_no, p.form_proj_no, p.form_vendor_name, p.po_form_status
        FROM staging_rr_{entity}.RR_po_lines p
        WHERE p.proj_no IS NOT NULL AND p.proj_no != ''
          AND {po_filter}
        ORDER BY p.proj_no, p.linked_so_no, p.po_no
    """, {})

    return {"so_lines": so_rows, "po_lines": po_rows}


@router.post("/link-po")
def link_po_to_so(body: dict, db: Session = Depends(get_db)):
    """Save a manual SO<->PO correction. Table location:
    curated_acc_{entity}.override_so_po_link (per-entity, curated layer —
    persists across every rebuild, see raw_2_curated_orderlist.sql).
    Not reflected in fact_so_po_map / the tree until the next curated
    rebuild absorbs it — see /pending-links for the "Pending Sync" signal.
    """
    entity = validate_entity(body["entity"])
    check_entity_access(db, body.get("user", ""), entity)
    db.execute(text(f"""
        INSERT INTO curated_acc_{entity}.override_so_po_link
            (so_no, po_no, proj_no, vendor_name, note, created_by, created_at, applied_at)
        VALUES (:so_no, :po_no, :proj_no, :vendor_name, :note, :user, :now, NULL)
        ON DUPLICATE KEY UPDATE
            po_no=VALUES(po_no), proj_no=VALUES(proj_no), vendor_name=VALUES(vendor_name),
            note=VALUES(note), created_by=VALUES(created_by), created_at=VALUES(created_at),
            applied_at=NULL   -- a re-link always needs to be picked up by the next rebuild
    """), {
        "so_no": body["so_no"],
        "po_no": body["po_no"],
        "proj_no": body.get("proj_no"),
        "vendor_name": body.get("vendor_name"),
        "note": body.get("note", "Manually linked via Order List UI"),
        "user": body.get("user"),
        "now": datetime.now(),
    })
    db.commit()
    return {"status": "ok"}


@router.get("/pending-links")
def get_pending_links(entity: str = "QM", user_id: str = "", db: Session = Depends(get_db)):
    """Overrides submitted but not yet absorbed by a curated rebuild.
    Frontend polls this to render the 'Pending Sync' badge."""
    entity = validate_entity(entity)
    check_entity_access(db, user_id, entity)
    rows = run(db, f"""
        SELECT so_no, po_no, proj_no, created_by, created_at
        FROM curated_acc_{entity}.override_so_po_link
        WHERE applied_at IS NULL
        ORDER BY created_at DESC
    """, {})
    return rows
