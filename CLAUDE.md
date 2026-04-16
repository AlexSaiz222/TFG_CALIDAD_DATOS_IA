# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Data Quality Evaluation Platform for AI Projects (TFG). Allows users to manage datasets, configure quality metrics, run evaluations, and view results via interactive dashboards.

## Common Commands

### Full Stack (recommended)
```bash
docker-compose up          # Start all services
docker-compose up --build  # Rebuild and start
docker-compose down        # Stop all services
```

### Backend (Flask)
```bash
cd backend
pip install -r requirements.txt
flask run                  # Dev server on port 5000

# Database migrations
flask db migrate -m "description"
flask db upgrade

# Tests
pytest                                          # Run all tests
pytest tests/test_dataset_versioning.py        # Single test file
pytest tests/test_quality_gate.py              # Quality gate tests
pytest --cov=. tests/                          # With coverage
```

### Frontend (Next.js)
```bash
cd frontend
pnpm install   # or npm install
pnpm dev       # Dev server on port 3000
pnpm build
pnpm lint
```

## Architecture

### Services (docker-compose)
| Service | Port | Purpose |
|---------|------|---------|
| frontend | 3000 | Next.js UI |
| backend | 5000 | Flask REST API |
| postgres | 5432 | Primary database (`dataquality`) |
| redis | 6379 | Celery broker + cache |
| minio | 9000/9001 | S3-compatible file storage |
| celery | — | Background task worker |
| celery-beat | — | Scheduled task runner |
| flower | 5555 | Celery monitoring dashboard |

### Frontend → Backend Connection
Next.js rewrites `/api/*` to the Flask backend. In development: `localhost:5000`; in Docker: `http://backend:5000`. This means frontend code uses relative `/api/...` URLs.

Authentication is JWT-based; tokens are passed via `Authorization` headers.

### Backend Structure (`backend/`)
Flask app with blueprint-based modular architecture:
- `api/auth/` — JWT auth, registration, login, token refresh
- `api/projects/` — Project CRUD + metrics config
- `api/datasets/` — Dataset upload, versioning, profiling
- `api/metrics/` — Quality metric definitions and templates
- `api/evaluations/` — Run and retrieve legacy quality evaluations
- `api/dashboard/` — Dashboard summary endpoint (analysis runs, trends)
- `api/admin/` — Admin utilities
- `models/` — SQLAlchemy ORM models
- `tasks/` — Celery async tasks (evaluation execution)
- `migrations/` — Flask-Migrate Alembic migrations
- `middleware/` — Error handlers, request logging, evaluation watchdog

### Frontend Structure (`frontend/src/`)
- `pages/` — Next.js file-based routing
- `components/` — Reusable UI components (see `frontend_info.md` for full list)
- `services/` — API client functions
- `contexts/` — React contexts (AuthContext for auth state)
- `types/index.ts` — Shared TypeScript types for all entities

### Key Models
- `User` → owns `Projects`
- `Project` → has `Datasets`, `Metrics` (metrics_config as JSONB), and one `QualityGate`
- `Dataset` → has versioning fields (`parent_dataset_id`, `version`, `version_tag`, `is_latest`), `sensitive_columns` (JSONB), links to MinIO file
- `Metric` → quality rule definition with thresholds
- `Evaluation` / `EvaluationRun` → legacy evaluation system
- `AnalysisRun` — **Sonar-Lite** snapshot per project run; immutable, comparable to a baseline run
- `QualityGate` — per-project pass/fail thresholds (min_score, max_critical_issues, max_new_issues)
- `DataQualityIssue` — individual issue linked to an `AnalysisRun`; has `fingerprint` for tracking across runs

### Sonar-Lite Architecture
`AnalysisRun` is the core model. Each run:
1. Executes configured metrics against a dataset
2. Stores results + issues as an immutable snapshot
3. Compares against a `baseline_analysis_id` to compute `new_issues_count` / `fixed_issues_count`
4. Evaluates `QualityGate` thresholds → sets `quality_gate_status` (PASSED / WARNING / FAILED)

### Dataset Versioning
Datasets support parent–child versioning via `parent_dataset_id`. Each version has a `version` integer, optional `version_tag`, and `is_latest` flag. The lineage canvas in the frontend renders the full version tree.

### Data Flow for Evaluations
1. User uploads dataset → stored in MinIO, metadata in PostgreSQL
2. User configures metrics on a project
3. Evaluation/AnalysisRun triggered → Celery task runs asynchronously
4. Results stored in PostgreSQL, viewable in dashboard

## Environment
Backend `.env` (at `backend/.env`) — not committed, configure from these keys:
- `DATABASE_URL`, `JWT_SECRET_KEY`, `SECRET_KEY`
- `MINIO_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
- `REDIS_URL`, `CORS_ORIGINS`
- `FLASK_ENV`, `FLASK_APP`
- `JWT_ACCESS_TOKEN_EXPIRES`, `JWT_REFRESH_TOKEN_EXPIRES`

Frontend `.env.local`:
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`

## Tests
Tests live in `backend/tests/`. Run with `pytest` from the `backend/` directory.

| Test file | What it covers |
|---|---|
| `test_auth.py` | Registration, login, token refresh |
| `test_dataset_versioning.py` | Dataset version creation and lineage |
| `test_dataset_versioning_api.py` | API endpoints for versioning |
| `test_projects_api.py` | Project CRUD |
| `test_quality_gate.py` | Quality gate thresholds and verdict logic |

## Health Check
`GET /health` — returns `{"status": "ok"}` (note: no `/api/` prefix)
