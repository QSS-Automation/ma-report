"""P&L service: GL actuals + MFRS injection merged into PnlResponse."""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.database import run
from app.models.schemas import PnlResponse, PnlRow

_SEC = {
    1:{"label":"Sales",              "section":"SALES",             "tag":"rev"},
    2:{"label":"Return Inwards",     "section":"RETURN INWARDS",    "tag":"ri"},
    3:{"label":"Cost of Goods Sold", "section":"COST OF GOODS SOLD","tag":"cos"},
    4:{"label":"Other Income",       "section":"OTHER INCOME",      "tag":"oi"},
    5:{"label":"Operating Expenses", "section":"OPERATING EXPENSES","tag":"ep"},
    6:{"label":"Taxation",           "section":"TAXATION",          "tag":"tx"},
}

def _months(fd, td):
    c=[]; y,m=fd.year,fd.month
    while True:
        c.append(date(y,m,1))
        if (y,m)==(td.year,td.month): break
        m+=1
        if m>12: m,y=1,y+1
    return c

class PnlService:
    def get_pnl(self, db: Session, fd: date, td: date, entity: str = "QM") -> PnlResponse:
        cols=_months(fd,td); n=len(cols); D=Decimal
        gl=run(db,f"""
            SELECT acc_no,acc_desc,acc_type,sort_group,section,
                YEAR(trans_date) yr,MONTH(trans_date) mo,
                SUM(CASE acc_type
                    WHEN 'SL' THEN home_cr-home_dr WHEN 'SA' THEN home_dr-home_cr
                    WHEN 'CO' THEN home_dr-home_cr WHEN 'OI' THEN home_cr-home_dr
                    WHEN 'EP' THEN home_dr-home_cr WHEN 'TX' THEN home_dr-home_cr
                    ELSE home_dr-home_cr END) net_amount
            FROM staging_{entity}.RR_gl_lines
            WHERE is_pnl_account=1 AND trans_date BETWEEN :fd AND :td
            GROUP BY acc_no,acc_desc,acc_type,sort_group,section,
                YEAR(trans_date),MONTH(trans_date)
            ORDER BY sort_group,acc_no
        """,{"fd":fd,"td":td})
        years=sorted({c.year for c in cols})
        ys=",".join(str(y) for y in years)
        mfrs_raw=run(db,f"""
            SELECT gl_dtl_key,journal_type,recognised_year,
                m01,m02,m03,m04,m05,m06,m07,m08,m09,m10,m11,m12
            FROM staging_{entity}.RR_mfrs WHERE recognised_year IN ({ys})
        """,{})
        mk_y={y:[f"m{c.month:02d}" for c in cols if c.year==y] for y in years}
        def sum_mfrs(jt):
            tot=[D(0)]*n
            for r in mfrs_raw:
                if r["journal_type"]!=jt: continue
                amks=mk_y.get(r["recognised_year"],[])
                for i,c in enumerate(cols):
                    mk=f"m{c.month:02d}"
                    if mk in amks and r.get(mk) is not None:
                        tot[i]+=D(str(r[mk]))
            return tot
        ms=sum_mfrs("SALES"); mc=sum_mfrs("PURCHASE")
        sa={}
        for r in gl:
            sg,an=r["sort_group"],r["acc_no"]
            sa.setdefault(sg,{}).setdefault(an,{"label":r["acc_desc"],"months":{}})
            sa[sg][an]["months"][(r["yr"],r["mo"])]=sa[sg][an]["months"].get((r["yr"],r["mo"]),D(0))+D(str(r["net_amount"] or 0))
        result=[]; st={}
        for sg,meta in sorted(_SEC.items()):
            ad=sa.get(sg,{}); sec=[D(0)]*n; dets=[]
            for an,a in sorted(ad.items()):
                am=[]
                for ci,c in enumerate(cols):
                    v=a["months"].get((c.year,c.month),D(0)); sec[ci]+=v; am.append(v)
                dets.append(PnlRow(row_type="detail",section=meta["section"],sort_order=sg*10+2,
                    acc_no=an,label=a["label"],tag=meta["tag"],months=am,total=sum(am,D(0))))
            if sg==1 and any(v for v in ms):
                for i,v in enumerate(ms): sec[i]+=v
                dets.append(PnlRow(row_type="mfrs",section=meta["section"],sort_order=sg*10+3,
                    label="MFRS recognised — Sales",tag="mfrs",months=list(ms),total=sum(ms,D(0))))
            elif sg==3 and any(v for v in mc):
                for i,v in enumerate(mc): sec[i]+=v
                dets.append(PnlRow(row_type="mfrs",section=meta["section"],sort_order=sg*10+3,
                    label="MFRS recognised — Purchases",tag="mfrs",months=list(mc),total=sum(mc,D(0))))
            st[sg]=sec
            result.append(PnlRow(row_type="subtotal",section=meta["section"],sort_order=sg*10+1,
                label=meta["label"],tag=meta["tag"],months=list(sec),total=sum(sec,D(0))))
            result.extend(dets)
        def g(sg): return st.get(sg,[D(0)]*n)
        ns=[g(1)[i]-g(2)[i] for i in range(n)]
        gp=[ns[i]-g(3)[i]   for i in range(n)]
        pbt=[gp[i]+g(4)[i]-g(5)[i] for i in range(n)]
        pat=[pbt[i]-g(6)[i] for i in range(n)]
        result+=[
            PnlRow(row_type="net_sales",section="NET_SALES",sort_order=25,label="Net Sales",months=ns,total=sum(ns,D(0))),
            PnlRow(row_type="summary",section="GROSS_PROFIT",sort_order=35,label="Gross Profit / (Loss)",months=gp,total=sum(gp,D(0))),
            PnlRow(row_type="summary",section="NET_PROFIT_BEFORE",sort_order=56,label="Net Profit Before Tax",months=pbt,total=sum(pbt,D(0))),
            PnlRow(row_type="summary",section="NET_PROFIT_AFTER",sort_order=66,label="Net Profit After Tax",months=pat,total=sum(pat,D(0))),
        ]
        result.sort(key=lambda r:r.sort_order)
        MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        return PnlResponse(from_date=fd,to_date=td,
            month_labels=[MN[c.month-1]+"-"+str(c.year)[2:] for c in cols],rows=result)