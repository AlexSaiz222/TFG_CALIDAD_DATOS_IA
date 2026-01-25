# Guía de Evolución del MVP hacia un "SonarCloud de Calidad de Datos"

> Objetivo: evolucionar el MVP actual hacia una plataforma de calidad de datos con experiencia tipo SonarCloud:
> - Proyectos organizados por “fuente de datos / pipeline”
> - Evaluaciones automáticas (manuales, por PR, programadas, por API)
> - Resultados consistentes y comparables en el tiempo
> - Quality Gates (aprobado / fallido) y “new issues”
> - Issues trazables, priorizables, con severidad, reglas y remediación
> - Integración CI/CD y “decoración” de PRs
> - Extensibilidad (plugins / reglas / perfiles de calidad)

---

## 1) Estado actual del MVP (punto de partida)

La plataforma actual ya tiene un core muy sólido:

### Stack y arquitectura actual
- Frontend: Next.js + TS
- Backend: Flask + SQLAlchemy
- Procesamiento: Celery + Redis
- Persistencia: PostgreSQL
- Almacenamiento de datasets: MinIO (S3 compatible)
- Modelo funcional: Project → Dataset → Evaluation → Issues

✅ Funcionalidades core implementadas
- Subida de datasets (CSV/Excel/JSON/Parquet)
- Evaluación de calidad asíncrona (Celery)
- Métricas: Completeness, Uniqueness, Consistency (regex), Outliers (IQR/Z-score)
- Quality score global
- Issues con severidad + columnas/filas afectadas

📌 Pendiente principal
- Visualización avanzada y experiencia de “plataforma”
- Comparación entre evaluaciones
- Programación recurrente
- CI/CD real y “gates”

---

## 2) Modelo SonarCloud: conceptos que debes copiar

SonarCloud funciona “bien” porque todo está sistematizado en **4 pilares**:

### 2.1 Entidades clave (equivalencias)
| SonarCloud | Tu plataforma (recomendación) |
|-----------|--------------------------------|
| Organization | Workspace / Organization |
| Project | Project (ok) |
| Branch | Dataset branch / data version / pipeline stage |
| Pull Request | “Data PR” / “Evaluation run” contra baseline |
| Analysis | Evaluation |
| Measures | Results (métricas) |
| Issues | Issues (ok) |
| Rules | Reglas de validación (futuro) |
| Quality Profile | Perfil de reglas por proyecto |
| Quality Gate | Condiciones para aprobar/rechazar |

**Idea clave Sonar:** las evaluaciones NO son “un informe suelto”, son un “analysis run”
que se guarda con:
- contexto (project, branch, commit, autor, run_id)
- baseline (análisis anterior o referencia)
- medidas y issues
- evaluación de quality gate (PASSED/FAILED)

---

## 3) Norte arquitectónico (Target Architecture)

### 3.1 Separación de responsabilidades (muy Sonar-like)
El backend debería partirse en 3 capas clarísimas:

1) **Orchestrator API**
- Recibe una “solicitud de análisis”
- Valida configuración
- Crea un `AnalysisRun`
- Encola Celery
- Expone el estado (progress + logs)

2) **Scan Engine (motor)**
- Carga dataset (MinIO / DB / connector)
- Ejecuta reglas/métricas (plugin system)
- Genera:
  - Measures (numéricos / agregados)
  - Issues (por regla y severidad)
  - Artifacts (report JSON, muestras, perfiles)

3) **Evaluation Layer**
- Quality Gate: aprobado / fallido
- New issues vs baseline
- Comparaciones y tendencias

---

## 4) Diseño de datos recomendado para sonarizar tu sistema

Tu modelo actual sirve, pero para ser “SonarCloud-like” necesitas añadir un par de tablas/relaciones.

### 4.1 Nueva entidad: `analysis_run`
Representa una ejecución de análisis, con metadatos de CI y versionado.

**Campos sugeridos**
- id (PK)
- project_id
- dataset_id (nullable si el análisis viene de un conector)
- status: pending | running | completed | failed
- trigger_type: manual | schedule | api | ci
- branch / environment: dev | staging | prod (o string libre)
- commit_sha (si viene de CI)
- baseline_run_id (FK a analysis_run anterior)
- started_at / completed_at
- report_path (MinIO): JSON con output completo
- quality_gate_status: passed | failed
- quality_score (ya lo tienes pero aquí es mejor)
- measures_summary (JSON corto para dashboard)
- logs_path (MinIO)

👉 `Evaluation` en tu sistema puede evolucionar a `AnalysisRun` o convivir temporalmente.

### 4.2 Tabla: `rule` (equivalente a Sonar rules)
Ahora mismo tus métricas están “hardcodeadas” en `evaluation_service`.
Para sonarizar: conviértelas en reglas registrables.

**Campos sugeridos**
- id
- key (ej: completeness.threshold)
- name
- category (completeness, uniqueness, consistency...)
- severity_default: info | minor | major | critical | blocker
- params_schema (JSON)
- description
- remediation_hint (texto/markdown)

### 4.3 Tabla: `quality_profile`
Es un conjunto de reglas habilitadas con configuración.

- id
- project_id
- name
- rules_config (JSON) o tabla intermedia profile_rule

**profile_rule**
- profile_id
- rule_id
- enabled
- severity_override
- params_override

### 4.4 Tabla: `quality_gate`
Define condiciones de aprobado/fallo.

- id
- project_id
- name
- conditions (JSON)
  - Ej: completeness >= 0.95
  - outliers_ratio <= 0.02
  - new_issues_critical == 0

Y opcional:
- `gate_condition` normalizada para queries eficientes.

---

## 5) Cómo estructurar evaluaciones "tipo Sonar"

### 5.1 Concepto: análisis con baseline
En SonarCloud casi todo se interpreta relativo a un baseline:
- comparación con análisis previo
- “new issues” en vez de issues totales

#### Recomendación:
Implementa en cada `AnalysisRun`:
- `baseline_run_id`: el último análisis exitoso en el mismo `project + branch`
- derivar:
  - new_issues_count
  - new_critical_issues
  - delta_quality_score
  - delta_measures (completitud sube/baja, etc.)

---

## 6) Quality Gate (lo más “SonarCloud” de todo)

Un gate define si un análisis es “mergeable” o “deployable”.

### 6.1 Gate mínimo recomendado (v1)
- **Critical issues nuevas = 0**
- **Completeness global >= 95%**
- **Duplicados <= X%**
- **Columnas con consistency invalid > 0 → fail**

### 6.2 Gate por “New Code” aplicado a datos
En datos, el equivalente a “new code” puede ser:
- nuevas filas desde última versión
- nuevo dataset versionado
- partición temporal (últimos 7 días)
- delta de dataset (si implementas diff)

**Primera aproximación simple**:
- Baseline run = análisis anterior
- New issues = issues que NO existían antes (por rule_id + fingerprint)

---

## 7) Issues Sonar-like (fingerprint + lifecycle)

Ahora mismo tienes issues con:
- severity
- description
- affected_cols / affected_rows

Para sonarizar, añade:

### 7.1 Fingerprint (clave única del issue)
Necesitas poder decir: “este issue ya existía antes” (para new issues).

**Campos sugeridos**
- fingerprint (hash)
- rule_id
- location:
  - dataset_id
  - column_name
  - row_range (opcional)
- first_seen_run_id
- last_seen_run_id
- status: open | confirmed | resolved | wont_fix

**Cómo calcular fingerprint (ejemplo)**
hash(rule_key + dataset + column + pattern + sample_value_type)

### 7.2 Issue lifecycle
- OPEN cuando aparece
- CONFIRMED si usuario lo valida (futuro)
- RESOLVED si ya no aparece en análisis posteriores
- WONT_FIX si se decide ignorarlo

---

## 8) Organización de métricas y plugins (motor extensible)

Hoy tu motor está dentro de `evaluation_service`.
Para escalar como Sonar, debes convertir cada métrica en “plugin/regla”.

### 8.1 Interfaz base de regla (Rule API)
Define una interfaz estándar:

- `metadata()` -> key, name, category, params_schema
- `run(df, context, params)` -> measures + issues

**Context** debe traer:
- project config
- dataset schema
- sample limits
- baseline reference (si aplica)

### 8.2 Resultado estándar del motor
Todos los plugins devuelven el mismo formato:

```json
{
  "measures": {
    "completeness.global": 0.982,
    "uniqueness.rows": 0.993
  },
  "issues": [
    {
      "rule_key": "consistency.email_format",
      "severity": "major",
      "column": "email",
      "description": "Emails inválidos detectados",
      "sample": ["foo@", "bar.com"],
      "fingerprint": "..."
    }
  ],
  "artifacts": {
    "samples_path": "s3://.../samples.json"
  }
}
```

---

## 9) “Scanner” estilo Sonar (clave para CI/CD)

SonarCloud no se usa desde una web: se usa desde un **scanner** en pipeline.

### 9.1 Objetivo v1: CLI `dqscan`
Crea un CLI muy simple (Python click/typer):
- lee un `dq-project.yml`
- sube dataset o referencia
- dispara análisis vía API
- espera resultado
- devuelve exit code:
  - 0 si gate PASSED
  - 1 si gate FAILED

### 9.2 Archivo de config por proyecto (tipo sonar-project.properties)
Ejemplo:

```yaml
projectKey: my_project
branch: main
dataset:
  path: ./data/train.csv
profile: default
gate: default
rules:
  completeness:
    threshold: 0.95
  outliers:
    method: iqr
    max_ratio: 0.02
```

---

## 10) UI/UX Sonar-like (cómo debería sentirse)

### 10.1 Pantallas obligatorias (MVP sonarizado)
1) **Project Overview**
- Quality Gate status (PASSED/FAILED)
- Quality Score + tendencia
- New issues vs total
- Últimos análisis

2) **Issues**
- filtros por severity, rule, columna
- estado open/resolved
- “since baseline”

3) **Measures**
- métricas por categoría
- desglose por columna
- top columns worst quality

4) **Analysis details**
- log de ejecución
- medidas exactas
- artifacts descargables

### 10.2 “Decoración” de PR (fase 2)
- comentario automático en PR con:
  - gate status
  - new issues
  - link al analysis run

---

## 11) Plan de migración (Tareas por fases)

> Estas tareas son el “camino Sonar”. Están ordenadas por impacto y dependencia.

---

### Fase 0 — Preparación (limpieza para escalar) [1-2 sprints]
✅ Objetivo: aislar motor de evaluación y estandarizar outputs

**Tareas**
- [ ] Renombrar `Evaluation` -> `AnalysisRun` (o crear nuevo modelo y migrar)
- [ ] Definir contrato estándar: measures/issues/artifacts
- [ ] Añadir `trigger_type`, `branch`, `baseline_run_id`
- [ ] Guardar `report.json` completo en MinIO (no solo results JSON en DB)
- [ ] Implementar `analysis logs` (texto simple) y guardarlo en MinIO

**Resultado**
- Estructura de análisis consistente y rastreable

---

### Fase 1 — Quality Gate + Baseline + New Issues [1 sprint]
✅ Objetivo: experiencia Sonar real (PASSED/FAILED + new issues)

**Tareas**
- [ ] Implementar baseline resolution:
  - último run exitoso por project+branch
- [ ] Fingerprint de issues
- [ ] Calcular new_issues vs baseline
- [ ] Añadir tabla `quality_gate` + condiciones JSON
- [ ] Evaluación de gate al final del run
- [ ] Devolver estado de gate en API + UI

**Resultado**
- "Esto pasa / no pasa" como Sonar

---

### Fase 2 — Sistema de Rules/Profiles (plugin engine) [2 sprints]
✅ Objetivo: reglas configurables como SonarCloud

**Tareas**
- [ ] Crear entidad `rule`
- [ ] Migrar métricas actuales a reglas (4 plugins)
- [ ] Crear `quality_profile`
- [ ] UI para activar/desactivar reglas y configurar params
- [ ] Control de severidad por regla (override)
- [ ] Issue remediation hints por regla (texto de ayuda)

**Resultado**
- Motor extensible, mantenible y escalable

---

### Fase 3 — Scanner CLI + Integración CI/CD (core sonar) [1-2 sprints]
✅ Objetivo: que se use desde pipeline y no solo desde UI

**Tareas**
- [ ] Crear CLI `dqscan`
- [ ] API endpoint: `POST /api/analysis/run`
- [ ] API endpoint: `GET /api/analysis/{id}` + gate status
- [ ] Exit codes por gate
- [ ] Ejemplos ready-to-use:
  - GitHub Actions
  - GitLab CI
- [ ] Token de autenticación para CI (service accounts)

**Resultado**
- Producto usable en equipos reales

---

### Fase 4 — Comparación y tendencias (lo que engancha) [1-2 sprints]
✅ Objetivo: dashboards Sonar-like de evolución

**Tareas**
- [ ] Gráficas de evolución quality_score
- [ ] Evolución por rule_key (completeness, duplicates...)
- [ ] Top regressions vs baseline
- [ ] Comparador run A vs run B
- [ ] “Leak period” de datos (últimos N días / versión)

**Resultado**
- Insights, no solo reportes

---

### Fase 5 — Enterprise features (nice-to-have)
- [ ] Programación de análisis (Celery beat) por proyecto
- [ ] Notificaciones (email/slack)
- [ ] Permisos avanzados (roles por proyecto)
- [ ] API pública documentada (OpenAPI)
- [ ] Multi-tenancy real (organizations/workspaces)
- [ ] Conectores (DB, BigQuery, S3, Kafka...)

---

## 12) Checklist final: “¿Ya soy SonarCloud-like?”

✅ Para decir que lo lograste, deberías tener:

- [ ] AnalysisRun versionado con baseline y branch
- [ ] Quality Gate con PASSED/FAILED
- [ ] New issues calculadas vs baseline
- [ ] Fingerprint + lifecycle de issues
- [ ] Reglas (plugins) + perfiles por proyecto
- [ ] Un scanner CLI para CI/CD
- [ ] Dashboards con tendencias y comparativas
- [ ] UI con pages: Overview / Issues / Measures / Run details

---

## 13) Recomendación de prioridades (si solo puedes hacer 5 cosas)

1) Baseline + New issues
2) Quality Gate
3) Fingerprint + lifecycle
4) Rule engine (plugins)
5) Scanner CLI

Ese orden te deja “casi SonarCloud” sin perderte en features.

---

## 14) Notas técnicas de implementación (consejos rápidos)

- DB: guarda solo lo consultable; lo pesado a MinIO (report/artifacts).
- Performance: trabaja por columnas y usa sampling configurable.
- Trazabilidad: cada issue debe poder “sobrevivir” a runs (fingerprint).
- Consistencia de outputs: si cambias el formato, versiona el report (report_version).
- Evita acoplar UI a estructura interna: usa DTOs y endpoints agregados para dashboards.

---

## Fin

Este documento define el camino para migrar el MVP hacia una plataforma tipo SonarCloud:
un sistema estándar de análisis, gates, baseline, issues, reglas, perfiles y uso desde CI/CD.
