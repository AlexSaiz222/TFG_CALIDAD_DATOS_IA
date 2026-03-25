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
pytest                          # Run all tests
pytest tests/test_dataset_versioning.py   # Single test file
pytest --cov=. tests/          # With coverage
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
- `api/projects/` — Project CRUD
- `api/datasets/` — Dataset upload, versioning, profiling
- `api/metrics/` — Quality metric definitions and templates
- `api/evaluations/` — Run and retrieve quality evaluations
- `api/admin/` — Admin utilities
- `models/` — SQLAlchemy ORM models
- `tasks/` — Celery async tasks (evaluation execution)
- `migrations/` — Flask-Migrate Alembic migrations
- `middleware/` — Error handlers, request logging, evaluation watchdog

### Frontend Structure (`frontend/src/`)
- `pages/` — Next.js file-based routing (datasets, projects, metrics, evaluations, auth)
- `components/` — Reusable UI components; `DataProfilingTab.tsx` is the main EDA/profiling UI (large, ~85KB)
- `services/` — API client functions
- `contexts/` — React contexts (AuthContext for auth state)
- `types/index.ts` — Shared TypeScript types for all entities

### Data Flow for Evaluations
1. User uploads dataset → stored in MinIO, metadata in PostgreSQL
2. User configures metrics on a project
3. Evaluation triggered → Celery task runs asynchronously
4. Results stored in PostgreSQL, viewable in dashboard

### Key Models
- `User` → owns `Projects`
- `Project` → has `Datasets` and `Metrics` (metrics_config stored as JSONB)
- `Dataset` → has versions, schema info, `sensitive_columns` (JSONB), links to MinIO file
- `Metric` → quality rule definition with thresholds
- `Evaluation` / `EvaluationRun` → results of running metrics against a dataset

## Environment
Backend `.env` (at `backend/.env`) — not committed, configure from these keys:
- `DATABASE_URL`, `JWT_SECRET_KEY`, `SECRET_KEY`
- `MINIO_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `REDIS_URL`, `CORS_ORIGINS`

## Tests
Tests live in `backend/tests/`. The main test files cover dataset versioning and quality gates. Run with `pytest` from the `backend/` directory.

## Current Feature Branch
`plantillas_ocultacion_privacidad` — Adding privacy/data obfuscation templates: sensitive column tracking on datasets and metric templates for privacy rules.
