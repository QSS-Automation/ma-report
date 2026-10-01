"""Per-entity P&L templates for the new (tag-driven) P&L — pnl_service_v2.

Each template is the line order of that entity's own MA report (the PL
sheet of "<entity>_MA 2025 (… Rev).xlsx"), as pnl tags, in four blocks:

  gp    lines above Gross Profit. Income tags (GP_INCOME_TAGS) add to Gross
        Profit, every other tag here is a cost and subtracts from it. Sales
        ("rev") and cost of sales ("cos") also carry the MFRS recognition
        branch, so deferred amounts are never dropped.
  oi    Other Income lines (one umbrella row, added).
  opex  Operating Expenses lines (one umbrella row, subtracted).
  tax   tax lines (subtracted after Profit Before Tax).

Which account belongs to which tag lives in ops_QM.account_pnl_tags (per
entity); the line labels are that table's display_label. A template line
with no tagged accounts still shows, at zero, like the MA report does.

An entity without its own template (e.g. Daltos for now) uses QM's.
"""

GP_INCOME_TAGS = {"rev", "bsei"}

TEMPLATES = {
    "QM": {
        "gp": ["rev", "bsei", "cos", "other cos", "bse"],
        "oi": ["oi", "mgmt inc", "rent inc", "div inc", "sponsor inc", "subsidy inc", "ppe gain", "fx gain"],
        "opex": ["payroll", "bonus", "tr loss", "subsi loss", "ppe loss", "commission", "dir pay", "dir fee", "insurance", "travel", "oe", "prof", "fc", "ent", "fx loss", "depr", "sponsorship", "welfare", "rental", "bc", "it", "subscription", "advertising", "utilities", "recruitment", "maintenance", "marketing", "mgmt", "training"],
        "tax": ["tax pl"],
    },
    "QA": {
        "gp": ["rev", "cos", "other cos", "payroll cos"],
        "oi": ["oi", "fx gain"],
        "opex": ["marketing", "event", "support", "bc", "fc", "dir pay", "payroll", "bonus", "welfare", "recruitment", "depr", "ent", "oe", "fx loss", "mgmt", "maintenance", "subscription", "travel", "rental", "prof", "utilities"],
        "tax": ["tax pl"],
    },
    "QAW": {
        "gp": ["rev", "cos", "other cos", "payroll cos"],
        "oi": ["oi", "fx gain"],
        "opex": ["advertising", "bc", "dir pay", "payroll", "bonus", "welfare", "recruitment", "depr", "ent", "oe", "fx loss", "mgmt", "travel", "rental", "prof", "subscription", "insurance"],
        "tax": ["tax pl"],
    },
    "QAR": {
        "gp": ["rev", "cos"],
        "oi": ["oi", "fx gain"],
        "opex": ["marketing", "bc", "dir pay", "welfare", "subscription", "payroll", "bonus", "comm", "depr", "ent", "oe", "fx loss", "mgmt", "travel", "rental", "prof", "utilities"],
        "tax": ["tax pl"],
    },
    "OMT": {
        "gp": ["rev", "cos"],
        "oi": ["oi", "fx gain"],
        "opex": ["marketing", "bc", "dir pay", "welfare", "subscription", "payroll", "bonus", "comm", "depr", "ent", "oe", "fx loss", "mgmt", "travel", "rental", "prof", "utilities"],
        "tax": ["tax pl"],
    },
    "CC": {
        "gp": ["rev", "cos"],
        "oi": ["oi", "fx gain"],
        "opex": ["advertising", "bc", "dir pay", "dir fee", "payroll", "welfare", "depr", "ent", "oe", "fx loss", "mgmt", "travel", "rental", "prof", "subscription"],
        "tax": ["tax pl"],
    },
}

# The app may use the company name or the short code as the entity code
# (same convention as sharepoint_service.COMPANIES).
_ALIASES = {"qarmour": "QAR", "qomnitech": "OMT"}
_BY_KEY = {k.lower(): k for k in TEMPLATES}
_BY_KEY.update(_ALIASES)


def template_for(entity: str) -> dict:
    return TEMPLATES[_BY_KEY.get((entity or "").lower(), "QM")]
