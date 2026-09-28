"""P&L Service V2 — tag-driven category structure (account_pnl_tags),
per-account MFRS breakdown, no double-counting.

Kept as a SEPARATE service/class from the original PnlService, per the
requirement to keep the old P&L fully intact and working until the new
one is fully validated. Nothing here touches PnlService, dim_account,
or any existing staging/curated table beyond reading from them.
"""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.database import run
from app.models.schemas import PnlResponse, PnlRow

D = Decimal

# Ordered structure of the new P&L. Each entry is either:
#   ("single", tag, label)        -> one category, own row, own detail children
#   ("group", [tags], label)      -> umbrella row, children = one row per tag inside
# "gp_component"/"oi_component"/"opex_component" mark which roll-up each
# belongs to, used purely for the Gross Profit / PBT / PAT formulas below.

GP_TAGS = ["rev", "cos", "other cos", "bse"]  # each its own top-level row
MFRS_TAGS = {"rev": "SALES", "cos": "PURCHASE"}  # which top-level tags get an MFRS child branch

OI_TAGS = ["oi", "mgmt inc", "rent inc", "div inc", "sponsor inc",
           "subsidy inc", "ppe gain", "fx gain"]

OPEX_TAGS = ["payroll", "bonus", "tr loss", "subsi loss", "ppe loss",
             "commission", "dir pay", "dir fee", "insurance", "travel",
             "oe", "prof", "fc", "ent", "fx loss", "depr", "sponsorship",
             "welfare", "rental", "bc", "it", "subscription", "advertising",
             "utilities", "recruitment", "maintenance", "marketing", "mgmt",
             "training"]

TAX_TAGS = ["tax pl"]

# Fallback display names — only used if a tag's display_label is NULL
# in account_pnl_tags (shouldn't normally happen once the table is
# backfilled, but keeps labels sane if a brand-new tag gets added to
# an account before its display_label is set).
DEFAULT_TAG_LABELS = {
    "rev": "Sales",
    "cos": "Cost of Goods Sold",
    "other cos": "Other COS",
    "bse": "Business Support Expense",
    "oi": "Miscellaneous Income",
    "mgmt inc": "Management Fee Income",
    "rent inc": "Rental Income",
    "div inc": "Dividend Income",
    "sponsor inc": "Sponsorship Income",
    "subsidy inc": "Subsidy Income",
    "ppe gain": "Gain on Disposal of PPE",
    "fx gain": "Gain on Foreign Exchange",
    "payroll": "Payroll",
    "bonus": "Bonus",
    "tr loss": "Trade Receivables Loss",
    "subsi loss": "Loss on Investment in Subsidiary",
    "ppe loss": "Loss on Disposal of PPE",
    "commission": "Commission",
    "dir pay": "Director Remuneration",
    "dir fee": "Director Fee",
    "insurance": "Insurance",
    "travel": "Travelling",
    "oe": "General Operating Expenses",
    "prof": "Professional Fees",
    "fc": "Finance Cost",
    "ent": "Entertainment",
    "fx loss": "Loss on Foreign Exchange",
    "depr": "Depreciation",
    "sponsorship": "Sponsorship Expense",
    "welfare": "Staff Welfare",
    "rental": "Rental Expense",
    "bc": "Bank Charges",
    "it": "IT Support",
    "subscription": "Subscription Fees",
    "advertising": "Advertising",
    "utilities": "Utilities",
    "recruitment": "Recruitment",
    "maintenance": "Maintenance",
    "marketing": "Marketing",
    "mgmt": "Management Fee Expense",
    "training": "Training",
    "tax pl": "Taxation",
}


def _months(fd, td):
    c = []; y, m = fd.year, fd.month
    while True:
        c.append(date(y, m, 1))
        if (y, m) == (td.year, td.month): break
        m += 1
        if m > 12: m, y = 1, y + 1
    return c


class PnlServiceV2:
    def get_pnl(self, db: Session, fd: date, td: date, entity: str = "QM") -> PnlResponse:
        cols = _months(fd, td); n = len(cols)

        # ── Raw GL, tagged via account_pnl_tags (read-time join — no
        # changes to dim_account or the curated/staging pipeline at all).
        # MFRS-managed transactions (fact_split with both dates set) are
        # EXCLUDED here — they're represented only via the MFRS branch
        # below, never double-counted against their own account's raw row.
        gl = run(db, f"""
            SELECT gl.acc_no, gl.acc_desc, pt.pnl_tag,
                YEAR(gl.trans_date) yr, MONTH(gl.trans_date) mo,
                SUM(CASE gl.acc_type
                    WHEN 'SL' THEN gl.home_cr-gl.home_dr WHEN 'SA' THEN gl.home_dr-gl.home_cr
                    WHEN 'CO' THEN gl.home_dr-gl.home_cr WHEN 'OI' THEN gl.home_cr-gl.home_dr
                    WHEN 'EP' THEN gl.home_dr-gl.home_cr WHEN 'TX' THEN gl.home_dr-gl.home_cr
                    ELSE gl.home_dr-gl.home_cr END) net_amount
            FROM staging_rr_{entity}.RR_gl_lines gl
            JOIN ops_QM.account_pnl_tags pt
                ON pt.entity = :entity AND pt.acc_no = gl.acc_no
            WHERE gl.is_pnl_account = 1
              AND gl.trans_date BETWEEN :fd AND :td
              AND NOT EXISTS (
                  SELECT 1 FROM curated_acc_{entity}.fact_split fs
                  WHERE fs.gl_dtl_key = gl.source_key
                    AND fs.is_manual_line = 0
                    AND fs.start_date IS NOT NULL
                    AND fs.end_date IS NOT NULL
              )
            GROUP BY gl.acc_no, gl.acc_desc, pt.pnl_tag,
                YEAR(gl.trans_date), MONTH(gl.trans_date)
            ORDER BY gl.acc_no
        """, {"entity": entity, "fd": fd, "td": td})

        # ── MFRS, now WITH acc_no (per the staging_service.py patch) ──
        years = sorted({c.year for c in cols})
        ys = ",".join(str(y) for y in years)
        mfrs_raw = run(db, f"""
            SELECT gl_dtl_key, split_index, acc_no, journal_type, recognised_year, trans_date,
                m01,m02,m03,m04,m05,m06,m07,m08,m09,m10,m11,m12
            FROM staging_rr_{entity}.RR_mfrs
            WHERE recognised_year IN ({ys})
        """, {})
        mk_y = {y: [f"m{c.month:02d}" for c in cols if c.year == y] for y in years}

        def months_for(row):
            vals = [D(0)] * n
            yr = row["recognised_year"]
            amks = mk_y.get(yr, [])
            for i, c in enumerate(cols):
                mk = f"m{c.month:02d}"
                if mk in amks and row.get(mk) is not None:
                    vals[i] += D(str(row[mk]))
            return vals

        # acc_desc lookup (for labeling MFRS children with a readable name)
        # NOTE: intentionally NOT built from `gl` above — that query
        # excludes MFRS-managed transactions (the double-count fix), so
        # an account that's ENTIRELY deferred (100% of its transactions
        # have MFRS splits, e.g. a Contract Asset/Liability account)
        # would never appear in `gl` at all, leaving no description to
        # look up and silently falling back to showing the raw acc_no
        # instead. Pull descriptions from RR_gl_lines directly instead,
        # unfiltered, purely for labeling — this has nothing to do with
        # the actual P&L calculation.
        acc_desc_rows = run(db, f"""
            SELECT DISTINCT acc_no, acc_desc
            FROM staging_rr_{entity}.RR_gl_lines
            WHERE acc_no IS NOT NULL
        """, {})
        acc_desc_by_no = {r["acc_no"]: r["acc_desc"] for r in acc_desc_rows}

        # ── Category display names, sourced from account_pnl_tags itself
        # (display_label column) — editable via SQL/an admin UI with no
        # code deploy needed. Falls back to DEFAULT_TAG_LABELS only if a
        # tag's display_label is somehow still NULL.
        label_rows = run(db, """
            SELECT DISTINCT pnl_tag, display_label
            FROM ops_QM.account_pnl_tags
            WHERE entity = :entity
        """, {"entity": entity})
        tag_label_by_tag = {
            r["pnl_tag"]: r["display_label"] or DEFAULT_TAG_LABELS.get(r["pnl_tag"], r["pnl_tag"])
            for r in label_rows
        }
        def tag_label(tag):
            return tag_label_by_tag.get(tag, DEFAULT_TAG_LABELS.get(tag, tag))

        def mfrs_children_for_tag(jt):
            """Group MFRS rows by (INVOICE year, acc_no) -> nested PnlRow
            children. Grouped by trans_date's year — the year the invoice
            was actually raised — NOT recognised_year and NOT the
            recognition schedule's start_date. E.g. a 2025 invoice whose
            revenue is recognized Nov 2025 - Feb 2026 shows entirely
            under "MFRS 2025 Recognition" (all months included), because
            the INVOICE itself is dated 2025 — regardless of which
            calendar years its recognition schedule actually spans."""
            by_year_acc = {}
            for r in mfrs_raw:
                if r["journal_type"] != jt or not r["acc_no"]:
                    continue
                # Fallback to recognised_year only in the unexpected case
                # trans_date is missing (e.g. the LEFT JOIN to
                # fact_journal found no match) — should not normally happen.
                group_year = r["trans_date"].year if r.get("trans_date") else r["recognised_year"]
                key = (group_year, r["acc_no"])
                if key not in by_year_acc:
                    by_year_acc[key] = [D(0)] * n
                vals = months_for(r)
                for i in range(n):
                    by_year_acc[key][i] += vals[i]

            by_year = {}
            for (yr, acc_no), vals in by_year_acc.items():
                by_year.setdefault(yr, []).append((acc_no, vals))

            year_rows = []
            for yr in sorted(by_year.keys(), reverse=True):
                acc_children = []
                yr_total = [D(0)] * n
                for acc_no, vals in sorted(by_year[yr]):
                    for i in range(n): yr_total[i] += vals[i]
                    acc_children.append(PnlRow(
                        row_type="detail", section="MFRS", sort_order=0,
                        acc_no=acc_no, label=acc_desc_by_no.get(acc_no, acc_no),
                        tag="mfrs", months=vals, total=sum(vals, D(0)),
                    ))
                year_rows.append(PnlRow(
                    row_type="mfrs", section="MFRS", sort_order=0,
                    label=f"MFRS {yr} Recognition", tag="mfrs",
                    months=yr_total, total=sum(yr_total, D(0)),
                    children=acc_children,
                ))
            return year_rows

        # ── Aggregate raw GL by tag + account ──
        by_tag_acc = {}
        for r in gl:
            tag, acc_no = r["pnl_tag"], r["acc_no"]
            by_tag_acc.setdefault(tag, {}).setdefault(
                acc_no, {"label": r["acc_desc"], "months": [D(0)] * n}
            )
            ci = None
            for i, c in enumerate(cols):
                if c.year == r["yr"] and c.month == r["mo"]:
                    ci = i; break
            if ci is not None:
                by_tag_acc[tag][acc_no]["months"][ci] += D(str(r["net_amount"] or 0))

        def build_tag_row(tag, label, sort_order, mfrs_jt=None):
            """Builds one top-level row for a single tag, with its raw
            accounts as children, plus an MFRS branch child if applicable."""
            accs = by_tag_acc.get(tag, {})
            total_months = [D(0)] * n
            children = []
            for acc_no, a in sorted(accs.items()):
                for i in range(n): total_months[i] += a["months"][i]
                children.append(PnlRow(
                    row_type="detail", section=tag.upper(), sort_order=sort_order,
                    acc_no=acc_no, label=a["label"], tag=tag,
                    months=a["months"], total=sum(a["months"], D(0)),
                ))
            if mfrs_jt:
                mfrs_rows = mfrs_children_for_tag(mfrs_jt)
                for mr in mfrs_rows:
                    for i in range(n): total_months[i] += mr.months[i]
                children.extend(mfrs_rows)
            return PnlRow(
                row_type="subtotal", section=tag.upper(), sort_order=sort_order,
                label=label, tag=tag, months=total_months,
                total=sum(total_months, D(0)), children=children,
            )

        def build_group_row(tags, label, section, sort_order):
            """Builds one umbrella row (Other Income / Operating Expenses)
            whose children are one row per tag (each tag's own children
            being its individual accounts)."""
            group_total = [D(0)] * n
            children = []
            for tag in tags:
                accs = by_tag_acc.get(tag, {})
                tag_total = [D(0)] * n
                tag_children = []
                for acc_no, a in sorted(accs.items()):
                    for i in range(n): tag_total[i] += a["months"][i]
                    tag_children.append(PnlRow(
                        row_type="detail", section=section, sort_order=sort_order,
                        acc_no=acc_no, label=a["label"], tag=tag,
                        months=a["months"], total=sum(a["months"], D(0)),
                    ))
                for i in range(n): group_total[i] += tag_total[i]
                children.append(PnlRow(
                    row_type="subtotal", section=section, sort_order=sort_order,
                    label=tag_label(tag), tag=tag, months=tag_total,
                    total=sum(tag_total, D(0)), children=tag_children,
                ))
            return PnlRow(
                row_type="subtotal", section=section, sort_order=sort_order,
                label=label, tag=None, months=group_total,
                total=sum(group_total, D(0)), children=children,
            ), group_total

        result = []

        # ── Gross Profit block ──
        rev_row = build_tag_row("rev", tag_label("rev"), 10, mfrs_jt="SALES")
        cos_row = build_tag_row("cos", tag_label("cos"), 20, mfrs_jt="PURCHASE")
        other_cos_row = build_tag_row("other cos", tag_label("other cos"), 30)
        bse_row = build_tag_row("bse", tag_label("bse"), 40)
        result += [rev_row, cos_row, other_cos_row, bse_row]

        gp = [rev_row.months[i] - cos_row.months[i] - other_cos_row.months[i] - bse_row.months[i]
              for i in range(n)]
        result.append(PnlRow(row_type="summary", section="GROSS_PROFIT", sort_order=50,
                              label="Gross Profit / (Loss)", months=gp, total=sum(gp, D(0))))

        # ── Other Income / Operating Expenses blocks ──
        oi_row, oi_total = build_group_row(OI_TAGS, "Other Income", "OTHER_INCOME", 60)
        opex_row, opex_total = build_group_row(OPEX_TAGS, "Operating Expenses", "OPERATING_EXPENSES", 70)
        result += [oi_row, opex_row]

        pbt = [gp[i] + oi_total[i] - opex_total[i] for i in range(n)]
        result.append(PnlRow(row_type="summary", section="NET_PROFIT_BEFORE", sort_order=80,
                              label="Profit / (Loss) Before Tax", months=pbt, total=sum(pbt, D(0))))

        # ── Taxation block ──
        tax_row = build_tag_row("tax pl", tag_label("tax pl"), 90)
        result.append(tax_row)

        pat = [pbt[i] - tax_row.months[i] for i in range(n)]
        result.append(PnlRow(row_type="summary", section="NET_PROFIT_AFTER", sort_order=100,
                              label="Profit / (Loss) After Tax", months=pat, total=sum(pat, D(0))))

        result.sort(key=lambda r: r.sort_order)
        MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        return PnlResponse(from_date=fd, to_date=td,
            month_labels=[MN[c.month-1]+"-"+str(c.year)[2:] for c in cols], rows=result)
