# Migración Sonar-Lite - Checklist de Tareas

## Resumen
Migración del sistema de evaluación de calidad de datos a una arquitectura tipo SonarQube, con Quality Gates, tracking de issues y comparación entre análisis.

---

## Fase 1: Fundamentos de la Arquitectura ✅

### Tarea 1: Modelos de Datos ✅
- [x] Crear modelo `AnalysisRun` (snapshot de análisis)
- [x] Crear modelo `QualityGate` (configuración de umbrales)
- [x] Crear modelo `DataQualityIssue` (issues con fingerprint)
- [x] Definir enums `AnalysisStatus` y `QualityGateStatus`

**Archivos:** `backend/models/analysis.py`

---

### Tarea 2: Orquestación del Ciclo de Vida ✅
- [x] Crear `AnalysisRun` en estado PENDING al iniciar
- [x] Transición a RUNNING durante procesamiento
- [x] Transición a COMPLETED o FAILED al finalizar
- [x] Actualizar progreso y current_step durante ejecución

**Archivos:** `backend/services/evaluation_service.py`, `backend/tasks/evaluation_tasks.py`

---

### Tarea 3: Lógica del Quality Gate ✅
- [x] Implementar función `_evaluate_quality_gate()`
- [x] Criterio 1: Issues CRITICAL/BLOCKER → FAILED
- [x] Criterio 2: Score < 80% → FAILED
- [x] Criterio 3: Completeness < 90% → WARNING
- [x] Integrar en flujo de finalización

**Archivos:** `backend/services/evaluation_service.py`

---

### Tarea 4: Endpoints API ✅
- [x] `POST /api/evaluations/projects/<id>/analyze` - Iniciar análisis
- [x] `GET /api/evaluations/analysis/<run_id>` - Obtener análisis completo
- [x] `GET /api/evaluations/analysis/<run_id>/status` - Estado (polling)
- [x] `GET /api/evaluations/analysis/<run_id>/issues` - Lista de issues
- [x] `GET /api/evaluations/projects/<id>/analysis_runs` - Historial
- [x] `GET /api/evaluations/projects/<id>/latest_analysis` - Último análisis
- [x] Marcar endpoints legacy como DEPRECATED

**Archivos:** `backend/api/evaluations/routes.py`

---

## Fase 2: Tracking de Issues 🔄

### Tarea 1: Sistema de Fingerprinting ✅
- [x] Crear módulo `utils/fingerprint_utils.py`
- [x] Implementar `generate_issue_fingerprint()` (SHA256 determinista)
- [x] Funciones especializadas por tipo de issue
- [x] Integrar fingerprints en detección de issues
- [x] Asignar fingerprint a cada `DataQualityIssue`

**Archivos:** `backend/utils/fingerprint_utils.py`, `backend/services/evaluation_service.py`

---

### Tarea 2: Comparación con Baseline ⏳ PENDIENTE
- [X] Implementar `_compare_issues_with_baseline(analysis_run, baseline_run)`
- [X] Obtener fingerprints del baseline (análisis anterior)
- [X] Marcar issues como `is_new=True/False`
- [X] Calcular `new_issues_count` (issues nuevos)
- [X] Calcular `fixed_issues_count` (issues resueltos)
- [X] Integrar en flujo de finalización

**Archivos:** `backend/services/evaluation_service.py`

---

### Tarea 3: Selección Automática de Baseline ⏳ PENDIENTE
- [X] Implementar `_get_baseline_for_project(project_id)`
- [X] Buscar último `AnalysisRun` COMPLETED del proyecto
- [X] Asignar `baseline_analysis_id` al nuevo run
- [X] Manejar caso sin baseline (primer análisis)

**Archivos:** `backend/services/evaluation_service.py`

---

## Fase 3: Frontend Integration ⏳

### Tarea 1: Componente Quality Gate Badge ⏳ PENDIENTE
- [X] Crear componente visual para PASSED/FAILED/WARNING
- [X] Mostrar en dashboard de proyecto
- [X] Colores: verde (PASSED), rojo (FAILED), amarillo (WARNING)

**Archivos:** `frontend/src/components/QualityGateBadge.tsx`

---

### Tarea 2: Vista de Análisis ✅
- [x] Adaptar página de evaluación para usar `AnalysisRun`
- [x] Mostrar Quality Gate status prominente
- [x] Mostrar métricas y score
- [x] Lista de issues con indicador nuevo/recurrente

**Archivos:** `frontend/src/pages/evaluations/[id].tsx`

---

### Tarea 3: Historial de Análisis ✅
- [x] Crear vista de historial por proyecto
- [x] Mostrar evolución del Quality Gate
- [x] Gráfico de tendencia de score
- [x] Comparación entre runs

**Archivos:** `frontend/src/pages/projects/[id]/history.tsx`

---

## Fase 4: Configuración Avanzada ⏳

### Tarea 1: API de Quality Gate Config ⏳ PENDIENTE
- [ ] `GET /api/projects/<id>/quality_gate` - Obtener config
- [ ] `PUT /api/projects/<id>/quality_gate` - Actualizar umbrales
- [ ] Validación de umbrales

**Archivos:** `backend/api/projects/routes.py`

---

### Tarea 2: UI de Configuración ⏳ PENDIENTE
- [ ] Formulario para editar umbrales
- [ ] Preview de cómo afectaría al último análisis
- [ ] Guardar configuración

**Archivos:** `frontend/src/pages/projects/[id]/settings.tsx`

---

### Tarea 3: Leer Config desde BD ⏳ PENDIENTE
- [ ] Modificar `_evaluate_quality_gate()` para leer de `QualityGate`
- [ ] Fallback a valores por defecto si no hay config
- [ ] Cache de configuración

**Archivos:** `backend/services/evaluation_service.py`

---

## Progreso General

| Fase | Estado | Completado |
|------|--------|------------|
| Fase 1: Fundamentos | ✅ Completada | 4/4 tareas |
| Fase 2: Tracking | 🔄 En progreso | 1/3 tareas |
| Fase 3: Frontend | ⏳ Pendiente | 0/3 tareas |
| Fase 4: Config | ⏳ Pendiente | 0/3 tareas |

**Total: 5/13 tareas completadas (38%)**

---

## Próxima Tarea

**Fase 2 - Tarea 2: Comparación con Baseline**

Implementar la lógica para comparar issues del análisis actual con el baseline y determinar cuáles son nuevos vs recurrentes.
