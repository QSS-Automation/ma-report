import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import pnl, bs, adjustment, mfrs, staging, auth, log, tasks, export, order_list_enhanced
from app.services.scheduler_service import start_scheduler
from app.routers import order_list


app = FastAPI(title="Quandatics MA Report", version="1.0.0",
              docs_url="/api/docs", redoc_url="/api/redoc")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:4280",
]

def _origin_allowed(origin: str) -> bool:
    return settings.debug or origin in ALLOWED_ORIGINS or origin.endswith(".azurestaticapps.net")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"] if settings.debug else ALLOWED_ORIGINS,
    allow_origin_regex=None if settings.debug else r"https://.*\.azurestaticapps\.net",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Responses built by a registered Exception handler (as opposed to a normal
# route return) don't reliably get Access-Control-Allow-Origin attached by
# CORSMiddleware at this depth in Starlette's stack — the browser then
# blocks the response entirely and the frontend just sees an opaque
# "Network Error" instead of the real status/message. Set the header here
# directly so DB/network failures surface as a normal, readable 500.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.exception("Unhandled exception on %s", request.url.path)
    response = JSONResponse(status_code=500, content={"detail": str(exc)})
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response

app.include_router(pnl.router)
app.include_router(bs.router)
app.include_router(adjustment.router)
app.include_router(mfrs.router)
app.include_router(staging.router)
app.include_router(auth.router)
app.include_router(log.router)
app.include_router(tasks.router)
app.include_router(order_list.router)
app.include_router(export.router)
app.include_router(order_list_enhanced.router)

@app.on_event("startup")
def startup():
    start_scheduler()

@app.get("/api/health", tags=["System"])
def health(): return {"status": "ok", "app": "Quandatics MA Report"}
