from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db, run
from app.utils import validate_entity

router = APIRouter(prefix="/api/order-list", tags=["Order List"])

@router.get("")
def get_order_list(entity: str = "QM", db: Session = Depends(get_db)):
    validate_entity(entity)
    rows = run(db, f"""
        SELECT
            gl.proj_no,
            gl.journal_type,
            gl.trans_date,
            gl.ref_no1,
            gl.ref_no2,
            gl.acc_desc,
            gl.description,
            gl.acc_no,
            -- FIX: previously this always showed the FULL original GL
            -- amount on every row, regardless of splits. For a
            -- multi-split invoice (e.g. one invoice split 40%/60% across
            -- two categories via the Adjustment tab), fact_split has
            -- multiple rows sharing the same gl_dtl_key — since this is a
            -- plain LEFT JOIN (no dedup/aggregation), that produced one
            -- Order List row PER SPLIT, each one showing the SAME full
            -- original amount instead of that split's own portion — e.g.
            -- a $10,000 invoice split 50/50 showed up as two $10,000
            -- rows instead of two $5,000 rows. Now: if a split exists,
            -- show that split's own net_amount (rows correctly sum back
            -- to the invoice total); only fall back to the full GL
            -- amount when there's no split at all yet (single row).
            CASE
                WHEN fs.net_amount IS NOT NULL THEN fs.net_amount
                WHEN gl.journal_type = 'SALES' THEN -(gl.home_dr - gl.home_cr)
                ELSE gl.amount
            END AS amount,
            fs.category,
            fs.start_date,
            fs.end_date,
            fs.total_days
        FROM staging_rr_{entity}.RR_gl_lines gl
        LEFT JOIN curated_acc_{entity}.fact_split fs
            ON fs.gl_dtl_key = gl.source_key
        WHERE gl.proj_no IS NOT NULL
            AND gl.proj_no != ''
            AND (
                gl.journal_type IN ('SALES', 'PURCHASE')
                OR ('{entity}' = 'QA' AND gl.journal_type = 'BANK' AND gl.acc_no = '616-0000')
                OR ('{entity}' = 'QM' AND gl.journal_type = 'GENERAL' AND gl.acc_no = '405-C001')
                OR (gl.journal_type IN ('BANK','GENERAL') AND gl.acc_desc = 'CONTRACT LIABILITY')
            )
            AND (
                (gl.journal_type = 'SALES' AND (
                    gl.acc_type = 'SA'
                    OR (gl.acc_type = 'SL' AND gl.acc_no = '500-0000')
                    OR (gl.source = 'manual' AND gl.acc_no = '500-0000')
                    OR gl.acc_desc = 'CONTRACT ASSET'
                ))
                OR (
                    -- FIX: this outer gate previously only let a QA BANK
                    -- row through if its acc_desc was literally
                    -- 'CONTRACT LIABILITY' — but the inner condition list
                    -- right below already expects to catch ANY QA BANK
                    -- row on account 616-0000 (e.g. Trainer Fees paid via
                    -- bank transfer), not just Contract Liability ones.
                    -- That inner condition was unreachable for anything
                    -- else, since this outer gate short-circuited first.
                    -- Now matches on acc_no='616-0000' instead, consistent
                    -- with the outermost journal_type filter above.
                    -- NEW: Contract Liability (acc_no 481-0000 for QA)
                    -- gets posted via PURCHASE (original) and reversed
                    -- via GENERAL journal entries, and can also appear
                    -- as BANK — none of these are tied to a single
                    -- specific account number the way 616-0000/405-C001
                    -- were, so this is its own standalone condition
                    -- rather than folded into the journal_type sub-gate
                    -- above. Without this, GENERAL-type reversal entries
                    -- for Contract Liability were excluded entirely,
                    -- meaning the account's activity shown here never
                    -- netted against its own reversals.
                    (gl.journal_type = 'PURCHASE' OR ('{entity}' = 'QA' AND gl.journal_type = 'BANK' AND gl.acc_no = '616-0000') OR ('{entity}' = 'QM' AND gl.journal_type = 'GENERAL' AND gl.acc_no = '405-C001') OR (gl.journal_type IN ('BANK','GENERAL') AND gl.acc_desc = 'CONTRACT LIABILITY')) AND (
                        (gl.acc_type = 'CO' AND gl.acc_no NOT LIKE '617-%')
                        OR gl.source = 'manual'
                        OR gl.acc_desc = 'ACCRUALS'
                        OR gl.acc_desc = 'CONTRACT ASSET'
                        OR gl.acc_desc = 'CONTRACT LIABILITIES'
                        OR gl.acc_desc = 'CONTRACT LIABILITY'
                        OR ('{entity}' = 'QA' AND gl.acc_no = '616-0000')
                        OR ('{entity}' = 'QM' AND gl.acc_no = '405-C001')
                    )
                )
            )
            AND gl.proj_no IN (
                SELECT DISTINCT proj_no
                FROM staging_rr_{entity}.RR_gl_lines
                WHERE trans_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
                    AND proj_no IS NOT NULL
                    AND proj_no != ''
            )
        ORDER BY gl.proj_no, gl.journal_type, gl.trans_date
    """, {})
    return rows
