"""Rebuilds all three staging tables from the curated layer."""
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.schemas import RefreshResponse
from app.services.config_service import ConfigService


class StagingService:
    def __init__(self): self._cfg = ConfigService()

    def rebuild(self, db: Session, user: str, entity: str = "QM") -> RefreshResponse:
        now = datetime.now()
        try:
            for block in (self._gl_sql(entity), self._ob_sql(entity), self._mfrs_sql(entity)):
                for stmt in [s.strip() for s in block.strip().split(";") if s.strip()]:
                    db.execute(text(stmt))
            db.commit()
            self._cfg.mark_refreshed(db, user, now, entity)
            return RefreshResponse(status="ok", refreshed_at=now)
        except Exception as e:
            db.rollback()
            return RefreshResponse(status="error", refreshed_at=now, message=str(e))

    def rebuild_mfrs(self, db: Session, user: str, entity: str = "QM"):
        """Rebuild only RR_mfrs — called after every lock."""
        try:
            for stmt in [s.strip() for s in self._mfrs_sql(entity).strip().split(";") if s.strip()]:
                db.execute(text(stmt))
            db.commit()
        except Exception as e:
            db.rollback(); raise e

    def _gl_sql(self, entity: str) -> str:
        return f"""
DROP TABLE IF EXISTS staging_{entity}.RR_gl_lines;
CREATE TABLE staging_{entity}.RR_gl_lines AS
SELECT 'autocount' AS source, fj.gl_dtl_key AS source_key, fj.acc_no, fj.de_acc_no,
    fj.acc_desc, fj.acc_type, fj.is_pnl_account, fj.sort_group, da.parent_acc_no,
    da.section, da.is_bs_account, da.is_re_account, fj.journal_type, fj.trans_date,
    fj.proj_no, fj.ref_no1, fj.ref_no2, fj.description, fj.home_dr, fj.home_cr,
    fj.amount, NOW() AS stg_loaded_at
FROM curated_{entity}.fact_journal fj
LEFT JOIN curated_{entity}.dim_account da ON fj.acc_no=da.acc_no
UNION ALL
SELECT 'manual' AS source, fa.adj_key AS source_key, fa.acc_no, fa.de_acc_no,
    fa.acc_desc, fa.acc_type, fa.is_pnl_account, fa.sort_group, da.parent_acc_no,
    da.section, da.is_bs_account, da.is_re_account, fa.journal_type, fa.trans_date,
    fa.proj_no, fa.ref_no1, fa.ref_no2, fa.description, fa.home_dr, fa.home_cr,
    fa.amount, NOW() AS stg_loaded_at
FROM curated_{entity}.fact_adj_line fa
LEFT JOIN curated_{entity}.dim_account da ON fa.acc_no=da.acc_no;
ALTER TABLE staging_{entity}.RR_gl_lines
    ADD PRIMARY KEY (source,source_key),
    ADD INDEX idx_trans_date(trans_date), ADD INDEX idx_acc_no(acc_no),
    ADD INDEX idx_jt_date(journal_type,trans_date),
    ADD INDEX idx_pnl_date(is_pnl_account,trans_date),
    ADD INDEX idx_bs_date(is_bs_account,trans_date),
    ADD INDEX idx_acc_type_date(acc_type,trans_date),
    ADD INDEX idx_re_account(is_re_account)
"""

    def _ob_sql(self, entity: str) -> str:
        return f"""
DROP TABLE IF EXISTS staging_{entity}.RR_ob_summary;
CREATE TABLE staging_{entity}.RR_ob_summary AS
SELECT ob.acc_no, ob.acc_desc, ob.acc_type, ob.parent_acc_no, ob.is_bs_account,
    ob.ob_home_dr, ob.ob_home_cr, ob.ob_home_balance, NOW() AS stg_loaded_at
FROM curated_{entity}.fact_ob ob WHERE ob.is_bs_account=1;
ALTER TABLE staging_{entity}.RR_ob_summary ADD PRIMARY KEY(acc_no), ADD INDEX idx_is_bs(is_bs_account)
"""

    def _mfrs_sql(self, entity: str) -> str:
        return f"""
DROP TABLE IF EXISTS staging_{entity}.RR_mfrs;
CREATE TABLE staging_{entity}.RR_mfrs AS
SELECT 'mfrs_sales' AS source_table, 'SALES' AS journal_type,
    ms.gl_dtl_key, ms.doc_no, ms.split_index, YEAR(ms.recog_month) AS recognised_year,
    fj.trans_date, fj.description, fj.proj_no, ms.total_days, ms.net_amount,
    SUM(CASE WHEN MONTH(ms.recog_month)=1  THEN ms.recognised_amt ELSE NULL END) m01,
    SUM(CASE WHEN MONTH(ms.recog_month)=2  THEN ms.recognised_amt ELSE NULL END) m02,
    SUM(CASE WHEN MONTH(ms.recog_month)=3  THEN ms.recognised_amt ELSE NULL END) m03,
    SUM(CASE WHEN MONTH(ms.recog_month)=4  THEN ms.recognised_amt ELSE NULL END) m04,
    SUM(CASE WHEN MONTH(ms.recog_month)=5  THEN ms.recognised_amt ELSE NULL END) m05,
    SUM(CASE WHEN MONTH(ms.recog_month)=6  THEN ms.recognised_amt ELSE NULL END) m06,
    SUM(CASE WHEN MONTH(ms.recog_month)=7  THEN ms.recognised_amt ELSE NULL END) m07,
    SUM(CASE WHEN MONTH(ms.recog_month)=8  THEN ms.recognised_amt ELSE NULL END) m08,
    SUM(CASE WHEN MONTH(ms.recog_month)=9  THEN ms.recognised_amt ELSE NULL END) m09,
    SUM(CASE WHEN MONTH(ms.recog_month)=10 THEN ms.recognised_amt ELSE NULL END) m10,
    SUM(CASE WHEN MONTH(ms.recog_month)=11 THEN ms.recognised_amt ELSE NULL END) m11,
    SUM(CASE WHEN MONTH(ms.recog_month)=12 THEN ms.recognised_amt ELSE NULL END) m12,
    MAX(ms.locked_at) locked_at, MAX(ms.locked_by) locked_by, NOW() stg_loaded_at
FROM curated_{entity}.mfrs_sales ms
LEFT JOIN curated_{entity}.fact_journal fj ON ms.gl_dtl_key=fj.gl_dtl_key
GROUP BY ms.gl_dtl_key,ms.doc_no,ms.split_index,YEAR(ms.recog_month),
    fj.trans_date,fj.description,fj.proj_no,ms.total_days,ms.net_amount
UNION ALL
SELECT 'mfrs_purchases','PURCHASE',
    mp.gl_dtl_key,mp.doc_no,mp.split_index,YEAR(mp.recog_month),
    fj.trans_date,fj.description,fj.proj_no,mp.total_days,mp.net_amount,
    SUM(CASE WHEN MONTH(mp.recog_month)=1  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=2  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=3  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=4  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=5  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=6  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=7  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=8  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=9  THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=10 THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=11 THEN mp.recognised_amt ELSE NULL END),
    SUM(CASE WHEN MONTH(mp.recog_month)=12 THEN mp.recognised_amt ELSE NULL END),
    MAX(mp.locked_at),MAX(mp.locked_by),NOW()
FROM curated_{entity}.mfrs_purchases mp
LEFT JOIN curated_{entity}.fact_journal fj ON mp.gl_dtl_key=fj.gl_dtl_key
GROUP BY mp.gl_dtl_key,mp.doc_no,mp.split_index,YEAR(mp.recog_month),
    fj.trans_date,fj.description,fj.proj_no,mp.total_days,mp.net_amount;
ALTER TABLE staging_{entity}.RR_mfrs
    ADD PRIMARY KEY(source_table,gl_dtl_key,split_index,recognised_year),
    ADD INDEX idx_journal_type(journal_type), ADD INDEX idx_recog_year(recognised_year),
    ADD INDEX idx_gl_dtl_key(gl_dtl_key), ADD INDEX idx_doc_no(doc_no)
"""