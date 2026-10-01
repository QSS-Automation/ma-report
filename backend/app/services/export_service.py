"""Excel export service — generates multi-sheet MA report workbook."""
from datetime import date, timedelta
from io import BytesIO
from decimal import Decimal
from calendar import monthrange
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session
from app.db.database import run

# ── Colours ────────────────────────────────────────────────────────────────
BLUE_HDR  = "FF185FA5"
GREY_HDR  = "FFF5F4F0"
SUBTOTAL  = "FFEFF6FF"
MFRS_FILL = "FFFDF6E3"
WHITE     = "FFFFFFFF"
BLACK     = "FF000000"
DARK_GREY = "FF5F5E5A"

# ── Number formats ─────────────────────────────────────────────────────────
FMT_NUM  = '#,##0.00;[Red](#,##0.00);"-"'
FMT_DATE = 'DD-MMM-YY'
FMT_MON  = 'MMM-YY'

def _cell(ws, row, col, value, bold=False, size=10, color=BLACK,
          fill=None, align="left", num_format=None, italic=False):
    c = ws.cell(row=row, column=col, value=value)
    c.font = Font(name="Arial", bold=bold, size=size, color=color, italic=italic)
    c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=False)
    if fill:
        c.fill = PatternFill("solid", fgColor=fill)
    if num_format:
        c.number_format = num_format
    return c

def _border_bottom(ws, row, max_col, style="thin"):
    side = Side(style=style, color="FF000000")
    for col in range(1, max_col + 1):
        c = ws.cell(row=row, column=col)
        c.border = Border(bottom=side)

def _months_range(fd, td):
    c = []; y, m = fd.year, fd.month
    while True:
        c.append(date(y, m, 1))
        if (y, m) == (td.year, td.month): break
        m += 1
        if m > 12: m, y = 1, y + 1
    return c

def _days_overlap(start, end, mo_start, mo_end):
    """Days of [start,end] that fall within [mo_start,mo_end]."""
    if not start or not end: return 0
    overlap_start = max(start, mo_start)
    overlap_end   = min(end, mo_end)
    if overlap_start > overlap_end: return 0
    return (overlap_end - overlap_start).days + 1

def _spread_amount(amount, start, end, months):
    """Spread amount proportionally across months list based on days overlap.
    Months outside [start,end] simply get None — this is what naturally
    limits a recognised amount to only the months actually being reported,
    even when the invoice's own trans_date sits outside the report period."""
    if not start or not end or not amount:
        return [None] * len(months)
    total_days = (end - start).days + 1
    if total_days <= 0:
        return [None] * len(months)
    result = []
    for mo in months:
        mo_end = date(mo.year, mo.month, monthrange(mo.year, mo.month)[1])
        days = _days_overlap(start, end, mo, mo_end)
        if days > 0:
            result.append(round(float(amount) * days / total_days, 2))
        else:
            result.append(None)
    return result

# ── PL Sheet ───────────────────────────────────────────────────────────────
def _build_pl(wb, db, entity, fd, td):
    ws = wb.create_sheet("PL")
    cols = _months_range(fd, td)
    n = len(cols)
    D = Decimal

    # FIX: previously summed EVERY P&L account's raw GL amount, including
    # invoices whose revenue is meant to be DEFERRED and recognised
    # monthly via MFRS instead (a fact_split row with start_date/end_date
    # set). Those invoices' full amount was counted here under their own
    # account AND AGAIN as part of the separate "MFRS {year}" line below —
    # double-counting the same revenue. Excluded here; represented ONLY
    # by the MFRS section further down. Matches the fix already applied
    # in app/services/pnl_service.py.
    gl = run(db, f"""
        SELECT acc_no, acc_desc, acc_type, sort_group, section,
            YEAR(trans_date) yr, MONTH(trans_date) mo,
            SUM(CASE acc_type
                WHEN 'SL' THEN home_cr-home_dr WHEN 'SA' THEN home_dr-home_cr
                WHEN 'CO' THEN home_dr-home_cr WHEN 'OI' THEN home_cr-home_dr
                WHEN 'EP' THEN home_dr-home_cr WHEN 'TX' THEN home_dr-home_cr
                ELSE home_dr-home_cr END) net_amount
        FROM staging_rr_{entity}.RR_gl_lines gl
        WHERE is_pnl_account=1 AND trans_date BETWEEN '{fd}' AND '{td}'
          AND NOT EXISTS (
              SELECT 1 FROM curated_acc_{entity}.fact_split fs
              WHERE fs.gl_dtl_key = gl.source_key
                AND fs.is_manual_line = 0
                AND fs.start_date IS NOT NULL
                AND fs.end_date IS NOT NULL
          )
        GROUP BY acc_no,acc_desc,acc_type,sort_group,section,YEAR(trans_date),MONTH(trans_date)
        ORDER BY sort_group,acc_no
    """, {})

    years = sorted({c.year for c in cols})
    ys = ",".join(str(y) for y in years)

    # Added acc_no + trans_date — needed for per-account breakdown and
    # invoice-year grouping (see mfrs_rows_for below).
    mfrs_raw = run(db, f"""
        SELECT gl_dtl_key, split_index, journal_type, recognised_year, trans_date, acc_no,
            m01,m02,m03,m04,m05,m06,m07,m08,m09,m10,m11,m12
        FROM staging_rr_{entity}.RR_mfrs WHERE recognised_year IN ({ys})
    """, {})

    # Unfiltered account-description lookup, purely for labeling MFRS
    # children — an account that's ENTIRELY deferred never appears in the
    # (deliberately filtered) `gl` query above, so its description must
    # be looked up separately or it'd fall back to showing a raw acc_no.
    acc_desc_rows = run(db, f"""
        SELECT DISTINCT acc_no, acc_desc
        FROM staging_rr_{entity}.RR_gl_lines
        WHERE acc_no IS NOT NULL
    """, {})
    acc_desc_by_no = {r["acc_no"]: r["acc_desc"] for r in acc_desc_rows}

    mk_y = {y: [f"m{c.month:02d}" for c in cols if c.year == y] for y in years}

    # Grouped by the INVOICE's own trans_date year (not recognised_year) —
    # e.g. a 2025 invoice recognised Nov 2025 - Feb 2026 shows entirely
    # under "MFRS 2025", all months included, since the invoice itself is
    # dated 2025. Also broken down per account (acc_no) as `children`,
    # rendered as a collapsible Excel row group below each year's total.
    def mfrs_rows_for(jt):
        by_year_acc = {}
        for r in mfrs_raw:
            if r["journal_type"] != jt: continue
            yr = r["trans_date"].year if r.get("trans_date") else r["recognised_year"]
            acc_no = r.get("acc_no")
            key = (yr, acc_no)
            if key not in by_year_acc:
                by_year_acc[key] = [D(0)] * n
            amks = mk_y.get(r["recognised_year"], [])
            for i, c in enumerate(cols):
                mk = f"m{c.month:02d}"
                if mk in amks and r.get(mk) is not None:
                    by_year_acc[key][i] += D(str(r[mk]))

        by_year = {}
        for (yr, acc_no), vals in by_year_acc.items():
            by_year.setdefault(yr, []).append((acc_no, vals))

        out = []
        for yr in sorted(by_year.keys(), reverse=True):
            yr_total = [D(0)] * n
            children = []
            for acc_no, vals in sorted(by_year[yr], key=lambda x: (x[0] or "")):
                for i in range(n): yr_total[i] += vals[i]
                if not any(vals): continue
                children.append((acc_desc_by_no.get(acc_no, acc_no or "(unspecified account)"), vals))
            if any(yr_total):
                out.append({"year": yr, "total": yr_total, "children": children})
        return out

    ms_rows = mfrs_rows_for("SALES")
    mc_rows = mfrs_rows_for("PURCHASE")

    DATA_COL = 3
    YTD_COL  = DATA_COL + n
    CUR_COL  = YTD_COL + 1

    _cell(ws, 1, 1, f"Quandatics {entity}", bold=True, size=12)
    _cell(ws, 2, 1, "Statement of Profit or Loss", bold=True, size=11)
    _cell(ws, 3, 1, f"For the period ended {td.strftime('%d %B %Y')}", bold=True, size=10)

    MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    for i, mo in enumerate(cols):
        _cell(ws, 5, DATA_COL + i, f"{MN[mo.month-1]}-{str(mo.year)[2:]}",
              bold=True, align="center", fill=GREY_HDR)
    _cell(ws, 5, YTD_COL, "YTD", bold=True, align="center", fill=GREY_HDR)
    _cell(ws, 5, CUR_COL, f"As of {cols[0].strftime('%m.%Y')}", bold=True, align="center", fill=GREY_HDR)
    for i in range(n + 2):
        _cell(ws, 6, DATA_COL + i, "RM", bold=True, align="center",
              fill=GREY_HDR, color=DARK_GREY, size=9)

    SEC = {
        1: "Sales", 2: "Return Inwards", 3: "Cost of Sales",
        4: "Other Income", 5: "Operating Expenses", 6: "Taxation"
    }
    from collections import defaultdict
    data = defaultdict(lambda: defaultdict(D))
    meta = {}
    for r in gl:
        key = (r["sort_group"], r["acc_no"])
        data[key][(r["yr"], r["mo"])] += D(str(r["net_amount"] or 0))
        meta[key] = {"label": r["acc_desc"], "sort_group": r["sort_group"]}

    row = 8
    st = {}
    # Enable row outlining/grouping (the Excel "+ / -" collapsible groups)
    # so each MFRS year's per-account breakdown can expand/collapse,
    # while the year's own total row stays always visible above them.
    ws.sheet_properties.outlinePr.summaryBelow = False
    ws.sheet_properties.outlinePr.applyStyles = True

    for sg in range(1, 7):
        sec_label = SEC.get(sg, "")
        sec_keys = sorted([k for k in meta if k[0] == sg])
        if not sec_keys and sg not in (1, 3):
            continue

        sec_totals = [D(0)] * n
        dets = []  # list of (label, m_vals, is_mfrs, children)

        for key in sec_keys:
            m_vals = [data[key].get((mo.year, mo.month), D(0)) for mo in cols]
            for i, v in enumerate(m_vals): sec_totals[i] += v
            dets.append((meta[key]["label"], m_vals, False, None))

        mfrs_group = ms_rows if sg == 1 else (mc_rows if sg == 3 else [])
        mfrs_label_prefix = "MFRS \u2014 Sales" if sg == 1 else "MFRS \u2014 Purchases"
        for grp in mfrs_group:
            for i, v in enumerate(grp["total"]): sec_totals[i] += v
            dets.append((f"{mfrs_label_prefix} {grp['year']}", grp["total"], True, grp["children"]))

        _cell(ws, row, 1, sec_label, bold=True, fill=GREY_HDR)
        _border_bottom(ws, row, CUR_COL, style="medium")
        row += 1

        for label, m_vals, is_mfrs, children in dets:
            fill = MFRS_FILL if is_mfrs else None
            _cell(ws, row, 1, label, size=10, bold=is_mfrs, fill=fill)
            ytd = sum(m_vals, D(0))
            for i, v in enumerate(m_vals):
                _cell(ws, row, DATA_COL + i, float(v), align="right", num_format=FMT_NUM, size=10, fill=fill)
            _cell(ws, row, YTD_COL, float(ytd), align="right", num_format=FMT_NUM, size=10, fill=fill)
            _cell(ws, row, CUR_COL, float(m_vals[0]) if m_vals else 0, align="right", num_format=FMT_NUM, size=10, fill=fill)
            row += 1

            if is_mfrs and children:
                for child_label, child_vals in children:
                    child_ytd = sum(child_vals, D(0))
                    _cell(ws, row, 1, f"    {child_label}", size=9, color=DARK_GREY, italic=True)
                    for i, v in enumerate(child_vals):
                        _cell(ws, row, DATA_COL + i, float(v), align="right", num_format=FMT_NUM, size=9, color=DARK_GREY)
                    _cell(ws, row, YTD_COL, float(child_ytd), align="right", num_format=FMT_NUM, size=9, color=DARK_GREY)
                    _cell(ws, row, CUR_COL, float(child_vals[0]) if child_vals else 0, align="right", num_format=FMT_NUM, size=9, color=DARK_GREY)
                    # Collapsible under the MFRS year row above it —
                    # collapsed by default (hidden=True); user clicks the
                    # "+" in Excel's row-group margin to reveal.
                    ws.row_dimensions[row].outlineLevel = 1
                    ws.row_dimensions[row].hidden = True
                    row += 1

        ytd_sec = sum(sec_totals, D(0))
        _cell(ws, row, 1, f"Total {sec_label}", bold=True, fill=SUBTOTAL)
        for i, v in enumerate(sec_totals):
            _cell(ws, row, DATA_COL + i, float(v), bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)
        _cell(ws, row, YTD_COL, float(ytd_sec), bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)
        _cell(ws, row, CUR_COL, float(sec_totals[0]) if sec_totals else 0, bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)
        _border_bottom(ws, row, CUR_COL, style="medium")
        st[sg] = sec_totals
        row += 2

        if sg == 3:
            s1 = st.get(1, [D(0)] * n)
            s2 = st.get(2, [D(0)] * n)
            s3 = st.get(3, [D(0)] * n)
            gp = [s1[i] - s2[i] - s3[i] for i in range(n)]
            _cell(ws, row, 1, "Gross Profit / (Loss)", bold=True, size=11)
            for i, v in enumerate(gp):
                _cell(ws, row, DATA_COL + i, float(v), bold=True, align="right", num_format=FMT_NUM, size=11)
            _cell(ws, row, YTD_COL, float(sum(gp, D(0))), bold=True, align="right", num_format=FMT_NUM, size=11)
            _cell(ws, row, CUR_COL, float(gp[0]) if gp else 0, bold=True, align="right", num_format=FMT_NUM, size=11)
            _border_bottom(ws, row, CUR_COL, style="double")
            row += 2

    s1 = st.get(1, [D(0)] * n); s2 = st.get(2, [D(0)] * n)
    s3 = st.get(3, [D(0)] * n); s4 = st.get(4, [D(0)] * n)
    s5 = st.get(5, [D(0)] * n); s6 = st.get(6, [D(0)] * n)
    gp  = [s1[i] - s2[i] - s3[i] for i in range(n)]
    pbt = [gp[i] + s4[i] - s5[i] for i in range(n)]
    pat = [pbt[i] - s6[i] for i in range(n)]

    for label, vals in [("Net Profit Before Tax", pbt), ("Net Profit After Tax", pat)]:
        _cell(ws, row, 1, label, bold=True, size=11)
        for i, v in enumerate(vals):
            _cell(ws, row, DATA_COL + i, float(v), bold=True, align="right", num_format=FMT_NUM, size=11)
        _cell(ws, row, YTD_COL, float(sum(vals, D(0))), bold=True, align="right", num_format=FMT_NUM, size=11)
        _cell(ws, row, CUR_COL, float(vals[0]) if vals else 0, bold=True, align="right", num_format=FMT_NUM, size=11)
        _border_bottom(ws, row, CUR_COL, style="double")
        row += 2

    ws.column_dimensions['A'].width = 38
    ws.column_dimensions['B'].width = 12
    for i in range(n + 2):
        ws.column_dimensions[get_column_letter(DATA_COL + i)].width = 16
    ws.freeze_panes = "C8"
    ws.sheet_view.showGridLines = False

# ── BS Sheet ───────────────────────────────────────────────────────────────
def _build_bs(wb, db, entity, fd, td):
    ws = wb.create_sheet("BS")
    rows_raw = run(db, f"""
        SELECT acc_no, acc_desc, acc_type,
            SUM(home_dr - home_cr) net_balance
        FROM staging_rr_{entity}.RR_gl_lines
        WHERE is_bs_account=1 AND trans_date BETWEEN '{fd}' AND '{td}'
        GROUP BY acc_no, acc_desc, acc_type
        ORDER BY acc_no
    """, {})

    _cell(ws, 1, 1, f"Quandatics {entity}", bold=True, size=12)
    _cell(ws, 2, 1, "Statement of Financial Position", bold=True, size=11)
    _cell(ws, 3, 1, f"As at {td.strftime('%d %B %Y')}", bold=True, size=10)
    _cell(ws, 5, 3, "YTD", bold=True, align="center", fill=GREY_HDR)
    _cell(ws, 6, 3, "RM",  bold=True, align="center", fill=GREY_HDR, color=DARK_GREY, size=9)

    row = 8
    for r in rows_raw:
        bal = float(Decimal(str(r["net_balance"] or 0)))
        _cell(ws, row, 1, r["acc_desc"], size=10)
        _cell(ws, row, 2, r["acc_no"], size=9, color=DARK_GREY)
        _cell(ws, row, 3, bal, align="right", num_format=FMT_NUM, size=10)
        row += 1

    ws.column_dimensions['A'].width = 42
    ws.column_dimensions['B'].width = 14
    ws.column_dimensions['C'].width = 18
    ws.sheet_view.showGridLines = False

# ── Sales / Purchases Sheet ─────────────────────────────────────────────────
def _build_adj(wb, db, entity, fd, td, jt, sheet_name):
    ws = wb.create_sheet(sheet_name)
    is_sales = jt == "SALES"
    cols = _months_range(fd, td)
    n = len(cols)
    MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    # FIX: previously only fetched invoices whose OWN trans_date fell
    # within the selected period — so an invoice dated, say, June 2025
    # would never appear when reporting Jan-Dec 2026, even if that
    # invoice's MFRS recognition schedule spreads INTO 2026. Added an
    # OR EXISTS clause: an invoice is now also included if it has a
    # LOCKED split whose recognition date range overlaps the selected
    # period at all — regardless of the invoice's own trans_date.
    # _spread_amount() below already only ever populates values for
    # months actually in `cols` (the selected period), so an out-of-
    # period invoice pulled in this way will correctly show blanks for
    # any of its recognised months that fall outside the report period,
    # and real numbers only for the months that overlap it.
    inv_raw = run(db, f"""
        SELECT * FROM (
            SELECT gl.source, gl.source_key, gl.trans_date,
                gl.acc_no, gl.de_acc_no, gl.acc_desc,
                gl.proj_no, gl.ref_no1, gl.ref_no2,
                gl.description, gl.home_dr, gl.home_cr,
                CASE WHEN '{jt}' = 'SALES'
                     THEN -(gl.home_dr - gl.home_cr)
                     ELSE (gl.home_dr - gl.home_cr) END AS amount
            FROM staging_rr_{entity}.RR_gl_lines gl
            WHERE gl.journal_type = '{jt}'
              AND (
                  gl.trans_date BETWEEN '{fd}' AND '{td}'
                  OR EXISTS (
                      SELECT 1 FROM curated_acc_{entity}.fact_split fs2
                      WHERE fs2.gl_dtl_key = gl.source_key
                        AND fs2.is_locked = 1
                        AND fs2.start_date IS NOT NULL AND fs2.end_date IS NOT NULL
                        AND fs2.start_date <= '{td}' AND fs2.end_date >= '{fd}'
                  )
              )
              AND (
                  ('{jt}' = 'SALES' AND (
                      gl.acc_type = 'SA'
                      OR (gl.acc_type = 'SL' AND gl.acc_no = '500-0000')
                  ))
                  OR
                  ('{jt}' = 'PURCHASE' AND (
                      (gl.acc_type = 'CO' AND gl.acc_no NOT LIKE '617-%')
                      OR ('{entity}' = 'QA' AND gl.journal_type = 'BANK' AND gl.acc_no = '616-0000')
                  ))
              )
            UNION ALL
            SELECT 'adj_line', fa.adj_key, fa.trans_date,
                fa.acc_no, fa.de_acc_no, fa.acc_desc,
                fa.proj_no, fa.ref_no1, fa.ref_no2,
                fa.description, fa.home_dr, fa.home_cr,
                CASE WHEN '{jt}' = 'SALES'
                     THEN -(fa.home_dr - fa.home_cr)
                     ELSE (fa.home_dr - fa.home_cr) END AS amount
            FROM curated_acc_{entity}.fact_adj_line fa
            WHERE fa.journal_type = '{jt}'
              AND (
                  fa.trans_date BETWEEN '{fd}' AND '{td}'
                  OR EXISTS (
                      SELECT 1 FROM curated_acc_{entity}.fact_split fs3
                      WHERE fs3.gl_dtl_key = fa.adj_key
                        AND fs3.is_locked = 1
                        AND fs3.start_date IS NOT NULL AND fs3.end_date IS NOT NULL
                        AND fs3.start_date <= '{td}' AND fs3.end_date >= '{fd}'
                  )
              )
        ) combined
        ORDER BY trans_date DESC, ref_no1
    """, {})

    # Fetch all splits for these invoices
    is_manual_map = {inv["source_key"]: (inv["source"] == "adj_line") for inv in inv_raw}
    all_keys = list(is_manual_map.keys())

    splits_map = {}
    if all_keys:
        keys_str = ",".join(str(k) for k in all_keys)
        splits_raw = run(db, f"""
            SELECT gl_dtl_key, category, end_user, start_date, end_date,
                total_days, net_amount, is_locked, remark, is_manual_line
            FROM curated_acc_{entity}.fact_split
            WHERE gl_dtl_key IN ({keys_str})
            ORDER BY gl_dtl_key, split_id
        """, {})
        for s in splits_raw:
            splits_map.setdefault(s["gl_dtl_key"], []).append(s)

    # Column layout:
    # Sales:     A=Date B=DE Acc C=Proj D=Ref1 E=Desc F=HomeDR G=HomeCR H=Amount
    #            I=Type J=EndUser K=StartDate L=EndDate M=Days
    #            N..N+n-1=months  N+n=Total  N+n+1=Variance  N+n+2=Remarks
    # Purchases: same but add E2=Ref2, shift all by 1

    if is_sales:
        base_cols = ["Date","DE Acc. Desc.","Project Code","Ref. 1","Desc.",
                     "Home DR","Home CR","Amount","Type","End User",
                     "Start Date","End Date","Total Days"]
    else:
        base_cols = ["Date","DE Acc. Desc.","Project Code","Ref. 1","Ref. 2","Desc.",
                     "Home DR","Home CR","Amount","Type","End User",
                     "Start Date","End Date","Total Days"]

    n_base = len(base_cols)
    MONTH_START = n_base + 1           # 1-based col where months start
    TOTAL_COL   = MONTH_START + n      # Total column
    VAR_COL     = TOTAL_COL + 1        # Variance
    REMARK_COL  = VAR_COL + 1          # Remarks
    N_COLS      = REMARK_COL

    # Row 3: subtotals
    dr_col  = base_cols.index("Home DR") + 1
    cr_col  = base_cols.index("Home CR") + 1
    amt_col = base_cols.index("Amount") + 1 if is_sales else base_cols.index("Amount") + 1

    for sc in [dr_col, cr_col, amt_col]:
        cl = get_column_letter(sc)
        _cell(ws, 3, sc, f"=SUBTOTAL(9,{cl}5:{cl}1048576)",
              bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)

    for i in range(n):
        mc = MONTH_START + i
        cl = get_column_letter(mc)
        _cell(ws, 3, mc, f"=SUBTOTAL(9,{cl}5:{cl}1048576)",
              bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)

    _cell(ws, 3, TOTAL_COL, f"=SUBTOTAL(9,{get_column_letter(TOTAL_COL)}5:{get_column_letter(TOTAL_COL)}1048576)",
          bold=True, align="right", num_format=FMT_NUM, fill=SUBTOTAL)

    # Row 4: headers
    for i, h in enumerate(base_cols):
        _cell(ws, 4, i + 1, h, bold=True, fill=BLUE_HDR, color=WHITE, align="center", size=9)
    for i, mo in enumerate(cols):
        _cell(ws, 4, MONTH_START + i, f"{MN[mo.month-1]}-{str(mo.year)[2:]}",
              bold=True, fill=BLUE_HDR, color=WHITE, align="center", size=9)
    _cell(ws, 4, TOTAL_COL,  "Total",    bold=True, fill=BLUE_HDR, color=WHITE, align="center", size=9)
    _cell(ws, 4, VAR_COL,    "Variance", bold=True, fill=BLUE_HDR, color=WHITE, align="center", size=9)
    _cell(ws, 4, REMARK_COL, "Remarks",  bold=True, fill=BLUE_HDR, color=WHITE, align="center", size=9)

    # Data rows
    data_row = 5
    for inv in inv_raw:
        sk = inv["source_key"]
        splits = splits_map.get(sk, [])
        dr  = float(Decimal(str(inv["home_dr"] or 0)))
        cr  = float(Decimal(str(inv["home_cr"] or 0)))
        amt = float(Decimal(str(inv["amount"] or 0)))

        # Determine if locked — use split data for MFRS spread
        if splits and splits[0]["is_locked"]:
            # Locked — spread amount across months using start/end date.
            # Months outside the selected period naturally get None from
            # _spread_amount, since `cols` only contains the report's own
            # months — this is exactly what lets an out-of-period invoice
            # (pulled in by the widened filter above) show only its
            # in-period recognised slice, not its full original amount.
            for sp in splits:
                start = sp["start_date"]
                end   = sp["end_date"]
                sp_amt = float(Decimal(str(sp["net_amount"] or 0)))
                mo_vals = _spread_amount(sp_amt, start, end, cols)

                row_fill = "FFF9F9F9" if data_row % 2 == 0 else None
                if is_sales:
                    vals = [inv["trans_date"], inv["acc_desc"] or "", inv["proj_no"] or "",
                            inv["ref_no1"] or "", inv["description"] or "",
                            dr, cr, amt,
                            sp["category"] or "", sp["end_user"] or "",
                            start, end, sp["total_days"] or ""]
                else:
                    vals = [inv["trans_date"], inv["acc_desc"] or "", inv["proj_no"] or "",
                            inv["ref_no1"] or "", inv["ref_no2"] or "",
                            inv["description"] or "",
                            dr, cr, amt,
                            sp["category"] or "", sp["end_user"] or "",
                            start, end, sp["total_days"] or ""]

                for i, v in enumerate(vals):
                    col_name = base_cols[i]
                    if col_name in ("Home DR","Home CR","Amount"):
                        _cell(ws, data_row, i+1, v, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
                    elif col_name in ("Date","Start Date","End Date"):
                        _cell(ws, data_row, i+1, v, size=9, num_format=FMT_DATE, fill=row_fill)
                    else:
                        _cell(ws, data_row, i+1, v, size=9, fill=row_fill)

                total_recognised = 0
                for i, v in enumerate(mo_vals):
                    if v is not None:
                        _cell(ws, data_row, MONTH_START + i, v, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
                        total_recognised += v
                    else:
                        _cell(ws, data_row, MONTH_START + i, None, size=9, fill=row_fill)

                _cell(ws, data_row, TOTAL_COL, total_recognised, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
                _cell(ws, data_row, VAR_COL, round(amt - total_recognised, 2), align="right", num_format=FMT_NUM, size=9, fill=row_fill)
                _cell(ws, data_row, REMARK_COL, sp["remark"] or "", size=9, fill=row_fill)
                data_row += 1
        else:
            # Unlocked (or no split) — amount only ever goes into the
            # invoice's own month. These are NOT pulled in from outside
            # the period (the widened filter above only applies to
            # LOCKED splits), so this branch naturally still only ever
            # runs for genuinely in-period invoices.
            row_fill = "FFF9F9F9" if data_row % 2 == 0 else None
            sp = splits[0] if splits else {}
            cat    = sp.get("category", "") or ""
            eu     = sp.get("end_user", "") or ""
            start  = sp.get("start_date")
            end    = sp.get("end_date")
            td_val = sp.get("total_days", "")
            remark = sp.get("remark", "") or ""

            if is_sales:
                vals = [inv["trans_date"], inv["acc_desc"] or "", inv["proj_no"] or "",
                        inv["ref_no1"] or "", inv["description"] or "",
                        dr, cr, amt, cat, eu, start, end, td_val]
            else:
                vals = [inv["trans_date"], inv["acc_desc"] or "", inv["proj_no"] or "",
                        inv["ref_no1"] or "", inv["ref_no2"] or "",
                        inv["description"] or "",
                        dr, cr, amt, cat, eu, start, end, td_val]

            for i, v in enumerate(vals):
                col_name = base_cols[i]
                if col_name in ("Home DR","Home CR","Amount"):
                    _cell(ws, data_row, i+1, v, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
                elif col_name in ("Date","Start Date","End Date"):
                    _cell(ws, data_row, i+1, v, size=9, num_format=FMT_DATE, fill=row_fill)
                else:
                    _cell(ws, data_row, i+1, v, size=9, fill=row_fill)

            # Place amount in invoice month column
            inv_date = inv["trans_date"]
            if inv_date:
                inv_mo = date(inv_date.year, inv_date.month, 1)
                for i, mo in enumerate(cols):
                    if mo == inv_mo:
                        _cell(ws, data_row, MONTH_START + i, amt, align="right",
                              num_format=FMT_NUM, size=9, fill=row_fill)
                    else:
                        _cell(ws, data_row, MONTH_START + i, None, size=9, fill=row_fill)

            _cell(ws, data_row, TOTAL_COL, amt, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
            _cell(ws, data_row, VAR_COL, 0, align="right", num_format=FMT_NUM, size=9, fill=row_fill)
            _cell(ws, data_row, REMARK_COL, remark, size=9, fill=row_fill)
            data_row += 1

    # Column widths
    width_map = {
        "Date": 12, "DE Acc. Desc.": 22, "Project Code": 18,
        "Ref. 1": 16, "Ref. 2": 14, "Desc.": 28,
        "Home DR": 14, "Home CR": 14, "Amount": 14,
        "Type": 10, "End User": 14, "Start Date": 12,
        "End Date": 12, "Total Days": 9
    }
    for i, col_name in enumerate(base_cols):
        ws.column_dimensions[get_column_letter(i + 1)].width = width_map.get(col_name, 12)
    for i in range(n):
        ws.column_dimensions[get_column_letter(MONTH_START + i)].width = 14
    ws.column_dimensions[get_column_letter(TOTAL_COL)].width  = 16
    ws.column_dimensions[get_column_letter(VAR_COL)].width    = 14
    ws.column_dimensions[get_column_letter(REMARK_COL)].width = 20

    ws.auto_filter.ref = f"A4:{get_column_letter(N_COLS)}4"
    ws.freeze_panes = "A5"
    ws.sheet_view.showGridLines = False

# ── Main export function ────────────────────────────────────────────────────
def generate_excel(db: Session, entity: str, fd: date, td: date) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    _build_pl(wb, db, entity, fd, td)
    _build_bs(wb, db, entity, fd, td)
    _build_adj(wb, db, entity, fd, td, "SALES",    "Sales")
    _build_adj(wb, db, entity, fd, td, "PURCHASE", "Purchases")
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
