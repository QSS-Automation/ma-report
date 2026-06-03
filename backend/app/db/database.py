from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True,
                       pool_size=5, max_overflow=10, echo=settings.debug)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:    yield db
    finally: db.close()

def run(db: Session, sql: str, params: dict | None = None) -> list[dict]:
    result = db.execute(text(sql), params or {})
    keys = list(result.keys())
    return [dict(zip(keys, row)) for row in result.fetchall()]
