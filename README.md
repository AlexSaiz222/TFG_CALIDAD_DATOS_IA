# Data Quality Evaluation Platform for AI Projects

Platform for uploading datasets, configuring quality metrics, running evaluations, and visualising results through interactive dashboards. Built as a TFG (Final Degree Project).

## Features

- **Authentication & Account Management**: JWT-based login, registration, and user management
- **Project & Dataset Management**: Upload, organise, version, and preview datasets
- **Quality Metrics**: Configure rules and thresholds for completeness, uniqueness, syntactic accuracy, logical consistency, outlier detection, class balance, and currentness
- **Evaluations & Analysis Runs**: Run manual quality assessments; Sonar-Lite architecture generates immutable `AnalysisRun` snapshots per project
- **Quality Gates**: Configurable pass/fail thresholds per project; each run produces a `PASSED`, `WARNING`, or `FAILED` verdict
- **Dataset Versioning & Lineage**: Track parent–child dataset relationships with version numbers and tags
- **Privacy / Sensitive Columns**: Mark and obfuscate sensitive columns per dataset
- **Interactive Dashboards**: Quality score trends, issue diffs vs baseline, profiling (EDA)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Next.js) |
| Backend | Flask (Python) |
| Database | PostgreSQL |
| File Storage | MinIO (S3-compatible) |
| Task Queue | Celery + Redis |
| Infrastructure | Docker Compose |

## Services

| Service | Port | Purpose |
|---|---|---|
| frontend | 3000 | Next.js UI |
| backend | 5000 | Flask REST API |
| postgres | 5432 | Primary database (`dataquality`) |
| redis | 6379 | Celery broker + cache |
| minio | 9000/9001 | File storage + web console |
| celery | — | Async task worker |
| celery-beat | — | Scheduled task runner |
| flower | 5555 | Celery monitoring dashboard |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

```bash
git clone https://github.com/AlexSaiz222/TFG_CALIDAD_DATOS_IA.git
cd TFG_CALIDAD_DATOS_IA
cp backend/.env.example backend/.env   # configure env vars
docker-compose up --build
```

### Access

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend |
| http://localhost:5000 | Backend API |
| http://localhost:9001 | MinIO Console |
| http://localhost:5555 | Flower (Celery) |

## Project Structure

```
TFG_CALIDAD_DATOS_IA/
├── frontend/            # Next.js frontend
├── backend/             # Flask backend
├── docs/                # Architecture & metric documentation
└── docker-compose.yml
```

For detailed documentation see:
- `docs/ARQUITECTURA_SISTEMA.md` — full system architecture
- `backend/backend_info.md` — backend structure, models, and API
- `frontend/frontend_info.md` — frontend structure and components
- `docs/metricas/` — per-metric documentation
- `docs/quality_score_formula.md` — scoring formula
