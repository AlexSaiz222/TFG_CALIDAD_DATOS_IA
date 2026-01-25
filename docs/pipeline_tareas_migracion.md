# Pipeline de Seguimiento: Migración Sonar-MVP

Este documento sirve como hoja de ruta y checklist para el seguimiento de la migración.

> **Estado Global:** 🚀 Pendiente de Inicio

---

## 📅 Fase 1: Cimientos del Backend (Core)
**Prioridad:** Alta | **Objetivo:** Establecer el nuevo modelo de datos y la lógica de "Aprobado/Fallido".

| Estado | Tarea | Descripción Técnica |
| :---: | :--- | :--- |
| [ ] | **1. Migración de Base de Datos** | Crear tabla `analysis_runs` (id, status, quality_score, gate_status, baseline_id) y `quality_gates` (config json). |
| [ ] | **2. Refactor de Modelo `Evaluation`** | Deprecar o migrar el modelo antiguo `Evaluation`. Asegurar que SQLAlchemy mapee a `AnalysisRun`. |
| [ ] | **3. Lógica de `QualityGate`** | Implementar función `evaluate_gate(results, config)` en Python. Debe retornar `PASSED` o `FAILED` según umbrales simples. |
| [ ] | **4. Adaptación de Endpoints** | Crear/Actualizar endpoint `POST /api/analysis` para crear un `AnalysisRun` en estado `PENDING`. |

---

## 🔄 Fase 2: Motor de Comparación (Worker)
**Prioridad:** Alta | **Objetivo:** Detectar "New Issues" comparando contra el pasado.

| Estado | Tarea | Descripción Técnica |
| :---: | :--- | :--- |
| [ ] | **1. Helper de Fingerprinting** | Crear función `generate_fingerprint(issue)` -> hash único basado en regla, columna y fila/valor. |
| [ ] | **2. Lógica de Baseline** | En el worker: buscar el último `AnalysisRun` con `gate_status='PASSED'` (o el último exitoso) para usar de base. |
| [ ] | **3. Detección de Diferencias** | Comparar fingerprints actuales vs. baseline. Marcar `is_new=True` si no existe en el set anterior. |
| [ ] | **4. Persistencia de Resultados** | Guardar métricas e issues en JSON (MinIO) o DB enlazados al `AnalysisRun`. |

---

## 🖥️ Fase 3: Experiencia de Usuario (Frontend)
**Prioridad:** Media | **Objetivo:** Visualizar el estado del Gate y la evolución.

| Estado | Tarea | Descripción Técnica |
| :---: | :--- | :--- |
| [ ] | **1. Tarjeta de Proyecto ("Semáforo")** | Actualizar Project Card para mostrar GRANDE el estado (Verde/Rojo) y el conteo de "New Issues". |
| [ ] | **2. Página de Detalle de Run** | Crear vista `/projects/{id}/runs/{runId}`. Mostrar cabecera con metadatos del analisis y estado del Gate. |
| [ ] | **3. Listado de Issues** | Tabla de issues con filtros. Por defecto mostrar solo "New Issues". Facetas por severidad. |
| [ ] | **4. Gráfico de Tendencia** | Sparkline o gráfico simple de `quality_score` en la tarjeta del proyecto. |

---

## 🧪 Fase 4: Verificación y Limpieza
**Prioridad:** Baja | **Objetivo:** Asegurar calidad y eliminar deuda técnica.

| Estado | Tarea | Descripción Técnica |
| :---: | :--- | :--- |
| [ ] | **1. Test End-to-End** | Ejecutar flujo completo: Subir CSV malo -> Ver Failed. Corregir CSV -> Ver Passed & New Issues = 0. |
| [ ] | **2. Limpieza de Código** | Eliminar endpoints y modelos antiguos (`Evaluation` si ya no se usa). |
| [ ] | **3. Documentación** | Actualizar README con la nueva arquitectura de `AnalysisRun`. |
