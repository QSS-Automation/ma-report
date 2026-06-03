"""Adjustment tab: invoices, split lines, manual deferred lines."""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import run
from app.models.schemas import (AdjustmentResponse, InvoiceOut, ManualLineIn,
    ManualLineResponse, SaveSplitsRequest, SaveSplitsResponse, SplitLineOut)

class AdjustmentService:

    def get_invoices(self, db: Session, jt: Literal["SALES","PURCHASE"],
                     fd: date, td: date, entity:str="QM") -> AdjustmentResponse:
        inv_raw = run(db, f"""
            SELECT gl.source, gl.source_key, gl.trans_date,
                gl.acc_no, gl.acc_type, gl.acc_desc,
                gl.de_acc_no, gl.proj_no, gl.ref_no1, gl.ref_no2,
                gl.description, gl.home_dr, gl.home_cr,
                CASE WHEN :jt = 'SALES'
                     THEN -(gl.home_dr - gl.home_cr)
                     ELSE (gl.home_dr - gl.home_cr) END AS amount,
                gl.journal_type
            FROM staging_{entity}.RR_gl_lines gl
            WHERE gl.journal_type = :jt
              AND gl.trans_date BETWEEN :fd AND :td
              AND (
                  (:jt = 'SALES' AND (
                      gl.acc_type = 'SA'
                      OR (gl.acc_type = 'SL' AND gl.acc_no = '500-0000')
                  ))
                  OR
                  (:jt = 'PURCHASE' AND gl.acc_type = 'CO' AND gl.acc_no NOT LIKE '617-%')
              )
            ORDER BY gl.trans_date DESC, gl.ref_no1
        """, {"jt": jt, "fd": fd, "td": td})

        out = []
        for inv in inv_raw:
            splits = []
            if inv["source"] == "autocount":
                splits = [self._ms(s) for s in run(db, f"""
                    SELECT split_id, category, end_user, start_date, end_date,
                        total_days, net_amount, is_locked, locked_at, locked_by
                    FROM curated_{entity}.fact_split
                    WHERE gl_dtl_key = :sk ORDER BY split_id
                """, {"sk": inv["source_key"]})]
            d = lambda v: Decimal(str(v)) if v is not None else Decimal(0)
            out.append(InvoiceOut(
                source=inv["source"], source_key=inv["source_key"],
                trans_date=inv["trans_date"],
                acc_no=inv.get("acc_no"), de_acc_no=inv.get("de_acc_no"),
                de_acc_desc=inv.get("acc_desc"), proj_no=inv.get("proj_no"),
                ref_no1=inv.get("ref_no1"), ref_no2=inv.get("ref_no2"),
                description=inv.get("description"), home_dr=d(inv["home_dr"]),
                home_cr=d(inv["home_cr"]), amount=d(inv["amount"]),
                journal_type=inv["journal_type"], splits=splits))
        return AdjustmentResponse(from_date=fd, to_date=td, journal_type=jt, invoices=out)

    def save_splits(self, db: Session, req: SaveSplitsRequest) -> SaveSplitsResponse:
        entity = req.entity
        now = datetime.now()
        try:
            # Guard: block if any locked splits exist
            locked = run(db,
                f"SELECT COUNT(*) cnt FROM curated_{entity}.fact_split WHERE gl_dtl_key=:sk AND is_locked=1",
                {"sk": req.source_key})
            if locked[0]["cnt"] > 0:
                return SaveSplitsResponse(
                    status="error", split_ids=[],
                    message="Period is locked. Request unlock before editing.")

            db.execute(text(
                f"DELETE FROM curated_{entity}.fact_split WHERE gl_dtl_key=:sk AND is_locked=0 AND is_manual_line=0"),
                {"sk": req.source_key})

            ids = []
            for ln in req.splits:
                td = None
                if ln.start_date and ln.end_date:
                    td = (ln.end_date - ln.start_date).days + 1
                r = db.execute(text(f"""
                    INSERT INTO curated_{entity}.fact_split
                        (gl_dtl_key, journal_type, split_amount, category, end_user,
                         start_date, end_date, total_days, remark,
                         is_manual_line, is_locked,
                         created_at, created_by, updated_at, updated_by)
                    VALUES(:sk,:jt,:amt,:cat,:eu,:sd,:ed,:td,:rm,0,0,:now,:u,:now,:u)
                """), {
                    "sk":  req.source_key,
                    "jt":  req.journal_type,
                    "amt": ln.split_amount,
                    "cat": ln.category,
                    "eu":  ln.end_user,
                    "sd":  ln.start_date,
                    "ed":  ln.end_date,
                    "td":  td,
                    "rm":  ln.remark,
                    "now": now,
                    "u":   req.user
                })
                ids.append(r.lastrowid)

            db.commit()
            return SaveSplitsResponse(status="ok", split_ids=ids)
        except Exception as e:
            db.rollback()
            return SaveSplitsResponse(status="error", split_ids=[], message=str(e))

    def save_manual_line(self, db: Session, req: ManualLineIn) -> ManualLineResponse:
        entity = req.entity
        now = datetime.now()
        try:
            td = None
            if req.start_date and req.end_date:
                td = (req.end_date - req.start_date).days + 1
            db.execute(text(f"""
                INSERT INTO curated_{entity}.fact_adj_line
                    (acc_no, de_acc_no, acc_desc, acc_type, is_pnl_account, sort_group,
                     journal_type, trans_date, proj_no, ref_no1, ref_no2, description,
                     home_dr, home_cr, amount, created_at, created_by)
                VALUES('','',:de,'',1,1,:jt,:td,:pj,:r1,NULL,:desc,:hdr,:hcr,:hdr-:hcr,:now,:u)
            """), {
                "de": req.de_acc_desc or "", "jt": req.journal_type, "td": req.trans_date,
                "pj": req.proj_no, "r1": req.ref_no1, "desc": req.description,
                "hdr": req.home_dr, "hcr": req.home_cr, "now": now, "u": req.user
            })
            sr = db.execute(text(f"""
                INSERT INTO curated_{entity}.fact_split
                    (gl_dtl_key, journal_type, trans_date, de_acc_desc, proj_no, ref_no1,
                     description, home_dr, home_cr, net_amount, category, end_user,
                     start_date, end_date, total_days, remark, is_manual_line, is_locked,
                     created_at, created_by, updated_at, updated_by)
                VALUES(NULL,:jt,:td,:de,:pj,:r1,:desc,:hdr,:hcr,:amt,:cat,:eu,
                       :sd,:ed,:tdays,:rm,1,0,:now,:u,:now,:u)
            """), {
                "jt": req.journal_type, "td": req.trans_date, "de": req.de_acc_desc,
                "pj": req.proj_no, "r1": req.ref_no1, "desc": req.description,
                "hdr": req.home_dr, "hcr": req.home_cr, "amt": req.split_amount,
                "cat": req.category, "eu": req.end_user, "sd": req.start_date,
                "ed": req.end_date, "tdays": td, "rm": req.remark, "now": now, "u": req.user
            })
            db.commit()
            return ManualLineResponse(status="ok", split_id=sr.lastrowid)
        except Exception as e:
            db.rollback()
            return ManualLineResponse(status="error", message=str(e))

    @staticmethod
    def _ms(s) -> SplitLineOut:
        d = lambda v: Decimal(str(v)) if v is not None else Decimal(0)
        return SplitLineOut(
            split_id=s["split_id"], category=s.get("category"),
            end_user=s.get("end_user"), start_date=s.get("start_date"),
            end_date=s.get("end_date"), total_days=s.get("total_days"),
            split_amount=d(s["net_amount"]), remark=s.get("remark"),
            is_locked=bool(s["is_locked"]), locked_at=s.get("locked_at"),
            locked_by=s.get("locked_by"))