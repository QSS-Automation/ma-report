import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import pnl, bs, adjustment, mfrs, staging, auth, log, tasks
from app.services.scheduler_service import start_scheduler

app = FastAPI(title="Quandatics MA Report", version="1.0.0",
              docs_url="/api/docs", redoc_url="/api/redoc")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"] if settings.debug else [
        "http://localhost:3000",
        "http://localhost:4280",
        "https://*.azurestaticapps.net",
    ],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(pnl.router)
app.include_router(bs.router)
app.include_router(adjustment.router)
app.include_router(mfrs.router)
app.include_router(staging.router)
app.include_router(auth.router)
app.include_router(log.router)
app.include_router(tasks.router)

@app.on_event("startup")
def startup():
    start_scheduler()

@app.get("/api/health", tags=["System"])
def health(): return {"status": "ok", "app": "Quandatics MA Report"}