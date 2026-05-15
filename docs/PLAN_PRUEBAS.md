# Plan de pruebas — DataQualAI

> Documento técnico operativo. El resumen formal para la memoria del TFG
> se encuentra en `docs/TFG/GITA_TFG/chapters/anexo-pruebas.tex`.
> Este fichero contiene el detalle ejecutable (suites, criticidad,
> herramientas y matriz de trazabilidad).

---

## 1. Propósito y audiencia

- **Propósito**: guiar la ejecución de pruebas manuales y automáticas de la
  plataforma DataQualAI, asegurando que cada incremento mantiene el nivel
  de calidad acordado.
- **Audiencia**: autor del TFG (rol QA Lead + Test Engineer), tutores y
  revisores externos.
- **Estado**: documento vivo, revisado al inicio de cada sprint.

## 2. Estrategia

Pirámide de pruebas adaptada a una arquitectura de tres capas:

```
        ▲    L4 — No funcionales (5 %)   carga, seguridad, observabilidad
       ◢ ◣   L3 — E2E / sistema (10 %)   flujos completos vía Playwright
     ◢     ◣ L2 — Integración API (35 %) Flask + DB en memoria + JWT
   ◢         ◣ L1 — Unitarias (50 %)     lógica pura, helpers, métricas
```

- Velocidad sobre exhaustividad: la suite local (L1 + L2) debe ejecutarse
  en **< 60 s**.
- Cada bug confirmado genera un test de regresión antes de cerrar la
  incidencia.
- Las suites L3 / L4 se ejecutan bajo demanda antes de cada hito.

## 3. Roles

| Rol | Persona | Responsabilidad |
|-----|---------|-----------------|
| QA Lead | Autor | Define estrategia, prioriza suites, mantiene este documento |
| Test Engineer | Autor | Implementa y mantiene `backend/tests/` |
| Manual Tester | Autor | Ejecuta checklists FE-01..FE-06 antes de cada hito |
| Stakeholders | Tutores | Validan criterios de aceptación |

## 4. Entornos

| Entorno | Stack | Uso | Datos |
|---------|-------|-----|-------|
| Local pytest | SQLite memoria, mock MinIO | L1 + L2 rápidas | Fixtures sintéticos |
| Docker compose | PostgreSQL + Redis + MinIO + Celery + Flower | Integración real, manual, NF | Datasets de `samples/` |
| Pre-producción | — | Trabajo futuro | — |

**Variables clave** (`backend/.env`): `DATABASE_URL`, `JWT_SECRET_KEY`,
`MINIO_*`, `REDIS_URL`. **Frontend** (`frontend/.env.local`):
`NEXT_PUBLIC_API_URL`.

## 5. Datos de prueba

Ubicación: `samples/`.

| Categoría | Descripción | Uso |
|-----------|-------------|-----|
| Limpios | CSV bien formados, sin nulos ni duplicados | Escenarios positivos |
| Contaminados | Nulos, duplicados, tipos mixtos, fuera de rango | Detección de issues |
| Grandes | 50–100 MB, miles de filas | Rendimiento |
| Sesgados | Distribución desigual de clases | Métrica de equilibrio |
| Sensibles (sintéticos) | Columnas PII simuladas | Sensitive columns / diversidad |

## 6. Suites detalladas

Cada suite se describe a alto nivel. Los casos individuales viven como
funciones `test_*` en los ficheros indicados.

### 6.1 Backend (Flask + Celery)

| ID | Suite / fichero | Tipo | Propósito | Crit. | Herramienta | Estado |
|----|-----------------|------|-----------|-------|-------------|--------|
| BE-01 | `backend/tests/test_auth.py` | Integración | Registro, login, refresh, logout, expiración de JWT | P1 | pytest | Implementada |
| BE-02 | `backend/tests/test_projects_api.py` | Integración | CRUD proyectos, configuración de métricas, autorización por owner | P1 | pytest | Implementada |
| BE-03 | `backend/tests/test_dataset_versioning.py` | Unitaria | Métodos del modelo Dataset (`get_root`, `get_version_history`, `get_latest_version`) | P2 | pytest | Implementada |
| BE-04 | `backend/tests/test_dataset_versioning_api.py` | Integración | Endpoints de versionado (`POST /datasets/{id}/versions`, listado de lineage) | P2 | pytest | Implementada |
| BE-05 | `backend/tests/test_quality_gate.py` | Integración | Lazy init de QualityGate, validación de umbrales, fallback a defaults | P1 | pytest | Implementada |
| BE-06 | `backend/tests/test_metrics_engine.py` + `test_metrics_engine_extended.py` | Unitaria | Las 8 clases de métricas (completitud, unicidad, actualidad, exactitud sintáctica, equilibrio de clases, diversidad, outliers, consistencia lógica) con casos canónicos y límite | P1 | pytest | Implementada (42 casos) |
| BE-07 | `backend/tests/test_analysis_run.py` | Integración | Creación de AnalysisRun, asociación con baseline, cálculo de new/fixed issues | P1 | pytest | **Pendiente** |
| BE-08 | `backend/tests/test_celery_tasks.py` | Integración | Ejecución asíncrona, reintentos, timeout y watchdog de evaluaciones | P2 | pytest + celery eager | **Pendiente** |
| BE-09 | `backend/tests/test_minio_storage.py` | Integración | Upload, download, presigned URLs, integridad (hash) | P2 | pytest + MinIO mock | **Pendiente** |
| BE-10 | `backend/tests/test_idor_authorization.py` | Integración | IDOR sobre datasets: lectura, escritura y enumeración cross-user; acceso sin JWT | P1 | pytest | Implementada (14 casos) |

### 6.2 Dominio Sonar-Lite

| ID | Suite | Tipo | Propósito | Crit. | Estado |
|----|-------|------|-----------|-------|--------|
| DM-01 | `backend/tests/test_fingerprinting.py` | Unitaria | Determinismo del fingerprint, case/whitespace, discriminación por columna/threshold/regla, orden-independencia | P1 | Implementada (28 casos) |
| DM-02 | `backend/tests/test_diff_baseline.py` | Integración | Diff respecto a baseline: cuenta correcta de new/fixed/recurrent, sin baseline, baseline vacío, mezcla | P1 | Implementada (7 casos) |
| DM-03 | `backend/tests/test_quality_score.py` | Unitaria | Fórmula QS con vectores canónicos: sin issues, una severidad, mezcla, cap de penalización (0.97), corrección de dimensionalidad (sqrt), tolerancia a severidades desconocidas, contrato del breakdown | P1 | Implementada (30 casos) |
| DM-04 | `backend/tests/test_quality_gate_verdict.py` | Integración | Tabla de verdad QualityGate × veredicto (PASSED/WARNING/FAILED), precedencia critical > score > new_issues, fallback a defaults | P1 | Implementada (12 casos) |

### 6.3 Frontend (Next.js)

Pruebas manuales guiadas con checklist; Playwright planificado para FE-07.

| ID | Suite | Propósito | Crit. | Estado |
|----|-------|-----------|-------|--------|
| FE-01 | Smoke de páginas públicas | Renderizado sin errores de `/login`, `/register`, `/recover` | P1 | Manual |
| FE-02 | Validación de formularios | Campos requeridos, formatos, mensajes de error, estado disabled | P2 | Manual |
| FE-03 | Subida de datasets | Drag&drop, validación de tamaño/tipo, progreso, manejo de error | P1 | Manual |
| FE-04 | Configuración de métricas | Edición `metrics_config`, persistencia tras recarga, valores inválidos | P2 | Manual |
| FE-05 | Ejecución y consulta de análisis | Lanzamiento de AnalysisRun, polling de estado, render del dashboard | P1 | Manual |
| FE-06 | Canvas de lineage | Render del árbol de versiones, navegación entre nodos, etiquetas | P3 | Manual |
| FE-07 | E2E Playwright | Automatización futura de FE-03 + FE-05 contra stack Docker | P2 | **Pendiente** |

### 6.4 No funcionales

| ID | Suite | Tipo | Propósito | Crit. | Estado |
|----|-------|------|-----------|-------|--------|
| NF-01 | Seguridad JWT | Seguridad | Tokens expirados, manipulados, reuso tras logout, algoritmo inseguro | P1 | Parcial (BE-01) |
| NF-02 | Autorización por recurso | Seguridad | Usuario A no accede a proyectos/datasets de B (IDOR) | P1 | Implementada (cubierta por BE-02 + BE-10) |
| NF-03 | Validación de entradas | Seguridad | Fuzzing ligero de cuerpos JSON; CSV con payloads (`=cmd`, SQL, XSS) | P2 | **Pendiente** |
| NF-04 | Auditoría de dependencias | Seguridad | `pip-audit`, `npm audit`, revisión manual | P2 | Manual |
| NF-05 | Rendimiento de análisis | Rendimiento | Tiempo de AnalysisRun sobre datasets de 10/50/100 MB | P3 | Manual |
| NF-06 | Latencia de endpoints | Rendimiento | p50/p95 de `GET /api/dashboard` y listados paginados con 1 000 elementos | P3 | **Pendiente** |

## 7. Criticidad y priorización

| Nivel | Significado | SLA de corrección |
|-------|-------------|-------------------|
| P1 | Bloquea uso del producto o compromete seguridad | Antes del siguiente merge |
| P2 | Degrada flujo principal con workaround | Mismo sprint |
| P3 | Afecta UX o flujos secundarios | Próximo sprint |
| P4 | Cosmético o mejora menor | Backlog |

## 8. Criterios de entrada y salida

**Entrada (ready to test)**
- Código integra y compila sin errores
- Migraciones aplicadas (`flask db upgrade`)
- HU con criterios de aceptación escritos

**Salida (exit criteria)**
- 100 % de casos P1 ejecutados y `passed`
- 0 defectos P1 abiertos
- Cobertura ≥ 70 % en `api/auth`, `api/datasets`, `tasks/`
- Suite smoke verde en `main`

## 9. Comandos de referencia

```bash
# Backend — completo
cd backend
pytest

# Subset
pytest tests/test_quality_gate.py -v

# Con cobertura
pytest --cov=. --cov-report=term-missing tests/

# Stack completo (para pruebas manuales / E2E)
docker-compose up --build

# Frontend — lint y build
cd frontend
pnpm lint
pnpm build
```

## 10. Gestión de defectos

- **Tracker**: GitHub Issues del repositorio.
- **Etiquetas**: `bug/P1`, `bug/P2`, `bug/P3`, `bug/P4`.
- **Plantilla mínima**: descripción, pasos, esperado, observado, entorno,
  capturas, severidad.
- **Cierre**: requiere test de regresión cuando aplique.

## 11. Reportes y KPIs

| KPI | Fuente | Objetivo | Frecuencia |
|-----|--------|----------|------------|
| Cobertura de líneas | `pytest --cov` | ≥ 70 % módulos críticos | Por sprint |
| Tasa de paso | Output pytest | ≥ 95 % | Por ejecución |
| Defectos P1 abiertos | GitHub Issues | 0 | Diario |
| Tiempo suite L1+L2 | pytest output | < 60 s | Por ejecución |
| Densidad de defectos | Issues / KLOC | Decreciente | Por sprint |

## 12. Matriz de trazabilidad HU ↔ Suite

> Plantilla. Completar conforme se ejecuta cada sprint.

| HU | Descripción breve | Suite(s) | Veredicto | Notas |
|----|-------------------|----------|-----------|-------|
| HU-01 | Registro y login | BE-01, FE-01 | PASS | — |
| HU-02 | CRUD de proyectos | BE-02, FE-02 | PASS | — |
| HU-03 | Subida de datasets | BE-09, FE-03 | PARCIAL | BE-09 pendiente |
| HU-04 | Versionado de datasets | BE-03, BE-04, FE-06 | PASS | — |
| HU-05 | Configuración de métricas | BE-02, FE-04 | PASS | — |
| HU-06 | Ejecución de análisis | BE-07, BE-08, FE-05 | PENDIENTE | Suites pendientes |
| HU-07 | Quality Gate | BE-05, DM-04 | PASS | DM-04 a reforzar |
| HU-08 | Dashboard | (manual) FE-05 | PASS | Sin automatización |
| HU-09 | Comparación con baseline | DM-01, DM-02 | PENDIENTE | — |
| HU-10 | Quality Score | DM-03 | PENDIENTE | — |
| HU-11 | Autorización por recurso | BE-10, NF-02 | PENDIENTE | — |
| HU-12 | Seguridad JWT | BE-01, NF-01 | PARCIAL | NF-01 a reforzar |
| HU-13 | Manual de usuario | (revisión) | PASS | Anexo manual |

## 13. Riesgos del plan

| ID | Riesgo | Mitigación |
|----|--------|------------|
| RP-01 | Cobertura limitada del frontend automatizado | Checklists manuales por hito + Playwright en backlog |
| RP-02 | Fragilidad de pruebas dependientes de Docker | Aislar L2 con SQLite en memoria; minimizar dependencias en CI |
| RP-03 | Datos sintéticos poco representativos | Incorporar datasets públicos (UCI, Kaggle) en validación |
| RP-04 | Falta de pruebas de carga sostenida | Documentado como trabajo futuro; mediciones puntuales con 100 MB |
| RP-05 | Test data drift entre versiones de SQLAlchemy / Flask | Fijar versiones en `requirements.txt` y revalidar en cada bump |

## 14. Definition of Done para QA

- Toda HU nueva incluye al menos un test L1 o L2.
- Toda corrección de bug P1/P2 incluye un test de regresión.
- La suite smoke pasa en `main` antes de cada hito (sprint review).
- El checklist manual de FE-01..FE-06 se ejecuta antes de la defensa.
- Los hallazgos manuales se registran en GitHub Issues con su etiqueta.

## 15. Trabajo futuro

- CI con GitHub Actions: pytest + coverage + ruff + eslint en cada PR.
- Integración con SonarCloud para tracking de cobertura y duplicación.
- Suite E2E Playwright contra stack Docker.
- Pruebas de carga con k6 o Locust.
- Auditoría de accesibilidad WCAG AA.

---

**Última revisión**: 2026-05-15.
