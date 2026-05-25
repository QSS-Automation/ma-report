# Quandatics MA Report

Internal Management Accounting Report — MFRS 15 basis.

## Architecture

```
Azure Static Web Apps          Linux Server (10.1.10.x)
  React frontend       →API→   FastAPI :8000  →  MySQL
  (GitHub auto-deploy)         (systemd service)   curated_QM / staging_QM
```

## Quick Start

### Backend (Linux server)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env   # set DB_HOST, DB_PASS
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health check: `http://10.1.10.x:8000/api/health`

### Frontend (local dev)

```bash
cd frontend
npm install
# Edit .env: REACT_APP_API_URL=http://10.1.10.x:8000
npm start   # → localhost:3000
```

### Frontend (Azure Static Web Apps)

1. Push `frontend/` to GitHub repo
2. Azure Portal → Static Web App → Settings → Environment variables
   - `REACT_APP_API_URL` = `http://10.1.10.x:8000`
3. Set App location: `/`, Output location: `build`
4. Push triggers auto-deploy via GitHub Actions

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pnl?from_date=&to_date=` | P&L Statement |
| GET | `/api/bs?from_date=&to_date=` | Balance Sheet |
| GET | `/api/adjustment/sales?from_date=&to_date=` | Sales invoices + splits |
| GET | `/api/adjustment/purchases?from_date=&to_date=` | Purchase invoices + splits |
| POST | `/api/adjustment/splits` | Save split lines |
| POST | `/api/adjustment/manual-line` | New manual deferred line |
| GET | `/api/mfrs?journal_type=&from_date=&to_date=` | MFRS recognition table |
| POST | `/api/mfrs/lock` | Lock period (Option A rounding fix) |
| POST | `/api/staging/refresh` | Rebuild staging tables |
| GET | `/api/config` | ref_config |
| GET | `/api/health` | Health check |

## Tabs

- **P&L Statement** — monthly columns, MFRS injection, YoY toggle, Period Comparison (TradingView-style)
- **Balance Sheet** — 4-CTE query, expandable sections
- **Sales / Purchases** — invoice table, inline split UI, lock/unlock, new deferred lines
- **Adj. Log** — filterable activity log
- **Adj. Tasks** — role-based task workflow
- **MFRS Sales / Purchases** — monthly recognition by contract
