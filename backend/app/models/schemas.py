from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────────────────────
class RefConfigOut(BaseModel):
    config_id: int; company_code: str; re_acc_no: str
    currency_code: str; fiscal_year_start: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ── Staging ─────────────────────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    user: str
    entity: str = "QM"

class RefreshResponse(BaseModel):
    status: Literal["ok","error"]; refreshed_at: datetime; message: Optional[str] = None

# ── P&L ─────────────────────────────────────────────────────────────────────
class PnlRow(BaseModel):
    row_type:   Literal["subtotal","detail","mfrs","net_sales","summary"]
    section:    str
    sort_order: int
    acc_no:     Optional[str]  = None
    label:      str
    tag:        Optional[str]  = None
    months:     list[Optional[Decimal]]
    total:      Optional[Decimal] = None

class PnlResponse(BaseModel):
    from_date:    date; to_date: date
    month_labels: list[str]; rows: list[PnlRow]

# ── Balance Sheet ────────────────────────────────────────────────────────────
class BsRow(BaseModel):
    acc_no: str; acc_desc: str; parent_acc_no: Optional[str]; acc_type: str
    ob_home_dr: Decimal; ob_home_cr: Decimal; ob_home_balance: Decimal
    bf_home_dr: Decimal; bf_home_cr: Decimal; bf_home_balance: Decimal
    period_home_dr: Decimal; period_home_cr: Decimal; period_home_net: Decimal
    closing_balance: Decimal
    monthly: dict[str, Optional[Decimal]] = {}

class BsResponse(BaseModel):
    from_date: date; to_date: date
    month_labels: list[str] = []
    rows: list[BsRow]

# ── Adjustment ───────────────────────────────────────────────────────────────
class SplitLineOut(BaseModel):
    split_id: int; category: Optional[str]; end_user: Optional[str]
    start_date: Optional[date]; end_date: Optional[date]; total_days: Optional[int]
    net_amount: Decimal; remark: Optional[str]; is_locked: bool
    locked_at: Optional[datetime]; locked_by: Optional[str]

class InvoiceOut(BaseModel):
    source: str; source_key: int; trans_date: date
    acc_no: Optional[str] = None; acc_desc: Optional[str] = None
    de_acc_no: Optional[str] = None; de_acc_desc: Optional[str] = None
    proj_no: Optional[str] = None; ref_no1: Optional[str] = None; ref_no2: Optional[str] = None
    description: Optional[str] = None; home_dr: Decimal; home_cr: Decimal
    amount: Decimal; journal_type: str; splits: list[SplitLineOut] = []

class AdjustmentResponse(BaseModel):
    from_date: date; to_date: date
    journal_type: Literal["SALES","PURCHASE"]; invoices: list[InvoiceOut]

class SplitLineIn(BaseModel):
    split_id:     Optional[int]  = None
    category:     Optional[str]  = None
    end_user:     Optional[str]  = None
    start_date:   Optional[date] = None
    end_date:     Optional[date] = None
    split_amount: Decimal
    #remark:       Optional[str]  = None

class SaveSplitsRequest(BaseModel):
    source_key: int; journal_type: Literal["SALES","PURCHASE"]
    user: str; splits: list[SplitLineIn]
    entity: str = "QM"

class SaveSplitsResponse(BaseModel):
    status: Literal["ok","error"]; split_ids: list[int]; message: Optional[str] = None

class ManualLineIn(BaseModel):
    journal_type: Literal["SALES","PURCHASE"]; trans_date: date
    de_acc_desc:  Optional[str]  = None; proj_no:   Optional[str]  = None
    ref_no1:      Optional[str]  = None; description: Optional[str] = None
    home_dr:      Decimal = Decimal("0"); home_cr: Decimal = Decimal("0")
    split_amount: Decimal; category: Optional[str] = None; end_user: Optional[str] = None
    start_date:   Optional[date] = None; end_date: Optional[date] = None
    remark:       Optional[str]  = None; user: str
    entity: str = "QM"

class ManualLineResponse(BaseModel):
    status: Literal["ok","error"]; split_id: Optional[int] = None; message: Optional[str] = None

# ── MFRS ─────────────────────────────────────────────────────────────────────
class MfrsRow(BaseModel):
    gl_dtl_key: int; doc_no: Optional[str]; split_index: int; recognised_year: int
    trans_date: Optional[date]; description: Optional[str]; proj_no: Optional[str]
    net_amount: Decimal; total_days: Optional[int]
    monthly: dict[str, Optional[Decimal]]
    locked_at: Optional[datetime]; locked_by: Optional[str]

class MfrsResponse(BaseModel):
    journal_type: Literal["SALES","PURCHASE"]; recognised_years: list[int]
    month_columns: list[str]; rows: list[MfrsRow]

class LockPeriodRequest(BaseModel):
    journal_type: Literal["SALES","PURCHASE"]; lock_year_month: str; user: str

class LockPeriodResponse(BaseModel):
    status: Literal["ok","error"]; locked_rows: int; message: Optional[str] = None
