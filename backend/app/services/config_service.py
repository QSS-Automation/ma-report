from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import run
from app.models.schemas import RefConfigOut

class ConfigService:

    def get_config(self, db: Session, entity: str = "QM") -> RefConfigOut:
        rows = run(db, f"""
            SELECT config_id, company_code, re_acc_no, currency_code,
                fiscal_year_start,
                IFNULL(staging_refreshed_at, NULL) staging_refreshed_at,
                IFNULL(staging_refreshed_by, NULL) staging_refreshed_by
            FROM curated_{entity}.ref_config
            WHERE company_code=:c LIMIT 1
        """, {"c": entity})
        if not rows: raise ValueError(f"ref_config not found for entity {entity}")
        return RefConfigOut(**rows[0])

    def get_re_acc_no(self, db: Session, entity: str = "QM") -> str:
        return self.get_config(db, entity).re_acc_no

    def get_entities(self, db: Session) -> list[str]:
        """Return all available entity codes from ops_QM.
        Add a ref_entities table or derive from ref_config tables."""
        rows = run(db,
            "SELECT entity_code FROM ops_QM.ref_entities WHERE is_active=1 ORDER BY entity_code",
            {})
        return [r["entity_code"] for r in rows]

    def mark_refreshed(self, db: Session, user: str, ts: datetime,
                        entity: str = "QM") -> None:
        db.execute(text(f"""
            UPDATE curated_{entity}.ref_config
               SET staging_refreshed_at=:ts, staging_refreshed_by=:u
             WHERE company_code=:c
        """), {"ts": ts, "u": user, "c": entity})
        db.commit()