---
name: tfg-review
description: Iterative review of the DataQualAI TFG LaTeX document. Checks guide compliance, internal consistency, code-TFG alignment, academic writing quality in Spanish, and LaTeX correctness. Can target a specific chapter, sprint, annex, or run a full review cycle. Use whenever the user asks to review, check, audit, or improve any part of the TFG memory document.
metadata:
  category: academic
  language: es
---

# TFG Review — DataQualAI

## Propósito

Esta skill realiza una revisión iterativa de la memoria del TFG "DataQualAI" (Alejandro M. Saiz García, defensa jun. 2026, tutores Fernando Gualo y Ricardo Pérez del Castillo). Cada ejecución produce un informe de hallazgos concretos ordenados por severidad y aplica los arreglos aprobados.

---

## Cómo usar esta skill

Invoca `/tfg-review` con uno de los modos siguientes (o sin argumentos para el ciclo completo):

| Argumento | Qué revisa |
|-----------|------------|
| *(sin argumentos)* | Ciclo completo: guía → consistencia → código → redacción |
| `guia` | Solo cumplimiento con la guía de Fernando Gualo |
| `consistencia` | Solo coherencia interna (números, referencias cruzadas, abreviaturas) |
| `codigo` | Solo alineación TFG ↔ código fuente real |
| `redaccion` | Solo calidad de redacción académica en español |
| `cap N` | Revisión completa del capítulo N (1–7) |
| `sprint N` | Retrospectiva completa del sprint N (los 8 campos obligatorios) |
| `biblio` | Consistencia bibliografía: cada `\cite{}` tiene entrada en `.bib` y viceversa |
| `objetivos` | Trazabilidad OE1–OE5: intro → cap. 3 → resultados → conclusiones |
| `anexos` | Revisión de los 8 anexos contra la checklist de la guía |
| `latex` | Solo aspectos técnicos LaTeX (warnings, paquetes, etiquetas) |

---

## Rutas de archivos del proyecto

### LaTeX
- `docs/TFG/GITA_TFG/main.tex` — estructura global, paquetes, `\input{}`
- `docs/TFG/GITA_TFG/main.bib` — bibliografía BibTeX
- `docs/TFG/GITA_TFG/chapters/01-intro.tex`
- `docs/TFG/GITA_TFG/chapters/02-antecedentes.tex`
- `docs/TFG/GITA_TFG/chapters/03-objetivos.tex`
- `docs/TFG/GITA_TFG/chapters/04-metodologia.tex`
- `docs/TFG/GITA_TFG/chapters/05-desarrollo.tex`
- `docs/TFG/GITA_TFG/chapters/06-resultados.tex`
- `docs/TFG/GITA_TFG/chapters/07-conclusiones.tex`
- Anexos: `anexo-backlog.tex`, `anexo-costes.tex`, `anexo-diagramas.tex`, `anexo-manual.tex`, `anexo-riesgos.tex`, `anexo-metricas.tex`, `anexo-api.tex`, `anexo1.tex`

### Código fuente
- `backend/api/routes.py` — registro de blueprints
- `backend/services/metrics/registry.py` — métricas registradas
- `backend/services/evaluation_service.py` — fórmula Quality Score, tipos de issue
- `backend/models/*.py` — tablas de base de datos
- `docker-compose.yml` — servicios Docker
- `backend/services/metrics/syntactic_accuracy.py` — patrones sintácticos

---

## Proceso de revisión (orden fijo)

### Fase 0 — Verificar existencia de archivos

Antes de leer cualquier archivo de código en la Fase 4, confirmar que existe con `Glob` o `Grep`. Si un archivo no existe, anotarlo como "ruta no verificada" en el informe en lugar de asumir su contenido. Esto evita reportar afirmaciones basadas en archivos renombrados o movidos.

### Fase 1 — Leer el contexto

1. Leer `docs/TFG/GITA_TFG/main.tex` para verificar estructura de capítulos y paquetes.
2. Leer el capítulo o anexo objetivo (o todos si es ciclo completo).
3. Para revisiones de código: verificar existencia del archivo (Fase 0) y luego leerlo.
4. Consultar memoria: `C:\Users\aleja\.claude\projects\C--Users-aleja-Documents-GitHub-TFG-CALIDAD-DATOS-IA\memory\project_tfg_guide_compliance.md`

### Fase 2 — Checklist de la guía de Fernando Gualo

Verificar que cada capítulo contiene las secciones obligatorias indicadas en la guía:

- **Cap. 1 Intro**: motivación, alcance, estructura del documento.
- **Cap. 2 Antecedentes**: estado del arte con herramientas comparadas (Great Expectations, Deequ, DQOps), marco normativo (ISO 25012, ISO 5259).
- **Cap. 3 Objetivos**: objetivo general + OE1–OE5 con indicadores medibles.
- **Cap. 4 Metodología**: justificación Scrum, fases del proyecto, plan de sprints.
- **Cap. 5 Desarrollo**: por cada sprint → planificación, backlog, trabajo realizado, retrospectiva completa (8 campos — ver modo `sprint N`).
- **Cap. 6 Resultados**: resultados cuantitativos, cualitativos, verificación de objetivos, fortalezas, limitaciones, comparación con herramientas.
- **Cap. 7 Conclusiones**: conclusiones por objetivo, trabajos futuros, reflexión personal.
- **Anexos**: A (backlog completo), B (costes), C (diagramas), D (manual usuario), E (riesgos), F (métricas), G (glosario), H (API).

### Fase 3 — Consistencia interna

Comprobar:

- **Cifras clave** que deben coincidir en todos los capítulos:
  - 6 métricas evaluables (Quality Score) + 1 clase de diagnóstico (outliers, solo EDA)
  - 9 blueprints Flask registrados (`auth, projects, project_metrics, datasets, project_datasets, metrics, evaluations, admin, dashboard`)
  - 10 tablas en base de datos
  - 8+ migraciones
  - 20+ páginas frontend, 40+ componentes React
- **Fórmula del Quality Score**: `Q = max(0, 1 − min(0.97, p_raw / σ))` donde `p_raw = 0.12·n_crit + 0.05·n_high + 0.01·n_med + 0.003·n_low` y `σ = sqrt(max(10, cols) / 10)`.
- **Referencias cruzadas** `\ref{}` y `\cite{}`: que no haya etiquetas sin definir o sin usar.
- **Acrónimos**: primer uso con `\ac{}`, siguientes con `\ac{}` o `\acs{}` según contexto.
- **Listas de figuras/tablas**: que todas las figuras y tablas tengan `\caption` y `\label`.

### Fase 4 — Alineación TFG ↔ código

Verificar existencia (Fase 0) y luego leer:

| Afirmación TFG | Archivo a verificar |
|----------------|---------------------|
| Métricas registradas | `backend/services/metrics/registry.py` |
| Fórmula Quality Score | `backend/services/evaluation_service.py` |
| Blueprints / rutas API | `backend/api/routes.py` |
| Tablas de base de datos | `backend/models/*.py` |
| Tipos de issue / severidades | `backend/services/evaluation_service.py` |
| Servicios Docker | `docker-compose.yml` |
| Patrones de formato | `backend/services/metrics/syntactic_accuracy.py` |

### Fase 5 — Calidad de redacción académica

Revisar el texto buscando:

- Frases demasiado largas (>3 líneas sin punto).
- Uso de primera persona singular ("yo hice") en lugar de impersonal o primera plural.
- Anglicismos no justificados (sustituibles por término en español).
- Repetición de palabras en el mismo párrafo.
- Oraciones sin verbo principal.
- Uso correcto de comillas (`«»` en español, no `""`).
- Comas de Oxford innecesarias o ausentes según RAE.

### Fase 6 — Aspectos técnicos LaTeX

- Verificar que todos los `\label{}` tienen un `\ref{}` o `\pageref{}` correspondiente.
- Comprobar que las tablas grandes usan `tabularx` o `longtable` según corresponda.
- Verificar que los `\begin{figure}` tienen especificador `[htbp]`.
- Confirmar que `pgfplots` está cargado si hay gráficos de burndown.
- Detectar `\textbf{}` o `\textit{}` usados donde debería haber `\emph{}`.

---

## Modos especiales

### Modo `sprint N`

Leer la sección del sprint N en `chapters/05-desarrollo.tex` y verificar que la retrospectiva incluye los **8 campos obligatorios** de la guía:

1. **Conseguido** — qué se completó en el sprint
2. **Estado del producto** — estado acumulado tras el sprint
3. **Pendiente** — qué quedó sin hacer
4. **Qué fue bien** — práctica positiva a mantener
5. **Qué fue mal** — problema identificado
6. **Estimación vs real** — horas/puntos planificados vs ejecutados
7. **Lección aprendida** — reflexión extraíble
8. **Acción de mejora** — medida concreta para el siguiente sprint

Reportar cada campo ausente como hallazgo CRÍTICO.

### Modo `biblio`

1. Extraer todas las claves `\cite{key}` del documento completo.
2. Extraer todas las claves `@tipo{key,` del archivo `docs/TFG/GITA_TFG/main.bib`.
3. Reportar:
   - Claves citadas en el texto pero ausentes en `.bib` → CRÍTICO
   - Entradas en `.bib` no citadas en ningún capítulo → MENOR (posible limpieza)
4. Verificar que cada entrada `.bib` tiene al menos: `author`, `title`, `year` y el campo identificador del tipo (`journal`, `booktitle`, `url`, etc.).

### Modo `objetivos`

Para cada objetivo OE1–OE5:
1. Localizar su definición en `chapters/03-objetivos.tex` (indicador medible incluido).
2. Verificar que cap. 6 (`chapters/06-resultados.tex`) lo menciona explícitamente y proporciona evidencia cuantitativa o cualitativa.
3. Verificar que cap. 7 (`chapters/07-conclusiones.tex`) incluye una conclusión específica para ese objetivo.
4. Reportar cualquier objetivo sin evidencia en resultados o sin conclusión como CRÍTICO.

### Modo `anexos`

Revisar cada anexo contra la checklist de la guía:

| Anexo | Contenido obligatorio |
|-------|-----------------------|
| Backlog | Historias de usuario completas con criterios de aceptación |
| Costes | Desglose horas × tarifa, coste total del proyecto |
| Diagramas | Diagrama de clases, ER, despliegue, casos de uso |
| Manual usuario | Capturas reales, pasos de instalación, guía de uso |
| Riesgos | Tabla con probabilidad, impacto, mitigación |
| Métricas | Definición técnica de cada métrica implementada |
| API | Endpoints documentados (método, ruta, parámetros, respuesta) |

---

## Formato del informe de hallazgos

Ordenar todos los hallazgos de mayor a menor severidad antes de presentarlos. Usar este formato por hallazgo:

```
[CRÍTICO|MAYOR|MENOR] Capítulo X / Sección Y (línea ~N)
Descripción concisa del problema.
Corrección propuesta: ...
```

Al final del informe, incluir siempre un **resumen de conteo**:

```
── Resumen ──────────────────────────────
  Críticos : N
  Mayores  : N
  Menores  : N
  Total    : N
─────────────────────────────────────────
```

Luego preguntar al usuario qué hallazgos desea corregir antes de aplicar cambios.

---

## Cifras de referencia (estado actual verificado)

Estas cifras han sido verificadas directamente contra el código fuente. Usarlas para contrastar el texto del TFG:

| Concepto | Valor correcto |
|----------|---------------|
| Métricas evaluables (Quality Score) | 6 |
| Clases de métricas totales | 7 (6 evaluables + outliers EDA) |
| Blueprints Flask | 10 |
| Tablas PostgreSQL | 10 |
| Migraciones DB | 8+ |
| Patrones sintácticos predefinidos | 13 |
| Servicios Docker | 8 |
| Coeficiente de penalización crítico | 0.12 |
| Coeficiente de penalización high | 0.05 |
| Coeficiente de penalización medium | 0.01 |
| Coeficiente de penalización low | 0.003 |

---

## Pendientes conocidos

Antes de reportar cualquiera de estos pendientes como hallazgo, **verificar primero si sigue abierto** leyendo el archivo correspondiente. Solo reportarlo si el problema persiste.

| Pendiente | Cómo verificar |
|-----------|----------------|
| Marcadores `\fbox{...}` en Sprint 4–5 (fig:dashboard, fig:evaluation-results, fig:eda, fig:quality-gate) deben sustituirse por `\includegraphics` | Buscar `\fbox` en `chapters/05-desarrollo.tex` |
| ISO 25024 en cap. 02: revisar si la cita es correcta o debe ser ISO 5259 | Leer la sección correspondiente en `chapters/02-antecedentes.tex` |
| Conteo de blueprints en `tab:resultados-cuantitativos` (cap. 06): el código tiene 9, puede decir 6 | Leer `chapters/06-resultados.tex` y buscar la tabla |
| Conteo de tablas PostgreSQL en cap. 06: el código tiene 10 | Leer `chapters/06-resultados.tex` |
