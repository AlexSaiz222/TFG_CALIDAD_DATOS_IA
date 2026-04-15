---
name: tfg-review
description: Iterative review of the DataQualAI TFG LaTeX document. Checks guide compliance, internal consistency, code-TFG alignment, academic writing quality in Spanish, and LaTeX correctness. Can target a specific chapter or run a full review cycle.
metadata:
  category: academic
  language: es
---

# TFG Review — DataQualAI

## Propósito

Esta skill realiza una revisión iterativa de la memoria del TFG "DataQualAI" (Alejandro M. Saiz García, defensa jun. 2026, tutores Fernando Gualo y Ricardo Pérez del Castillo). Cada ejecución produce un informe de hallazgos concretos y aplica los arreglos aprobados.

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
| `cap N` | Revisión completa del capítulo N (1–7) o del anexo indicado |
| `latex` | Solo aspectos técnicos LaTeX (warnings, paquetes, etiquetas) |

---

## Proceso de revisión (orden fijo)

### Fase 1 — Leer el contexto

1. Leer `docs/TFG/GITA_TFG/main.tex` para verificar estructura de capítulos y paquetes.
2. Leer el capítulo objetivo (o todos si es ciclo completo).
3. Para revisiones de código: leer los archivos backend relevantes del área revisada.
4. Consultar memoria: `C:\Users\aleja\.claude\projects\C--Users-aleja-Documents-GitHub-TFG-CALIDAD-DATOS-IA\memory\project_tfg_guide_compliance.md`

### Fase 2 — Checklist de la guía de Fernando Gualo

Verificar que cada capítulo contiene las secciones obligatorias indicadas en la guía:

- **Cap. 1 Intro**: motivación, alcance, estructura del documento.
- **Cap. 2 Antecedentes**: estado del arte con herramientas comparadas (Great Expectations, Deequ, DQOps), marco normativo (ISO 25012, ISO 5259).
- **Cap. 3 Objetivos**: objetivo general + OE1–OE5 con indicadores medibles.
- **Cap. 4 Metodología**: justificación Scrum, fases del proyecto, plan de sprints.
- **Cap. 5 Desarrollo**: por cada sprint → planificación, backlog, trabajo realizado, retrospectiva completa (Conseguido, Estado del producto, Pendiente, Qué fue bien, Qué fue mal, Estimación vs real, Lección aprendida, Acción de mejora).
- **Cap. 6 Resultados**: resultados cuantitativos, cualitativos, verificación de objetivos, fortalezas, limitaciones, comparación con herramientas.
- **Cap. 7 Conclusiones**: conclusiones por objetivo, trabajos futuros, reflexión personal.
- **Anexos**: A (backlog completo), B (costes), C (diagramas), D (manual usuario), E (riesgos), F (métricas), G (glosario).

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

Leer los archivos fuente relevantes y contrastar con lo escrito en el TFG:

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

## Formato del informe de hallazgos

Para cada hallazgo, reportar:

```
[CRÍTICO|MAYOR|MENOR] Capítulo X, sección Y (línea ~N)
Descripción concisa del problema.
Corrección propuesta: ...
```

Luego preguntar al usuario qué hallazgos desea corregir antes de aplicar cambios.

---

## Cifras de referencia (estado actual verificado)

Estas cifras han sido verificadas directamente contra el código fuente. Usarlas para contrastar el texto del TFG:

| Concepto | Valor correcto |
|----------|---------------|
| Métricas evaluables (Quality Score) | 6 |
| Clases de métricas totales | 7 (6 evaluables + outliers EDA) |
| Blueprints Flask | 9 |
| Tablas PostgreSQL | 10 |
| Migraciones DB | 8+ |
| Patrones sintácticos predefinidos | 13 |
| Servicios Docker | 8 |
| Coeficiente de penalización crítico | 0.12 |
| Coeficiente de penalización high | 0.05 |
| Coeficiente de penalización medium | 0.01 |
| Coeficiente de penalización low | 0.003 |

---

## Pendientes conocidos (no corregir sin preguntar)

- **Capturas de pantalla reales**: los marcadores `\fbox{...}` en Sprint 4 (fig:dashboard, fig:evaluation-results, fig:eda) y Sprint 5 (fig:quality-gate) deben sustituirse por `\includegraphics` cuando el usuario proporcione las imágenes.
- **ISO 25024 en cap. 02**: revisar si la cita a ISO 25024 es correcta en ese contexto o debe reemplazarse por ISO 5259.
- **Conteo de blueprints en resultados** (cap. 06, tab:resultados-cuantitativos): actualmente dice 6, el código tiene 9.
- **Conteo de tablas** (cap. 06): actualmente dice ~9, el código tiene 10.
