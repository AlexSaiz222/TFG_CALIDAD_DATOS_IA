# Hallazgos de la Primera Evaluación — Plan de Correcciones

**Fecha:** 14/03/2026  
**Dataset evaluado:** `clientes_v1_desastre.csv` (35 filas, 8 columnas)  
**Resultado obtenido:** Quality Score 90%, Quality Gate WARNING, 11 issues  
**Resultado esperado:** Quality Score ~35%, Quality Gate FAILED, issues de completeness + uniqueness + outliers

---

## Resumen Ejecutivo

La primera evaluación revela **5 bugs funcionales** y **3 mejoras necesarias** antes de continuar con el flujo de pruebas. El problema principal es que el motor de evaluación solo analiza 2 de las 4 métricas disponibles por defecto, produciendo un score inflado que no refleja la verdadera calidad del dataset.

---

## BUGS (Hay que corregirlos antes de continuar)

### BUG-1: Pestaña "Issues" del dataset muestra vacío ❌

**Severidad:** Alta  
**Ubicación:** `frontend/src/pages/datasets/[id].tsx` línea 177  
**Síntoma:** La pestaña Issues del dataset dice "No issues found in the latest evaluation" pese a que existen 11 issues.

**Causa raíz:** El API devuelve la estructura `{ success: true, data: { issues: [...], count: 11 } }`. El frontend extrae `response.data.data` que es `{ issues: [...], count: 11 }` (un **objeto**, no un array). Al comprobar `Array.isArray(issuesData)` devuelve `false` y se establece `setIssues([])`.

```typescript
// ACTUAL (línea 177):
const issuesData = issuesResponse?.data?.data || issuesResponse?.data || [];
// issuesData = { issues: [...], count: 11 } → NO es un array → setIssues([])

// CORRECCIÓN:
const issuesData = issuesResponse?.data?.data?.issues || issuesResponse?.data?.issues || [];
```

**Archivo a modificar:** `frontend/src/pages/datasets/[id].tsx`

---

### BUG-2: Quality Score inflado — 90% en vez de ~35% ❌

**Severidad:** Crítica  
**Ubicación:** `backend/api/datasets/routes.py` líneas 962-978 (métricas por defecto)  
**Síntoma:** El score del dataset "desastre" es 90.2%, cuando debería ser ~35%.

**Causa raíz:** Las métricas por defecto solo incluyen `completeness` y `uniqueness` (la tercera, `consistency`, es un no-op sin parámetros). El score se calcula como:

```
Score = avg(completeness × 1.0, uniqueness × 1.0)
      = avg(0.889, 0.914)
      = 0.90  ← ¡Esto NO refleja la calidad real!
```

Los **outliers** (salario = -5000, salario = 999999999) y los **errores de formato** (fechas inválidas como "no-es-fecha") **no se evalúan** porque no están en las métricas por defecto.

**Corrección necesaria:** Añadir `outliers` a las métricas por defecto en `backend/api/datasets/routes.py`:

```python
default_metrics = [
    {"id": "completeness", "parameters": {}, "weight": 1.0},
    {"id": "uniqueness", "parameters": {}, "weight": 1.0},
    {"id": "outliers", "parameters": {"method": "iqr", "factor": 1.5}, "weight": 1.0},
]
```

**Archivos a modificar:**
- `backend/api/datasets/routes.py` — añadir outliers a default_metrics
- `frontend/src/services/api.ts` línea 1056-1058 — sincronizar el fallback del frontend

---

### BUG-3: Quality Gate da WARNING en vez de FAILED ❌

**Severidad:** Alta  
**Ubicación:** `backend/services/evaluation_service.py` método `_evaluate_quality_gate()`  
**Síntoma:** El dataset "desastre" recibe WARNING, cuando debería recibir FAILED.

**Causa raíz:** Consecuencia directa del BUG-2. Como el score es 90% y el threshold es 80%, pasa el check de score. Solo obtiene WARNING porque completeness (88.9%) < min_completeness (85%).

Si se corrige el BUG-2 (añadiendo outliers), el score bajaría considerablemente y el Quality Gate daría FAILED correctamente.

**Corrección:** Se resuelve al corregir BUG-2. Verificar tras el fix.

---

### BUG-4: Pestaña Issues del dataset — "View Issues" tampoco funciona ❌

**Severidad:** Media  
**Ubicación:** `frontend/src/pages/datasets/[id].tsx` línea 789  
**Síntoma:** El botón "View Issues" en la tabla de evaluaciones también falla.

**Causa raíz:** Mismo problema que BUG-1 pero en otro handler:

```typescript
// ACTUAL (línea 789):
setIssues(response.data);
// response.data = { success: true, data: { issues: [...], count: N } }
// Esto establece un OBJETO como issues, no un array

// CORRECCIÓN:
const issuesData = response.data?.data?.issues || response.data?.issues || [];
setIssues(Array.isArray(issuesData) ? issuesData : []);
```

**Archivo a modificar:** `frontend/src/pages/datasets/[id].tsx`

---

### BUG-5: Score sin redondear en pestaña Versiones ❌

**Severidad:** Baja  
**Ubicación:** `frontend/src/components/DatasetVersionHistory.tsx` línea 285  
**Síntoma:** Muestra `90.17857142857142%` en vez de `90.2%`.

**Causa raíz:** Se muestra el valor raw sin formatear:

```tsx
// ACTUAL:
{version.latestAnalysis?.quality_score != null
  ? `${version.latestAnalysis.quality_score}%`
  : 'Sin análisis'}

// CORRECCIÓN:
{version.latestAnalysis?.quality_score != null
  ? `${Number(version.latestAnalysis.quality_score).toFixed(1)}%`
  : 'Sin análisis'}
```

**Archivo a modificar:** `frontend/src/components/DatasetVersionHistory.tsx`

---

## MEJORAS NECESARIAS (Para que el flujo de pruebas sea coherente)

### MEJORA-1: Métrica de consistencia por defecto no hace nada

**Ubicación:** `backend/services/evaluation_service.py` líneas 531-594  
**Problema:** La métrica `consistency` requiere parámetros `column` y `pattern` explícitos. Sin ellos, no evalúa nada. Esto significa que la métrica "consistency" incluida en los defaults es inútil.

**Opciones:**
1. **Opción A (rápida):** Eliminar `consistency` de las métricas por defecto ya que sin parámetros es un no-op. Dejar que el usuario la configure manualmente.
2. **Opción B (mejor):** Implementar auto-detección de inconsistencias básicas:
   - Columnas que parecen fechas pero tienen valores no-fecha (ej. "no-es-fecha")
   - Columnas que parecen emails pero tienen valores inválidos
   - Columnas numéricas con valores no numéricos

**Recomendación:** Opción A para desbloquear ahora, Opción B como tarea futura.

---

### MEJORA-2: Conteo de "Issues Críticos" es confuso

**Ubicación:** `backend/services/evaluation_service.py` línea 744  
**Problema:** El `critical_issues_count` cuenta issues con severidad `high`:

```python
critical_issues_count = sum(1 for i in issues if i.get('severity') in ['high', 'critical'])
```

Pero el Quality Gate en línea 134 solo busca `critical` y `blocker`:

```python
if severity in {'critical', 'blocker'} or (severity == 'high' and 'critical' in ...)
```

**Resultado:** El proyecto muestra "Issues Críticos: 4" pero el Quality Gate no falla por ellos, lo cual es confuso para el usuario.

**Corrección:** Alinear la terminología. Si `high` se considera crítico para el conteo, también debe serlo para el Quality Gate. O viceversa: si el gate solo busca `critical`, el conteo debe hacer lo mismo.

---

### MEJORA-3: "Affected Rows" muestra 0 para todos los issues en la vista del proyecto

**Problema:** En la vista de análisis del proyecto (`/projects/[id]/runs/[runId]`), la columna "Filas" muestra `0` para todos los issues. Solo el issue de filas duplicadas tiene `affected_rows` con datos reales.

**Corrección:** Para issues de tipo completeness/uniqueness por columna, calcular y guardar el conteo de filas afectadas (filas con nulos, etc.). O mostrar "—" en vez de "0" cuando `affected_rows` es null.

---

## PLAN DE ACCIÓN (Orden de ejecución)

| # | Tarea | Tipo | Prioridad | Archivos |
|:-:|-------|:----:|:---------:|----------|
| 1 | Añadir `outliers` a métricas por defecto | BUG-2 | 🔴 Crítica | `backend/api/datasets/routes.py`, `frontend/src/services/api.ts` |
| 2 | Corregir extracción de issues en dataset page | BUG-1 | 🔴 Alta | `frontend/src/pages/datasets/[id].tsx` (línea 177) |
| 3 | Corregir botón "View Issues" en dataset page | BUG-4 | 🟡 Media | `frontend/src/pages/datasets/[id].tsx` (línea 789) |
| 4 | Eliminar `consistency` sin parámetros de defaults | MEJORA-1 | 🟡 Media | `backend/api/datasets/routes.py` |
| 5 | Redondear score en historial de versiones | BUG-5 | 🟢 Baja | `frontend/src/components/DatasetVersionHistory.tsx` |
| 6 | Alinear conteo de issues críticos con Quality Gate | MEJORA-2 | 🟢 Baja | `backend/services/evaluation_service.py` |
| 7 | Mostrar "—" en vez de "0" para affected_rows null | MEJORA-3 | 🟢 Baja | `frontend/src/pages/projects/[id]/runs/[runId].tsx` |
| 8 | Verificar Quality Gate tras fixes 1-4 | BUG-3 | 🔴 Alta | Verificación manual |

---

## RESULTADO ESPERADO TRAS CORRECCIONES

Con outliers incluido por defecto, para `clientes_v1_desastre.csv`:

| Métrica | Valor estimado | Peso |
|---------|:--------------:|:----:|
| Completeness | ~88.9% | 1.0 |
| Uniqueness | ~91.4% | 1.0 |
| Outliers | ~60-70% (salarios extremos) | 1.0 |

```
Score estimado = avg(0.889, 0.914, ~0.65) ≈ 0.48 → ~48%
```

Con un score de ~48%, el Quality Gate con threshold 80% dará **FAILED** ✅

> **Nota:** Para alcanzar el ~35% esperado en la guía, se necesitaría además implementar la auto-detección de consistencia (MEJORA-1 Opción B), lo que penalizaría fechas inválidas y emails corruptos. Esto puede ser una tarea posterior.
