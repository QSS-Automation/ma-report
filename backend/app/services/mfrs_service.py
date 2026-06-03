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
        raw=run(db,f"""SELECT gl_dtl_key,doc_no,split_index,recognised_year,
            trans_date,description,proj_no,net_amount,total_days,locked_at,locked_by,
            m01,m02,m03,m04,m05,m06,m07,m08,m09,m10,m11,m12
            FROM staging_{entity}.RR_mfrs
            WHERE journal_type=:jt AND recognised_year IN ({ys})
            ORDER BY recognised_year,doc_no,split_index""",{"jt":jt})
        rows=[MfrsRow(gl_dtl_key=r["gl_dtl_key"],doc_no=r.get("doc_no"),
            split_index=r["split_index"],recognised_year=r["recognised_year"],
            trans_date=r.get("trans_date"),description=r.get("description"),
            proj_no=r.get("proj_no"),net_amount=Decimal(str(r["net_amount"] or 0)),
            total_days=r.get("total_days"),
            monthly={f"m{i:02d}":(Decimal(str(r[f"m{i:02d}"])) if r.get(f"m{i:02d}") is not None else None) for i in range(1,13)},
            locked_at=r.get("locked_at"),locked_by=r.get("locked_by")) for r in raw]
        return MfrsResponse(journal_type=jt,recognised_years=years,month_columns=amks,rows=rows)
    def lock_period(self, db: Session, req: LockPeriodRequest) -> LockPeriodResponse:
        try:
            from app.services.staging_service import StagingService
            y, ms = req.lock_year_month.split("-"); ly, lm = int(y), int(ms)
            ls = date(ly, lm, 1); le = date(ly, lm, calendar.monthrange(ly, lm)[1])
            entity = getattr(req, 'entity', 'QM')
            tbl = f"curated_{entity}.mfrs_sales" if req.journal_type == "SALES" else f"curated_{entity}.mfrs_purchases"


            splits = run(db, f"""
                SELECT fs.split_id, fs.gl_dtl_key, fj.ref_no1 doc_no,
                    fs.split_amount net_amount, fs.start_date, fs.end_date, fs.total_days
                FROM curated_{entity}.fact_split fs
                LEFT JOIN curated_{entity}.fact_journal fj ON fs.gl_dtl_key = fj.gl_dtl_key
                WHERE fs.journal_type=:jt AND fs.is_locked=0
                AND fs.start_date IS NOT NULL AND fs.end_date IS NOT NULL
                AND fs.start_date<=:le AND fs.end_date>=:ls
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
                    f"UPDATE curated_{entity}.fact_split SET is_locked=1,locked_at=:now,locked_by=:u WHERE split_id=:sid"),
                    {"now": now, "u": req.user, "sid": sp["split_id"]}); cnt += 1

            db.commit()

            # Step 4 — rebuild stg_mfrs immediately after lock
            StagingService().rebuild_mfrs(db, req.user, entity)
            
            _notif = NotificationService()

            # Get admin user_id from ops_QM.users
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
            return LockPeriodResponse(status="ok", locked_rows=cnt)
        except Exception as e:
            db.rollback()
            return LockPeriodResponse(status="error", locked_rows=0, message=str(e))

    @staticmethod
    def _months(fd,td):
        r=[]; y,m=fd.year,fd.month
        while True:
            r.append(date(y,m,1))
            if (y,m)==(td.year,td.month): break
            m+=1
            if m>12: m,y=1,y+1
        return r

    @classmethod
    def _amks(cls,fd,td):
        seen=set(); res=[]
        for d in cls._months(fd,td):
            k=f"m{d.month:02d}"
            if k not in seen: seen.add(k); res.append(k)
        return res

    @staticmethod
    def _prop(na,ss,se,td):
        r={}; cy,cm=ss.year,ss.month
        em=se.replace(day=1)
        while True:
            ms=date(cy,cm,1); me=date(cy,cm,calendar.monthrange(cy,cm)[1])
            ov=max(0,(min(se,me)-max(ss,ms)).days+1)
            r[ms]=(na*Decimal(ov)/Decimal(td)).quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)
            if (cy,cm)==(em.year,em.month): break
            cm+=1
            if cm>12: cm,cy=1,cy+1
        return r

    @staticmethod
    def _ov(ms,ss,se):
        cy,cm=ms.year,ms.month; me=date(cy,cm,calendar.monthrange(cy,cm)[1])
        return max(0,(min(se,me)-max(ss,ms)).days+1)
