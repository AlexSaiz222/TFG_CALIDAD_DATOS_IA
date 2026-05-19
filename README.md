<div align="center">
  <img src="https://img.shields.io/badge/Status-Completed-success" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/Academic-TFG-orange" alt="TFG" />
  <br />
  
  <h1 align="center">DataQual</h1>
  <p align="center">
    <strong>A Full-Stack Platform for Automated Data Quality Evaluation in AI Projects</strong>
    <br />
    <em>Built as a TFG (Final Degree Project) by Alejandro M. Saiz</em>
  </p>
  
  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-key-features">Features</a> •
    <a href="#%EF%B8%8F-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-documentation">Documentation</a>
  </p>
</div>

---

## 📖 About The Project

*“Garbage in, garbage out”* — Artificial intelligence models are only as reliable as the data they are trained on. **DataQual** is a comprehensive, open-source web platform designed to automate the evaluation of data quality in Artificial Intelligence (AI) and Machine Learning (ML) projects. 

Inspired by code-quality tools like SonarQube, DataQual introduces the concept of **Quality Gates** to data engineering. It allows multidisciplinary teams to audit datasets without writing code, track quality degradation over time through deterministic SHA-256 fingerprinting, and ensure compliance with strict regulations like the GDPR and the European AI Act.

## 🌟 Key Features

- **📊 Comprehensive Quality Metrics**: Evaluates datasets against seven distinct dimensions defined by the **ISO/IEC 5259**, **ISO/IEC 25012**, and **ISO/IEC 25024** standards (Completeness, Uniqueness, Syntactic Accuracy, Logical Consistency, Outlier Detection, Class Balance, and Currentness).
- **🚦 Automated Quality Gates**: Define strict, customizable pass/fail thresholds (`PASSED`, `WARNING`, `FAILED`). Know instantly if your data is ready for model training.
- **📈 Exploratory Data Profiling (EDA)**: Automatically generates statistical profiles, distributions, boxplots, histograms, and correlation matrices to understand your data at a glance.
- **🔄 Dataset Versioning & Lineage**: Manage parent-child dataset relationships, track history, and monitor metric evolution over time to prevent data drift.
- **🔒 Privacy First**: Automatically masks and obfuscates user-defined sensitive columns to prevent PII exposure in reports and interfaces.
- **⚡ Asynchronous Execution**: Powered by Celery and Redis to handle heavy data processing in the background without blocking the user interface.
- **🌍 Multi-language UI**: Seamless real-time localization in both English and Spanish.

## 🛠️ Tech Stack

DataQual is built with a modern, scalable microservices architecture.

### Frontend
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### Backend
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)

### Data & Infrastructure
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white)

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AlexSaiz222/TFG_CALIDAD_DATOS_IA.git
   cd TFG_CALIDAD_DATOS_IA
   ```

2. **Configure Environment Variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env if necessary. Default values are pre-configured for local testing.
   ```

3. **Deploy the Architecture**
   ```bash
   docker-compose up --build
   ```

### Accessing the Platform

Once the containers are successfully built and running, you can access the services at:

| Service | URL | Description |
|---------|-----|-------------|
| 🖥️ **Frontend Interface** | [http://localhost:3000](http://localhost:3000) | Main User UI |
| 🔌 **Backend API** | [http://localhost:5000](http://localhost:5000) | Flask REST API endpoints |
| 🗄️ **MinIO Console**| [http://localhost:9001](http://localhost:9001) | S3-compatible Object Storage |
| 📈 **Flower Dashboard** | [http://localhost:5555](http://localhost:5555) | Celery task monitoring |

## 🏗️ Architecture & Project Structure

The project is organized into core domains, deployed as 8 independent Docker containers orchestrating together:

```text
TFG_CALIDAD_DATOS_IA/
├── frontend/            # Next.js UI application
├── backend/             # Flask REST API, Services & Celery Workers
├── docs/                # Architecture, API & Metrics documentation
│   └── TFG/             # Complete Academic Thesis (LaTeX)
├── docker/              # Docker configuration files
└── docker-compose.yml   # Infrastructure orchestration
```

## 📚 Documentation

Deep-dive documentation is available within the `docs/` directory:
- 🏛️ [System Architecture](docs/ARQUITECTURA_SISTEMA.md)
- ⚙️ [Backend API & Models](backend/backend_info.md)
- 🎨 [Frontend Components](frontend/frontend_info.md)
- 📐 [Quality Metrics Catalog](docs/metricas/)
- 🧮 [Quality Score Formula](docs/quality_score_formula.md)

**🎓 Academic Thesis:**
The complete academic documentation detailing the research, methodologies, and technical implementations can be found in `docs/TFG/GITA_TFG/`.

## 👨‍💻 Author

**Alejandro Manuel Saiz García**  
🎓 University: UCLM (Universidad de Castilla-La Mancha)  
💻 Degree: Information Systems (Tecnologías y Sistemas de Información)  
📧 Email: alejandrosaiztecno2016@gmail.com
