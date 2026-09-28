"""MFRS tab: query stg_mfrs + lock period with Option A rounding fix."""
import calendar
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import run
from app.models.schemas import LockPeriodRequest, LockPeriodResponse, MfrsResponse, MfrsRow
from app.services.notification_service import NotificationService


class MfrsService:
    def get_mfrs(self, db: Session, jt: Literal["SALES","PURCHASE"],
                 fd: date, td: date, entity:str="QM") -> MfrsResponse:
        years=sorted({d.year for d in self._months(fd,td)})
        amks=self._amks(fd,td); ys=",".join(str(y) for y in years)
        # Read-only enrichment for the MFRS table columns: Ref. 2 and the
        # debtor/creditor name come from the source journal line (same
        # dim_account lookup the Adjustment tab uses for "Debtor Desc."), and
        # the recognition start/end dates from the split itself
        # (RR_mfrs.split_index is fact_split.split_id). All LEFT JOINs on
        # primary keys, so the row set is exactly what it was before.
        raw=run(db,f"""SELECT m.gl_dtl_key,m.doc_no,m.split_index,m.recognised_year,
            m.trans_date,m.description,m.proj_no,m.net_amount,m.total_days,m.locked_at,m.locked_by,
            m.m01,m.m02,m.m03,m.m04,m.m05,m.m06,m.m07,m.m08,m.m09,m.m10,m.m11,m.m12,
            fj.ref_no2, da.acc_desc AS de_acc_desc, fs.start_date, fs.end_date
            FROM staging_rr_{entity}.RR_mfrs m
            LEFT JOIN curated_acc_{entity}.fact_journal fj ON fj.gl_dtl_key=m.gl_dtl_key
            LEFT JOIN curated_acc_{entity}.dim_account da ON da.acc_no=fj.de_acc_no
            LEFT JOIN curated_acc_{entity}.fact_split fs ON fs.split_id=m.split_index
            WHERE m.journal_type=:jt AND m.recognised_year IN ({ys})
            ORDER BY m.recognised_year,m.doc_no,m.split_index""",{"jt":jt})
        rows=[MfrsRow(gl_dtl_key=r["gl_dtl_key"],doc_no=r.get("doc_no"),
            split_index=r["split_index"],recognised_year=r["recognised_year"],
            trans_date=r.get("trans_date"),description=r.get("description"),
            proj_no=r.get("proj_no"),ref_no2=r.get("ref_no2"),de_acc_desc=r.get("de_acc_desc"),
            start_date=r.get("start_date"),end_date=r.get("end_date"),
            net_amount=Decimal(str(r["net_amount"] or 0)),
            total_days=r.get("total_days"),
            monthly={f"{r['recognised_year']}-m{i:02d}":(Decimal(str(r[f"m{i:02d}"])) if r.get(f"m{i:02d}") is not None else None) for i in range(1,13)},
            locked_at=r.get("locked_at"),locked_by=r.get("locked_by")) for r in raw]
        return MfrsResponse(journal_type=jt,recognised_years=years,month_columns=amks,rows=rows)

    def lock_period(self, db: Session, req: LockPeriodRequest) -> LockPeriodResponse:
        try:
            from app.services.staging_service import StagingService
            y, ms = req.lock_year_month.split("-"); ly, lm = int(y), int(ms)
            ls = date(ly, lm, 1); le = date(ly, lm, calendar.monthrange(ly, lm)[1])
            entity = getattr(req, 'entity', 'QM')
            tbl = f"curated_acc_{entity}.mfrs_sales" if req.journal_type == "SALES" else f"curated_acc_{entity}.mfrs_purchases"

            splits = run(db, f"""
                SELECT fs.split_id, fs.gl_dtl_key, fj.ref_no1 doc_no,
                    fs.net_amount, fs.start_date, fs.end_date, fs.total_days
                FROM curated_acc_{entity}.fact_split fs
                JOIN curated_acc_{entity}.fact_journal fj ON fs.gl_dtl_key = fj.gl_dtl_key
                WHERE fs.journal_type=:jt AND fs.is_locked=0
                AND fs.start_date IS NOT NULL AND fs.end_date IS NOT NULL
                AND fj.trans_date BETWEEN :ls AND :le
                ORDER BY fs.gl_dtl_key, fs.split_id
            """, {"jt": req.journal_type, "ls": ls, "le": le})

            now = datetime.now(); cnt = 0
            for sp in splits:
                # Step 1 — delete stale MFRS rows for this split
                db.execute(text(f"DELETE FROM {tbl} WHERE split_index=:sid"),
                    {"sid": sp["split_id"]})

                na = Decimal(str(sp["net_amount"] or 0))
                ss, se = sp["start_date"], sp["end_date"]
                td = sp["total_days"] or (se - ss).days + 1
                prop = self._prop(na, ss, se, td)
                mos = sorted(prop.keys()); run_sum = Decimal(0)

                # Step 2 — insert fresh MFRS rows for ALL months
                for i, mo in enumerate(mos):
                    last = i == len(mos) - 1
                    ra = na - run_sum if last else prop[mo]; run_sum += ra
                    od = self._ov(mo, ss, se)
                    db.execute(text(f"""INSERT INTO {tbl}
                        (gl_dtl_key,doc_no,split_index,recog_month,overlap_days,total_days,
                        net_amount,recognised_amt,is_last_month,locked_at,locked_by)
                        VALUES(:gk,:dn,:si,:rm,:od,:td,:na,:ra,:il,:now,:u)"""),
                        {"gk": sp["gl_dtl_key"], "dn": sp.get("doc_no"), "si": sp["split_id"],
                        "rm": mo, "od": od, "td": td, "na": na, "ra": ra,
                        "il": 1 if last else 0, "now": now, "u": req.user})

                # Step 3 — mark split as locked
                db.execute(text(
                    f"UPDATE curated_acc_{entity}.fact_split SET is_locked=1,locked_at=:now,locked_by=:u WHERE split_id=:sid"),
                    {"now": now, "u": req.user, "sid": sp["split_id"]}); cnt += 1

            db.commit()

            # Step 4 — rebuild stg_mfrs immediately after lock
            StagingService().rebuild_mfrs(db, req.user, entity)

            # Step 5 — notify admins (failure does not break lock)
            try:
                _notif = NotificationService()
                admins = run(db,
                    "SELECT user_id FROM ops_QM.users WHERE role='admin' AND is_active=1", {})
                for admin in admins:
                    _notif.notify_lock(
                        db,
                        admin_id=admin["user_id"],
                        period=req.lock_year_month,
                        entity=req.entity,
                        locked_by=req.user
                    )
            except Exception:
                pass

            return LockPeriodResponse(status="ok", locked_rows=cnt)

        except Exception as e:
            db.rollback()
            return LockPeriodResponse(status="error", locked_rows=0, message=str(e))

    def unlock_period(self, db: Session, source_key: int, journal_type: str, entity: str, user: str):
        tbl = f"curated_acc_{entity}.mfrs_sales" if journal_type=="SALES" \
              else f"curated_acc_{entity}.mfrs_purchases"
        try:
            from app.services.staging_service import StagingService
            splits = run(db,
                f"SELECT split_id FROM curated_acc_{entity}.fact_split "
                f"WHERE gl_dtl_key=:sk AND is_locked=1",
                {"sk": source_key})
            for sp in splits:
                db.execute(text(f"DELETE FROM {tbl} WHERE split_index=:sid"),
                    {"sid": sp["split_id"]})
                db.execute(text(
                    f"UPDATE curated_acc_{entity}.fact_split "
                    f"SET is_locked=0, locked_at=NULL, locked_by=NULL "
                    f"WHERE split_id=:sid"),
                    {"sid": sp["split_id"]})
            db.commit()
            StagingService().rebuild_mfrs(db, user, entity)
            return {"status": "ok"}
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}

    @staticmethod
    def _months(fd, td):
        r = []; y, m = fd.year, fd.month
        while True:
            r.append(date(y, m, 1))
            if (y, m) == (td.year, td.month): break
            m += 1
            if m > 12: m, y = 1, y + 1
        return r

    @classmethod
    def _amks(cls, fd, td):
        seen = set(); res = []
        for d in cls._months(fd, td):
            k = f"{d.year}-m{d.month:02d}"
            if k not in seen: seen.add(k); res.append(k)
        return res

    @staticmethod
    def _prop(na, ss, se, td):
        r = {}; cy, cm = ss.year, ss.month
        em = se.replace(day=1)
        while True:
            ms = date(cy, cm, 1); me = date(cy, cm, calendar.monthrange(cy, cm)[1])
            ov = max(0, (min(se, me) - max(ss, ms)).days + 1)
            r[ms] = (na * Decimal(ov) / Decimal(td)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if (cy, cm) == (em.year, em.month): break
            cm += 1
            if cm > 12: cm, cy = 1, cy + 1
        return r

    @staticmethod
    def _ov(ms, ss, se):
        cy, cm = ms.year, ms.month; me = date(cy, cm, calendar.monthrange(cy, cm)[1])
        return max(0, (min(se, me) - max(ss, ms)).days + 1)
