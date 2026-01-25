# Guía de Migración Simplificada: "SonarCloud MVP"

> **Objetivo:** Transformar la plataforma actual en un sistema de Calidad de Datos con experiencia "SonarCloud" (Aprobado/Fallido, Evolución, Nuevos Issues), pero con una implementación técnica pragmática y viable para un TFG/MVP.

---

## 1. El Concepto "Sonar-Lite"

En lugar de construir un motor de plugins complejo (como SonarQube real), nuestro sistema se comportará así:
1.  **Ejecución Monolítica:** El análisis sigue siendo un trabajo de Celery que corre Pandas, pero su *resultado* se estructura estrictamente.
2.  **Snapshot Inmutable:** Cada análisis es una foto estática (`AnalysisRun`) que se compara con la anterior (`baseline`).
3.  **Gate Binario:** Al final del análisis, se calcula un booleano: `PASSED` o `FAILED`. Sin grises.

---

## 2. Nueva Arquitectura de Datos

Necesitamos migrar de un modelo de "Evaluación suelta" a un "Historial de Análisis".

### 2.1 Tabla `analysis_runs` (Sustituye o evoluciona `evaluations`)
Esta es la entidad central. Representa "le pasé el escáner al dataset".

```python
class AnalysisRun(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, ForeignKey('projects.id'))
    
    # Estado de la ejecución técnica
    status = db.Column(db.Enum('PENDING', 'RUNNING', 'COMPLETED', 'FAILED'))
    
    # El "Veredicto" de Calidad (Sonar Experience)
    quality_gate_status = db.Column(db.Enum('PASSED', 'FAILED', 'WARNING'), nullable=True)
    
    # Métricas clave para listados rápidos
    quality_score = db.Column(db.Float) # 0-100
    critical_issues_count = db.Column(db.Integer)
    
    # Comparación (Diff)
    baseline_analysis_id = db.Column(db.Integer, ForeignKey('analysis_runs.id')) # El run contra el que se comparó
    new_issues_count = db.Column(db.Integer) # Cuántos issues no existían en el baseline
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
```

### 2.2 Tabla `data_quality_issues` (Mejorada)
Los issues deben ser rastreables en el tiempo para saber si son "nuevos" o "heredados".

```python
class DataQualityIssue(db.Model):
    # ... campos existentes ...
    analysis_run_id = db.Column(db.Integer, ForeignKey('analysis_runs.id'))
    
    # La "Huella Digital" para identificar duplicados entre runs
    # hash(rule_key + column_name + row_identifier + issue_type)
    fingerprint = db.Column(db.String(64), index=True) 
    
    # Estado del issue en este run
    is_new = db.Column(db.Boolean, default=True) # True si no existía en el baseline
```

### 2.3 Tabla `quality_gates` (Nueva)
Configuración simple para decidir cuándo falla un análisis.

```python
class QualityGate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, ForeignKey('projects.id'))
    
    # Configuración JSON simple
    # Ej: {"min_score": 80, "max_critical_issues": 0, "max_completeness_drop": 5}
    thresholds = db.Column(db.JSON) 
```

---

## 3. Flujo de Análisis Simplificado

### Paso 1: Trigger (Inicio)
- Usuario sube dataset o dispara análisis.
- Se crea `AnalysisRun` con estado `PENDING`.
- **Backend busca el último run exitoso** de este proyecto y lo asigna como `baseline_analysis_id`.

### Paso 2: Ejecución (Worker)
- Carga datos con Pandas.
- Ejecuta las validaciones actuales (Completitud, Unicidad, etc.).
- **Calcula Fingerprints:** A cada issue detectado se le genera su hash.
- **Comparación (Diff):**
  - Descarga los fingerprints del `baseline_analysis_id`.
  - Si `current_fingerprint` NO está en `baseline_fingerprints` -> `is_new = True`.
  - Si ESTÁ -> `is_new = False`.
- Guarda `measures` (métricas) y `issues`.

### Paso 3: Evaluación del Gate (Cierre)
- El worker lee la configuración de `QualityGate` del proyecto.
- Verifica condiciones:
  - `if total_score < gate.min_score: status = FAILED`
  - `if new_critical_issues > 0: status = FAILED`
- Actualiza `AnalysisRun.quality_gate_status`.
- Estado pasa a `COMPLETED`.

---

## 4. Cambios en la Interfaz (Frontend)

La UI debe contar una historia de evolución, no solo mostrar tablas.

### 4.1 Dashboard de Proyecto (La "Home")
- **Tarjeta Grande de Estado:** Verde gigante (PASSED) o Rojo (FAILED).
- **Sección "New Code" (Nuevos Datos):**
  - "X New Issues" (desde el último análisis).
  - "Y% Duplication on new data".
- **Sección "Overall Code":**
  - Score actual.
  - Total Issues.
- **Tendencia:** Minigráfico de sparkline mostrando el Score de los últimos 5 runs.

### 4.2 Listado de Issues
- Filtro por defecto: **"Type: New Issues Only"** (Esto es clave en filosofía Sonar: arregla lo que acabas de romper).
- Facetas laterales: Severidad, Regla, Columna.

---

## 5. Plan de Acción (Paso a Paso)

### Fase 1: Backend - Core Logic (Semanas 1-2)
1.  [ ] **DB Migration:** Crear tablas `analysis_runs` y `quality_gates`. (Puedes mantener `evaluations` y migrar datos, o empezar de cero).
2.  [ ] **Refactor Servicio:** Modificar `evaluation_service.py` para implementar la lógica de `AnalysisRun`.
3.  [ ] **Lógica de Gate:** Implementar una función simple `check_quality_gate(run_results, config)` que devuelva `PASSED/FAILED`.

### Fase 2: Backend - Comparación (Semana 3)
1.  [ ] **Fingerprinting:** Añadir función helper que genere hash único por issue.
2.  [ ] **Baseline Check:** Modificar el worker para cargar issues del run anterior y marcar `is_new`.

### Fase 3: Frontend - "Sonar Experience" (Semana 4)
1.  [ ] **Project Card:** Rediseñar la tarjeta de proyecto para mostrar el Gate Status.
2.  [ ] **Run Detail:** Crear vista que muestre cabecera con estado y pestañas (Overview, Issues).

---

## 6. Ventajas de este enfoque
1.  **Menos código:** No hay gestión de plugins dinámicos.
2.  **Mismo valor:** El usuario percibe la misma utilidad (saber si rompió algo nuevo).
3.  **Extensible:** Si en el futuro quieres añadir reglas dinámicas, el modelo de datos `AnalysisRun`/`Issues` ya está preparado.
