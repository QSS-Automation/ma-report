"""Adjustment tab: invoices, split lines, manual deferred lines."""
from datetime import date, datetime
import json
import threading
import traceback
from decimal import Decimal
from typing import Literal
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import run, SessionLocal
from app.models.schemas import (AdjustmentResponse, InvoiceOut, ManualLineIn,
    ManualLineResponse, SaveSplitsRequest, SaveSplitsResponse, SplitLineOut)


class AdjustmentService:

    def get_invoices(self, db: Session, jt: Literal["SALES","PURCHASE"],
                     fd: date, td: date, entity:str="QM") -> AdjustmentResponse:
        sql = f"""
            SELECT * FROM (
                SELECT gl.source, gl.source_key, gl.trans_date,
                    gl.acc_no, gl.acc_type, gl.acc_desc,
                    gl.de_acc_no, da.acc_desc AS de_acc_desc,
                    gl.proj_no, gl.ref_no1, gl.ref_no2,
                    gl.description, gl.home_dr, gl.home_cr,
                    CASE WHEN '{jt}' = 'SALES'
                         THEN -(gl.home_dr - gl.home_cr)
                         ELSE (gl.home_dr - gl.home_cr) END AS amount,
                    gl.journal_type
                FROM staging_rr_{entity}.RR_gl_lines gl
                LEFT JOIN curated_acc_{entity}.dim_account da
                    ON da.acc_no = gl.de_acc_no
                WHERE (
                    gl.journal_type = '{jt}'
                    OR ('{jt}' = 'PURCHASE' AND '{entity}' = 'QA' AND gl.journal_type = 'BANK')
                )
                  AND gl.trans_date BETWEEN '{fd}' AND '{td}'
                  AND (
                      ('{jt}' = 'SALES' AND (
                          gl.acc_type = 'SA'
                          OR (gl.acc_type = 'SL' AND gl.acc_no = '500-0000')
                          OR gl.acc_desc = 'CONTRACT ASSET'
                      ))
                      OR
                      ('{jt}' = 'PURCHASE' AND (
                          (gl.acc_type = 'CO' AND gl.acc_no NOT LIKE '617-%')
                          OR ('{entity}' = 'QA' AND gl.journal_type = 'BANK' AND gl.acc_no = '616-0000')
                          OR gl.acc_desc = 'ACCRUALS'
                          OR gl.acc_desc = 'CONTRACT ASSET'
                          OR gl.acc_desc = 'CONTRACT LIABILITIES'
                          OR gl.acc_desc = 'CONTRACT LIABILITY'
                      ))
                  )

                UNION ALL

                SELECT
                    'adj_line'       AS source,
                    fa.adj_key       AS source_key,
                    fa.trans_date,
                    fa.acc_no,
                    fa.acc_type,
                    fa.acc_desc,
                    fa.de_acc_no,
                    da2.acc_desc     AS de_acc_desc,
                    fa.proj_no,
                    fa.ref_no1,
                    fa.ref_no2,
                    fa.description,
                    fa.home_dr,
                    fa.home_cr,
                    CASE WHEN '{jt}' = 'SALES'
                         THEN -(fa.home_dr - fa.home_cr)
                         ELSE (fa.home_dr - fa.home_cr) END AS amount,
                    fa.journal_type
                FROM curated_acc_{entity}.fact_adj_line fa
                LEFT JOIN curated_acc_{entity}.dim_account da2
                    ON da2.acc_no = fa.de_acc_no
                WHERE fa.journal_type = '{jt}'
                  AND fa.trans_date BETWEEN '{fd}' AND '{td}'
            ) combined
            ORDER BY trans_date DESC, ref_no1
        """
        result = db.execute(text(sql))
        inv_raw = [dict(zip(result.keys(), row)) for row in result.fetchall()]

        out = []
        for inv in inv_raw:
            is_manual = inv["source"] == "adj_line"
            splits = [self._ms(s) for s in run(db, f"""
                    SELECT split_id, category, end_user, start_date, end_date,
                        total_days, net_amount, is_locked, locked_at, locked_by, remark
                    FROM curated_acc_{entity}.fact_split
                    WHERE gl_dtl_key = :sk AND is_manual_line = :ml
                    ORDER BY split_id
                """, {"sk": inv["source_key"], "ml": 1 if is_manual else 0})]
            d = lambda v: Decimal(str(v)) if v is not None else Decimal(0)
            out.append(InvoiceOut(
                source=inv["source"], source_key=inv["source_key"],
                trans_date=inv["trans_date"],
                acc_no=inv.get("acc_no"), acc_desc=inv.get("acc_desc"),
                de_acc_no=inv.get("de_acc_no"), de_acc_desc=inv.get("de_acc_desc"),
                proj_no=inv.get("proj_no"),
                ref_no1=inv.get("ref_no1"), ref_no2=inv.get("ref_no2"),
                description=inv.get("description"), home_dr=d(inv["home_dr"]),
                home_cr=d(inv["home_cr"]), amount=d(inv["amount"]),
                journal_type=inv["journal_type"], splits=splits))
        return AdjustmentResponse(from_date=fd, to_date=td, journal_type=jt, invoices=out)

    def save_splits(self, db: Session, req: SaveSplitsRequest) -> SaveSplitsResponse:
        entity = req.entity
        now = datetime.now()
        try:
            locked = run(db,
                f"SELECT COUNT(*) cnt FROM curated_acc_{entity}.fact_split WHERE gl_dtl_key=:sk AND is_locked=1",
                {"sk": req.source_key})
            if locked[0]["cnt"] > 0:
                return SaveSplitsResponse(
                    status="error", split_ids=[],
                    message="Period is locked. Request unlock before editing.")

            db.execute(text(
                f"DELETE FROM curated_acc_{entity}.fact_split WHERE gl_dtl_key=:sk AND is_locked=0 AND is_manual_line=0"),
                {"sk": req.source_key})

            ids = []
            for ln in req.splits:
                td = None
                if ln.start_date and ln.end_date:
                    td = (ln.end_date - ln.start_date).days + 1
                r = db.execute(text(f"""
                    INSERT INTO curated_acc_{entity}.fact_split
                        (gl_dtl_key, journal_type, net_amount, category, end_user,
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

            try:
                ref = run(db,
                    f"SELECT ref_no1 FROM curated_acc_{entity}.fact_journal WHERE gl_dtl_key=:sk LIMIT 1",
                    {"sk": req.source_key})
                ref_no = ref[0]["ref_no1"] if ref else None
                action = "split" if len(req.splits) > 1 else "edit"
                db.execute(text("""
                    INSERT INTO ops_QM.fact_adj_log
                        (entity, ts, user_id, action_type, journal_type,
                         source_key, ref_no, period, detail, new_value)
                    VALUES(:entity,:now,:user,:action,:jt,
                           :sk,:ref,:period,:detail,:nv)
                """), {
                    "entity":  req.entity,
                    "now":     now,
                    "user":    req.user,
                    "action":  action,
                    "jt":      req.journal_type,
                    "sk":      req.source_key,
                    "ref":     ref_no,
                    "period":  now.strftime("%Y-%m"),
                    "detail":  f"{len(req.splits)} split line(s) saved",
                    "nv":      json.dumps([{
                        "category":   ln.category,
                        "net_amount": str(ln.split_amount),
                        "start_date": str(ln.start_date),
                        "end_date":   str(ln.end_date)
                    } for ln in req.splits])
                })
                db.commit()
            except Exception:
                pass

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

            sort_group = 1 if req.journal_type == "SALES" else 3

            r = db.execute(text(f"""
                INSERT INTO curated_acc_{entity}.fact_adj_line
                    (acc_no, de_acc_no, acc_desc, acc_type, is_pnl_account, sort_group,
                     journal_type, trans_date, proj_no, ref_no1, ref_no2, description,
                     home_dr, home_cr, amount, curated_loaded_at, created_by)
                VALUES(:acc_no,:de_no,:de,'',1,:sg,:jt,:td,:pj,:r1,NULL,:desc,:hdr,:hcr,:hdr-:hcr,:now,:u)
            """), {
                "acc_no": req.acc_no or "",
                "de_no": req.de_acc_no or "",
                "de":   req.de_acc_desc or "",
                "sg":   sort_group,
                "jt":   req.journal_type,
                "td":   req.trans_date,
                "pj":   req.proj_no,
                "r1":   req.ref_no1,
                "desc": req.description,
                "hdr":  req.home_dr,
                "hcr":  req.home_cr,
                "now":  now,
                "u":    req.user
            })
            adj_key = r.lastrowid

            sr = db.execute(text(f"""
                INSERT INTO curated_acc_{entity}.fact_split
                    (gl_dtl_key, journal_type, net_amount, category, end_user,
                     start_date, end_date, total_days, remark,
                     is_manual_line, is_locked,
                     created_at, created_by, updated_at, updated_by)
                VALUES(:sk,:jt,:amt,:cat,:eu,:sd,:ed,:td,:rm,1,0,:now,:u,:now,:u)
            """), {
                "sk":  adj_key,
                "jt":  req.journal_type,
                "amt": req.split_amount,
                "cat": req.category,
                "eu":  req.end_user,
                "sd":  req.start_date,
                "ed":  req.end_date,
                "td":  td,
                "rm":  req.remark,
                "now": now,
                "u":   req.user
            })
            db.commit()

            # Rebuild staging in background — response returns immediately
            def _rebuild_bg():
                bg_db = SessionLocal()
                try:
                    from app.services.staging_service import StagingService
                    StagingService().rebuild(bg_db, req.user, entity)
                except Exception:
                    pass
                finally:
                    bg_db.close()

            threading.Thread(target=_rebuild_bg, daemon=True).start()

            return ManualLineResponse(status="ok", split_id=sr.lastrowid)
        except Exception as e:
            db.rollback()
            traceback.print_exc()
            return ManualLineResponse(status="error", message=str(e))

    @staticmethod
    def _ms(s) -> SplitLineOut:
        d = lambda v: Decimal(str(v)) if v is not None else Decimal(0)
        return SplitLineOut(
            split_id=s["split_id"], category=s.get("category"),
            end_user=s.get("end_user"), start_date=s.get("start_date"),
            end_date=s.get("end_date"), total_days=s.get("total_days"),
            net_amount=d(s["net_amount"]), remark=s.get("remark"),
            is_locked=bool(s["is_locked"]), locked_at=s.get("locked_at"),
            locked_by=s.get("locked_by"))
