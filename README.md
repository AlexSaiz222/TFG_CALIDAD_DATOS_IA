# Data Quality Evaluation Platform for AI Projects

This platform allows technical and business users to upload datasets, run quality evaluations using standard metrics, visualize results through interactive dashboards, and consume analyses via API. The main goal is to identify, monitor, and resolve data quality issues that could negatively impact data mining, machine learning, and artificial intelligence projects.

## Features

- **Authentication & Account Management**: Login, registration, and user management
- **Project & Dataset Management**: Upload, organize, and preview datasets
- **Rules/Metrics Configuration**: Configure quality metrics and thresholds
- **Evaluation Execution**: Run manual or scheduled quality assessments
- **Interactive Dashboards**: Visualize quality metrics and issues

## Tech Stack

- **Frontend**: React + TypeScript (Next.js)
- **Backend**: Flask (Python)
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Cache/Queue**: Redis
- **Infrastructure**: Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/AlexSaiz222/TFG_CALIDAD_DATOS_IA.git
   cd TFG_CALIDAD_DATOS_IA
   ```

2. Start the application:
   ```
   docker-compose up
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MinIO Console: http://localhost:9001
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## Project Structure

```
TFG_CALIDAD_DATOS_IA/
├── frontend/                # Next.js frontend application
├── backend/                 # Flask backend application
├── docker/                  # Docker configuration files
├── docs/                    # Documentation
└── docker-compose.yml       # Docker Compose configuration
```

