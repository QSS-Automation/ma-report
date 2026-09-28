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
        # FIX: previously this summed EVERY P&L account's raw GL amount,
        # including invoices whose revenue is meant to be DEFERRED and
        # recognised monthly via MFRS instead (a fact_split row with
        # start_date/end_date set — see MfrsService, which uses that exact
        # condition to decide what's MFRS-eligible). Those invoices' full
        # amount was being counted here (under their own account, e.g.
        # "Sales - IT Provider") AND AGAIN as part of the separate lump
        # "MFRS {year} — Sales" row added further down — double-counting
        # the same revenue twice. Accounts with no MFRS-managed splits
        # (e.g. "Business support") were unaffected, which is exactly why
        # only some accounts showed the duplication and others didn't.
        # The NOT EXISTS clause below excludes exactly the transactions
        # that ARE MFRS-managed, so they're represented ONLY by the MFRS
        # injection (spread across the correct recognition months),
        # never by their raw invoice-date amount too.
        gl=run(db,f"""
            SELECT acc_no,acc_desc,acc_type,sort_group,section,
                YEAR(trans_date) yr,MONTH(trans_date) mo,
                SUM(CASE acc_type
                    WHEN 'SL' THEN home_cr-home_dr WHEN 'SA' THEN home_dr-home_cr
                    WHEN 'CO' THEN home_dr-home_cr WHEN 'OI' THEN home_cr-home_dr
                    WHEN 'EP' THEN home_dr-home_cr WHEN 'TX' THEN home_dr-home_cr
                    ELSE home_dr-home_cr END) net_amount
            FROM staging_rr_{entity}.RR_gl_lines gl
            WHERE is_pnl_account=1 AND trans_date BETWEEN :fd AND :td
              AND NOT EXISTS (
                  SELECT 1 FROM curated_acc_{entity}.fact_split fs
                  WHERE fs.gl_dtl_key = gl.source_key
                    AND fs.is_manual_line = 0
                    AND fs.start_date IS NOT NULL
                    AND fs.end_date IS NOT NULL
              )
            GROUP BY acc_no,acc_desc,acc_type,sort_group,section,
                YEAR(trans_date),MONTH(trans_date)
            ORDER BY sort_group,acc_no
        """,{"fd":fd,"td":td})
        years=sorted({c.year for c in cols})
        ys=",".join(str(y) for y in years)
        mfrs_raw=run(db,f"""
            SELECT gl_dtl_key,split_index,journal_type,recognised_year,trans_date,acc_no,
                m01,m02,m03,m04,m05,m06,m07,m08,m09,m10,m11,m12
            FROM staging_rr_{entity}.RR_mfrs WHERE recognised_year IN ({ys})
        """,{})
        mk_y={y:[f"m{c.month:02d}" for c in cols if c.year==y] for y in years}

        # Account descriptions for MFRS child rows — looked up unfiltered
        # (not from `gl` above, which excludes MFRS-managed transactions
        # by design) so an account that's ENTIRELY deferred still gets a
        # real description instead of falling back to its raw acc_no.
        acc_desc_rows=run(db,f"""
            SELECT DISTINCT acc_no, acc_desc
            FROM staging_rr_{entity}.RR_gl_lines
            WHERE acc_no IS NOT NULL
        """,{})
        acc_desc_by_no={r["acc_no"]:r["acc_desc"] for r in acc_desc_rows}

        # Grouped by the INVOICE's own trans_date year — not recognised_year
        # and not the recognition schedule's start_date. E.g. a 2025
        # invoice whose revenue is recognized Nov 2025 - Feb 2026 shows
        # entirely under "MFRS 2025 — Sales/Purchases" (all months
        # included), because the INVOICE itself is dated 2025 regardless
        # of which calendar years its recognition schedule spans.
        #
        # ALSO now broken down per account (acc_no), attached as `children`
        # on each year's summary row — lets the frontend show a dropdown/
        # expand under "MFRS {year} — Sales" revealing which accounts
        # actually make up that lump sum, instead of just one flat number.
        def mfrs_rows_for(jt, section, sort_order, label_prefix):
            by_year_acc={}
            for r in mfrs_raw:
                if r["journal_type"]!=jt: continue
                yr=r["trans_date"].year if r.get("trans_date") else r["recognised_year"]
                acc_no=r.get("acc_no")
                key=(yr,acc_no)
                if key not in by_year_acc:
                    by_year_acc[key]=[D(0)]*n
                amks=mk_y.get(r["recognised_year"],[])
                for i,c in enumerate(cols):
                    mk=f"m{c.month:02d}"
                    if mk in amks and r.get(mk) is not None:
                        by_year_acc[key][i]+=D(str(r[mk]))

            by_year={}
            for (yr,acc_no),vals in by_year_acc.items():
                by_year.setdefault(yr,[]).append((acc_no,vals))

            rows=[]
            for yr in sorted(by_year.keys(),reverse=True):
                yr_total=[D(0)]*n
                children=[]
                for acc_no,vals in sorted(by_year[yr], key=lambda x:(x[0] or "")):
                    for i in range(n): yr_total[i]+=vals[i]
                    if not any(vals): continue
                    children.append(PnlRow(row_type="detail",section=section,sort_order=sort_order,
                        acc_no=acc_no, label=acc_desc_by_no.get(acc_no, acc_no or "(unspecified account)"),
                        tag="mfrs", months=vals, total=sum(vals,D(0))))
                if any(yr_total):
                    rows.append(PnlRow(row_type="mfrs",section=section,sort_order=sort_order,
                        label=f"{label_prefix} {yr}",tag="mfrs",
                        months=list(yr_total),total=sum(yr_total,D(0)),
                        children=children))
            return rows

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

            if sg==1:
                for mfrs_row in mfrs_rows_for("SALES", meta["section"], sg*10+3, "MFRS \u2014 Sales"):
                    for i in range(n): sec[i]+=mfrs_row.months[i]
                    dets.append(mfrs_row)
            elif sg==3:
                for mfrs_row in mfrs_rows_for("PURCHASE", meta["section"], sg*10+3, "MFRS \u2014 Purchases"):
                    for i in range(n): sec[i]+=mfrs_row.months[i]
                    dets.append(mfrs_row)

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
