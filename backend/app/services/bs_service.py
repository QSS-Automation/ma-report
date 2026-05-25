"""Balance Sheet CTE query — mirrors query_bs_from_staging.sql exactly."""
from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from dateutil.relativedelta import relativedelta
from app.db.database import run
from app.models.schemas import BsResponse, BsRow
from app.services.config_service import ConfigService

_SQL = """
WITH HistoricalPnL AS (
    SELECT SUM(
        CASE WHEN acc_type IN ('SL','OI') THEN home_cr-home_dr ELSE 0 END
      - CASE WHEN acc_type IN ('SA','EP','CO','TX') THEN home_dr-home_cr ELSE 0 END
    ) AS HomeNetPnL
    FROM staging_{entity}.RR_gl_lines
    WHERE is_pnl_account=1 AND trans_date < :sd
),
BringForward AS (
    SELECT acc_no, SUM(home_dr) BF_HomeDR, SUM(home_cr) BF_HomeCR
    FROM staging_{entity}.RR_gl_lines
    WHERE trans_date < :sd AND is_pnl_account=0 GROUP BY acc_no
),
CurrentPeriod AS (
    SELECT acc_no, SUM(home_dr) Period_HomeDR, SUM(home_cr) Period_HomeCR
    FROM staging_{entity}.RR_gl_lines
    WHERE trans_date BETWEEN :sd AND :ed GROUP BY acc_no
),
HPnL AS (SELECT HomeNetPnL FROM HistoricalPnL)
SELECT ob.acc_no,ob.acc_desc,ob.parent_acc_no,ob.acc_type,
    ob.ob_home_dr,ob.ob_home_cr,ob.ob_home_balance,
    CASE WHEN ob.acc_type IN ('SL','OI','SA','EP','CO','TX') THEN 0
         WHEN ob.acc_no=:re AND (SELECT HomeNetPnL FROM HPnL)<0
              THEN ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0)+ABS((SELECT HomeNetPnL FROM HPnL))
         ELSE ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0) END AS bf_home_dr,
    CASE WHEN ob.acc_type IN ('SL','OI','SA','EP','CO','TX') THEN 0
         WHEN ob.acc_no=:re AND (SELECT HomeNetPnL FROM HPnL)>=0
              THEN ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0)+(SELECT HomeNetPnL FROM HPnL)
         ELSE ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0) END AS bf_home_cr,
    CASE WHEN ob.acc_type IN ('SL','OI','SA','EP','CO','TX') THEN 0
         WHEN ob.acc_no=:re THEN
            (ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0)+CASE WHEN (SELECT HomeNetPnL FROM HPnL)<0 THEN ABS((SELECT HomeNetPnL FROM HPnL)) ELSE 0 END)
          - (ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0)+CASE WHEN (SELECT HomeNetPnL FROM HPnL)>=0 THEN (SELECT HomeNetPnL FROM HPnL) ELSE 0 END)
         ELSE (ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0))-(ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0))
    END AS bf_home_balance,
    IFNULL(cp.Period_HomeDR,0) period_home_dr,
    IFNULL(cp.Period_HomeCR,0) period_home_cr,
    IFNULL(cp.Period_HomeDR,0)-IFNULL(cp.Period_HomeCR,0) period_home_net,
    CASE WHEN ob.acc_type IN ('SL','OI','SA','EP','CO','TX') THEN
            IFNULL(cp.Period_HomeDR,0)-IFNULL(cp.Period_HomeCR,0)
         WHEN ob.acc_no=:re THEN
            (ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0)+IFNULL(cp.Period_HomeDR,0)+CASE WHEN (SELECT HomeNetPnL FROM HPnL)<0 THEN ABS((SELECT HomeNetPnL FROM HPnL)) ELSE 0 END)
          - (ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0)+IFNULL(cp.Period_HomeCR,0)+CASE WHEN (SELECT HomeNetPnL FROM HPnL)>=0 THEN (SELECT HomeNetPnL FROM HPnL) ELSE 0 END)
         ELSE (ob.ob_home_dr+IFNULL(bf.BF_HomeDR,0)+IFNULL(cp.Period_HomeDR,0))
             -(ob.ob_home_cr+IFNULL(bf.BF_HomeCR,0)+IFNULL(cp.Period_HomeCR,0))
    END AS closing_balance
FROM staging_{entity}.RR_ob_summary ob
LEFT JOIN BringForward bf ON ob.acc_no=bf.acc_no
LEFT JOIN CurrentPeriod cp ON ob.acc_no=cp.acc_no
WHERE ob.is_bs_account=1
  AND (ob.ob_home_dr+ob.ob_home_cr+IFNULL(bf.BF_HomeDR,0)+IFNULL(bf.BF_HomeCR,0)+
       IFNULL(cp.Period_HomeDR,0)+IFNULL(cp.Period_HomeCR,0))>0
ORDER BY ob.acc_no
"""


class BsService:
    def __init__(self):
        self._cfg = ConfigService()

    def get_bs(self, db: Session, fd: date, td: date, entity: str="QM") -> BsResponse:
        re = self._cfg.get_re_acc_no(db, entity)
        d = lambda v: Decimal(str(v)) if v is not None else Decimal(0)

        # Build list of month-end dates between fd and td
        months = []
        cur = fd.replace(day=1)
        while cur <= td:
            last_day = monthrange(cur.year, cur.month)[1]
            months.append(cur.replace(day=last_day))
            cur += relativedelta(months=1)

        month_labels = [m.strftime("%Y-%m") for m in months]
        acc_meta = {}
        monthly = defaultdict(dict)
        sql = _SQL.format(entity=entity)
        for med in months:
            label = med.strftime("%Y-%m")
            rows = run(db, sql, {"sd": fd, "ed": med, "re": re})
            for r in rows:
                k = r["acc_no"]
                if k not in acc_meta:
                    acc_meta[k] = {
                        "acc_no": k,
                        "acc_desc": r["acc_desc"],
                        "parent_acc_no": r.get("parent_acc_no"),
                        "acc_type": r["acc_type"],
                        "ob_home_dr": d(r["ob_home_dr"]),
                        "ob_home_cr": d(r["ob_home_cr"]),
                        "ob_home_balance": d(r["ob_home_balance"]),
                        "bf_home_dr": d(r["bf_home_dr"]),
                        "bf_home_cr": d(r["bf_home_cr"]),
                        "bf_home_balance": d(r["bf_home_balance"]),
                        "period_home_dr": d(r["period_home_dr"]),
                        "period_home_cr": d(r["period_home_cr"]),
                        "period_home_net": d(r["period_home_net"]),
                        "closing_balance": d(r["closing_balance"]),
                    }
                monthly[k][label] = d(r["closing_balance"])
            # Fill forward: carry last known balance for accounts with no activity this month
            for k in acc_meta:
                if label not in monthly[k]:
                    last_val = Decimal(0)
                    for pl in reversed(month_labels[:month_labels.index(label)]):
                        if pl in monthly[k]:
                            last_val = monthly[k][pl]
                            break
                    monthly[k][label] = last_val

        rows_out = []
        for k, meta in acc_meta.items():
            rows_out.append(BsRow(
                **{f: meta[f] for f in [
                    "acc_no", "acc_desc", "parent_acc_no", "acc_type",
                    "ob_home_dr", "ob_home_cr", "ob_home_balance",
                    "bf_home_dr", "bf_home_cr", "bf_home_balance",
                    "period_home_dr", "period_home_cr", "period_home_net", "closing_balance"
                ]},
                monthly=monthly[k]
            ))

        return BsResponse(from_date=fd, to_date=td, month_labels=month_labels, rows=rows_out)