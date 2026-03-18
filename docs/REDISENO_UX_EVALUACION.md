# Plan de Rediseño UX — Pantalla de Evaluación de Calidad de Datos

> Documento de diseño para `frontend/src/pages/evaluations/[id].tsx`  
> Fecha: 2026-03-18  
> Rol: Senior Product Designer & UX Strategist

---

## 1. Diagnóstico UX de la pantalla actual

### Estructura actual (orden de renderizado en `[id].tsx`)

| Orden | Bloque | Líneas aprox. | Problema |
|-------|--------|---------------|----------|
| 1 | Header (título, status, botones) | 222–261 | Correcto, pero sin contexto del dataset |
| 2 | Quality Score (gauge circular) + 3 tarjetas métricas (Completeness, Uniqueness, Outliers) | 319–517 | Las tarjetas ocupan mucho espacio vertical; la de Outliers es desproporcionadamente compleja (~100 líneas de JSX inline) frente a las otras dos |
| 3 | Outlier Detail (box-plot SVG + tabla por columna) | 519–856 | Aparece inmediatamente después del resumen, rompiendo la narrativa. Ocupa cientos de píxeles. No existe equivalente para Completeness ni Uniqueness |
| 4 | Column Metrics (tabla de `ColumnMetricsTable.tsx`) | 858–866 | Sepultada bajo el detalle de outliers, difícil de encontrar |
| 5 | Score Breakdown (fórmula paso a paso) | 868–974 | Contenido metodológico que compite visualmente con el diagnóstico |
| 6 | Issues Detected (tabla de issues) | 976–1043 | Al final de todo, requiere scroll largo para llegar |

### Problemas concretos identificados

**Escaneabilidad**
- La página es un **scroll lineal de ~1050 líneas de JSX** sin puntos de anclaje visual ni navegación interna.
- No hay forma de saltar entre secciones. El único enlace interno es el "Ver detalles ↓" de la tarjeta de Outliers.
- Un usuario nuevo no sabe qué hay más abajo sin hacer scroll.

**Narrativa visual rota**
- El flujo actual es: *"aquí tienes un número → aquí tienes un detalle técnico profundo de una sola métrica → aquí tienes una tabla densa → aquí tienes la fórmula → aquí tienes los problemas"*.
- El **Outlier Detail** (bloque 3) interrumpe la narrativa porque pasa de resumen ejecutivo a análisis técnico profundo sin transición. El usuario aún no sabe qué problemas hay ni cuáles son prioritarios.
- **Issues Detected** debería estar mucho antes: es lo que responde a "¿qué debo corregir?".

**Asimetría de métricas**
- Outliers tiene ~340 líneas de detalle inline (box-plot SVG, tabla de valores, clasificación extremo/moderado, zoom toggle).
- Completeness tiene ~20 líneas: un porcentaje y una barra.
- Uniqueness tiene ~20 líneas: un porcentaje y una barra.
- Esto crea una **jerarquía visual falsa**: parece que los outliers son mucho más importantes que las otras métricas.

**Carga cognitiva**
- El Score Breakdown explica la fórmula `base - penalización = final`, pero aparece después de Column Metrics. El usuario tiene que reconstruir mentalmente la conexión entre el score del principio y esta explicación del final.
- La tabla Column Metrics tiene 10 columnas (Column, Type, Completeness, Nulls, Uniqueness, Unique Values, Min, Max, Mean, Std). Es mucha información sin filtros ni priorización.

**Competencia entre bloques**
- Column Metrics, Score Breakdown e Issues compiten por atención en el mismo nivel visual (todos son `Paper` con el mismo estilo).
- No hay jerarquía de importancia: todo parece igual de relevante.

---

## 2. Nueva arquitectura de información

### Narrativa objetivo

La pantalla debe responder a estas preguntas **en este orden**:

```
1. ¿Qué tan bien está el dataset?        → Score + veredicto textual
2. ¿Por qué tiene ese score?             → Desglose rápido de métricas + issues count
3. ¿Qué problemas concretos hay?         → Issues priorizados por severidad
4. ¿Dónde puedo profundizar?             → Detalle por métrica (tabs)
5. ¿Qué debería corregir primero?        → Issues con columnas afectadas + enlaces a detalle
6. ¿Cómo se ven las columnas?            → Explorador por columna
7. ¿Cómo se calculó el score?            → Metodología (colapsada)
```

### Mapa de información propuesto

```
NIVEL 1 — Visible sin scroll (above the fold)
├── Header (título, dataset, status, acciones)
├── Executive Summary
│   ├── Quality Score (gauge)
│   ├── Veredicto textual ("Calidad aceptable con 3 problemas detectados")
│   ├── Mini-cards: Completeness | Uniqueness | Outliers (solo valor + icono)
│   └── Issues count por severidad (chips: 1 high, 2 medium, 0 low)

NIVEL 2 — Primer scroll (diagnóstico)
├── Priority Issues (tabla compacta, ordenada por severidad)
│   └── Cada issue enlaza a la métrica y columna afectada

NIVEL 3 — Exploración (tabs o acordeones)
├── Metric Details (tabs: Completeness | Uniqueness | Outliers)
│   ├── Tab Completeness: resumen + detalle por columna
│   ├── Tab Uniqueness: resumen + detalle de duplicados
│   └── Tab Outliers: resumen + box-plots + tabla de valores

NIVEL 4 — Análisis profundo
├── Column Explorer (tabla interactiva con filtros)

NIVEL 5 — Referencia (colapsado por defecto)
└── Score Calculation (acordeón cerrado)
```

---

## 3. Estructura recomendada de secciones

### Propuesta final de secciones

| # | Sección | Visibilidad | Contenido principal |
|---|---------|-------------|---------------------|
| A | **Header** | Siempre visible | Título, dataset, status, acciones (refresh, delete) |
| B | **Executive Summary** | Above the fold | Score gauge + veredicto + mini-métricas + issue chips |
| C | **Priority Issues** | Visible tras mínimo scroll | Tabla de issues ordenada por severidad, con enlace a columna |
| D | **Metric Details** | Tabs interactivos | 3 tabs: Completeness, Uniqueness, Outliers — cada uno con resumen + detalle expandible |
| E | **Column Explorer** | Tabla con filtros | Tabla actual mejorada con búsqueda y ordenación |
| F | **Score Calculation** | Acordeón cerrado | Fórmula paso a paso (contenido actual de Score Breakdown) |

### Por qué esta estructura es mejor que "Header → Executive Summary → Priority Issues → Metric Details → Column Explorer → Score Calculation"

Validado. La estructura propuesta es la correcta porque:

1. **Respeta la pirámide invertida**: lo más importante primero (score → problemas → detalle).
2. **Separa diagnóstico de exploración**: los niveles 1-2 son para decisiones rápidas, los niveles 3-5 para análisis profundo.
3. **Elimina la asimetría**: las tres métricas tienen el mismo tratamiento en tabs.
4. **Reduce el scroll obligatorio**: el Executive Summary + Priority Issues caben en ~600px de alto.
5. **La metodología no compite**: queda como referencia accesible pero no protagonista.

---

## 4. Rediseño de "Metric Details"

### Patrón general: Tabs con panel de detalle

Usar `MUI Tabs` con un tab por métrica. Cada tab tiene:
- **Resumen compacto** (siempre visible al seleccionar el tab)
- **Detalle expandible** (visible al hacer click o scroll dentro del tab)

---

### 4.1 Tab: Completeness

**Resumen visible al seleccionar el tab:**
| Elemento | Contenido |
|----------|-----------|
| Score principal | `96.2%` con color semafórico |
| Barra de progreso | Barra horizontal con umbral marcado (95%) |
| Contexto rápido | "234 de 243 celdas tienen valor. Faltan 9 valores en 3 columnas." |
| Columnas afectadas | Lista compacta: `edad (3 nulls), email (4 nulls), telefono (2 nulls)` |

**Detalle expandible:**
| Elemento | Contenido |
|----------|-----------|
| Tabla por columna | Columna → Total celdas → Nulls → % completitud → Estado |
| Visualización | **Barra horizontal apilada** por columna (verde = completo, rojo = null). Es la más intuitiva para proporciones parte/todo. |
| Insight automático | "La columna `email` tiene el mayor porcentaje de valores faltantes (8.2%). Considere revisar la fuente de datos." |

**Visualización recomendada:** Barras horizontales apiladas (una por columna). Son superiores a una tabla numérica sola porque permiten comparar proporciones visualmente.

**Acciones/insights:**
- Ordenar columnas por % de completitud (ascendente = peores primero)
- Highlight automático de columnas por debajo del umbral
- Enlace directo a la fila correspondiente en Column Explorer

---

### 4.2 Tab: Uniqueness

**Resumen visible al seleccionar el tab:**
| Elemento | Contenido |
|----------|-----------|
| Score principal | `98.5%` con color semafórico |
| Contexto rápido | "3 filas duplicadas detectadas de 200 totales." |
| Indicador | Chip: "1.5% duplicados" con icono de warning |

**Detalle expandible:**
| Elemento | Contenido |
|----------|-----------|
| Tabla de duplicados | Grupos de filas duplicadas, mostrando índices y preview de valores |
| Uniqueness por columna | Tabla: Columna → Valores únicos → Total → % uniqueness |
| Visualización | **Treemap o barras horizontales** mostrando la distribución de valores únicos vs duplicados por columna |

**Visualización recomendada:** Tabla resumen con barras integradas (similar a la completeness de `ColumnMetricsTable.tsx` actual). Si hay pocos duplicados, mostrar directamente las filas duplicadas.

**Acciones/insights:**
- "Las filas 45, 89 y 120 son duplicados exactos"
- Ordenar por % de uniqueness
- Indicar si los duplicados afectan a columnas que deberían ser únicas (si se conoce)

---

### 4.3 Tab: Outliers

**Resumen visible al seleccionar el tab:**
| Elemento | Contenido |
|----------|-----------|
| Conteo principal | `12 outliers` con color semafórico |
| Contexto | "de 1,500 valores analizados (0.8%) en 3 columnas" |
| Método | Chip pequeño: "IQR ×1.5" |
| Columnas afectadas | Lista compacta con conteo: `precio (7), edad (3), ingreso (2)` |

**Detalle expandible (por columna):**
Reutilizar la lógica actual del Outlier Detail (líneas 519-856) pero dentro del tab, con estas mejoras:
| Elemento | Contenido |
|----------|-----------|
| Box-plot SVG | El actual, con zoom toggle — **mantener tal cual**, está bien hecho |
| Estadísticas | Q1, Mediana, Q3, IQR, Límites — **mantener tal cual** |
| Tabla de valores | Con clasificación Extremo/Plausible/Posible error — **mantener tal cual** |
| Mejora: selector de columna | En lugar de mostrar todas las columnas apiladas, usar un **selector/dropdown** para elegir qué columna ver. Reduce scroll. |

**Visualización recomendada:** Box-plot SVG actual + dropdown de columna. El box-plot ya es excelente. Solo falta el patrón de selección para evitar scroll.

**Acciones/insights:**
- "La columna `precio` tiene 2 valores posiblemente erróneos (>100x IQR)"
- Clasificación automática de severidad por columna
- Botón "ver en Column Explorer" para cruzar con otras métricas

---

## 5. Papel de cada bloque actual

### Quality Score Gauge (`QualityScoreGauge.tsx`)
**Decisión: MANTENER + ENRIQUECER**
- Mantener en Executive Summary como elemento central.
- **Añadir**: veredicto textual debajo del gauge: "Buena calidad" / "Calidad aceptable" / "Requiere atención" / "Calidad crítica" según rangos (≥80, ≥60, ≥40, <40).
- **Añadir**: subtexto con el conteo de issues: "3 problemas detectados (1 grave)".

### Tarjetas de métricas (Completeness, Uniqueness, Outliers inline)
**Decisión: COMPACTAR + MOVER**
- **En Executive Summary**: reducir a mini-cards de una línea cada una: `[icono] Completeness: 96.2% ✓` | `[icono] Uniqueness: 98.5% ✓` | `[icono] Outliers: 12 ⚠`.
- Cada mini-card es clickable y navega al tab correspondiente en Metric Details.
- **Eliminar**: la versión expandida actual (que ya tenía barra de progreso, descripción, umbral) del Executive Summary. Ese nivel de detalle se traslada a los tabs.

### Outlier Detail (box-plot + tabla, líneas 519-856)
**Decisión: MOVER + ENCAPSULAR**
- **Mover** todo el bloque dentro del tab "Outliers" de Metric Details.
- **Encapsular** en un componente nuevo: `OutlierDetail.tsx` (extraer del inline de `[id].tsx`).
- **Añadir** dropdown de selección de columna en lugar de mostrar todas apiladas.
- El contenido (box-plot, estadísticas, tabla de valores) se mantiene intacto — es de alta calidad.

### Column Metrics (`ColumnMetricsTable.tsx`)
**Decisión: MANTENER + MEJORAR como "Column Explorer"**
- **Mover** a la sección Column Explorer (después de Metric Details).
- **Añadir** funcionalidades interactivas:
  - Búsqueda/filtro por nombre de columna
  - Ordenación por cualquier columna de la tabla
  - Highlight de celdas con problemas (nulls > 0 en rojo, uniqueness < 100% en amarillo)
  - Click en una fila para ver detalle de esa columna (drill-down)
- **Opcional futuro**: columna de "Health" con un mini indicador visual por fila.

### Score Breakdown (fórmula, líneas 868-974)
**Decisión: MOVER + COLAPSAR**
- **Mover** al final de la página como sección "Score Calculation".
- **Colapsar** por defecto dentro de un acordeón (`MUI Accordion`).
- Título visible: "¿Cómo se calcula el score?" con icono de información.
- El contenido actual (pasos 1-2-3 con fórmula) se mantiene intacto.
- **Razón**: es contenido de referencia/metodología, no de diagnóstico. No debe competir visualmente con las secciones de acción.

### Issues Detected (tabla, líneas 976-1043)
**Decisión: MOVER + ENRIQUECER como "Priority Issues"**
- **Mover** a la posición 3 (después de Executive Summary, antes de Metric Details).
- **Enriquecer**:
  - Ordenar por severidad descendente (high → medium → low) por defecto.
  - Añadir filtros por severidad usando el componente `IssuesSummary.tsx` existente (que ya tiene los chips filtrables pero no se usa en la página actual).
  - Añadir columna "Metric" para saber si el issue viene de completeness, uniqueness u outliers.
  - Hacer clickable la columna afectada para navegar al tab correspondiente.
- **Razón**: los issues son la respuesta directa a "¿qué debo corregir?" y deben estar cerca del score.

---

## 6. Recomendaciones de interacción

### Patrones evaluados

| Patrón | Adecuado para | Recomendado aquí | Dónde aplicar |
|--------|---------------|------------------|---------------|
| **Tabs** | Contenido excluyente del mismo nivel | **Sí** | Metric Details (Completeness / Uniqueness / Outliers) |
| **Acordeón** | Contenido secundario que no todos necesitan | **Sí** | Score Calculation (cerrado por defecto) |
| **Navegación sticky** | Páginas largas con múltiples secciones | **Sí** | Barra lateral o barra superior con enlaces a secciones |
| **Enlaces internos (anchor)** | Conexión entre elementos relacionados | **Sí** | Issue → tab de métrica, Mini-card → tab correspondiente |
| **Filtros** | Tablas con muchos registros | **Sí** | Issues (por severidad), Column Explorer (por nombre/tipo) |
| **Drill-down** | Exploración progresiva | **Sí** | Column Explorer → detalle de columna |
| **CTAs "ver detalle"** | Conexión resumen → detalle | **Sí** | Mini-cards del Executive Summary |
| **Scroll snap** | Secciones a pantalla completa | **No** | No encaja con contenido de altura variable |

### Recomendación principal: **Tabs + Sticky Nav + Acordeón**

```
┌─────────────────────────────────────────────────┐
│ HEADER (siempre fijo arriba)                    │
├─────────────────────────────────────────────────┤
│ STICKY NAV: [Resumen] [Issues] [Métricas]       │
│             [Columnas] [Cálculo]                │
├─────────────────────────────────────────────────┤
│                                                 │
│ Executive Summary                               │
│   Score + Mini-cards + Issue count              │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Priority Issues                                 │
│   Filtros de severidad + Tabla                  │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Metric Details                                  │
│   [Completeness] [Uniqueness] [Outliers]  ←tabs │
│   ┌─────────────────────────────────────┐       │
│   │ Contenido del tab activo            │       │
│   └─────────────────────────────────────┘       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Column Explorer                                 │
│   Búsqueda + Tabla ordenable                    │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ ▶ ¿Cómo se calcula el score? (acordeón)        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Justificación de cada patrón elegido

- **Tabs para Metric Details**: porque las tres métricas son contenido del mismo nivel jerárquico que el usuario explora una a la vez. Tabs evitan apilar los tres detalles verticalmente (que es el problema actual con Outlier Detail).
- **Sticky Nav**: porque la página sigue siendo larga (~5 secciones). Permite saltar sin scroll. Implementar con `position: sticky` y `scrollIntoView`.
- **Acordeón para Score Calculation**: porque es contenido de referencia que el 80% de los usuarios no necesita ver. Mantiene accesible sin ocupar espacio.
- **Filtros en Issues**: ya existe `IssuesSummary.tsx` con chips filtrables. Solo hay que integrarlo.
- **Enlaces internos**: cada mini-card del summary debe hacer `scrollIntoView` al tab correspondiente y activarlo.

---

## 7. Priorización de cambios

### Fase 1: Alto impacto, bajo coste (1–2 días)

| # | Cambio | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | **Mover Issues arriba** (después del summary) | Muy alto — responde a "¿qué debo corregir?" antes | Bajo — solo reordenar JSX |
| 2 | **Colapsar Score Breakdown** en acordeón | Alto — libera espacio visual | Bajo — envolver en `<Accordion>` |
| 3 | **Compactar tarjetas** de métricas a mini-cards en summary | Alto — reduce above-the-fold height | Medio — reescribir las 3 tarjetas |
| 4 | **Integrar `IssuesSummary.tsx`** en la tabla de issues | Medio — ya existe el componente, no se usa | Bajo — importar y conectar |

### Fase 2: Cambios estructurales (3–5 días)

| # | Cambio | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 5 | **Implementar tabs** para Metric Details | Muy alto — elimina asimetría y scroll | Medio-alto — crear estructura de tabs + mover contenido |
| 6 | **Extraer `OutlierDetail.tsx`** como componente | Alto — reduce [id].tsx de 1053 a ~500 líneas | Medio — extraer sin cambiar lógica |
| 7 | **Crear `CompletenessDetail.tsx`** | Alto — simetría con outliers | Medio — contenido nuevo |
| 8 | **Crear `UniquenessDetail.tsx`** | Alto — simetría con outliers | Medio — contenido nuevo |
| 9 | **Sticky nav con enlaces a secciones** | Medio — mejora navegación | Medio — nuevo componente |

### Fase 3: Mejoras opcionales a futuro

| # | Cambio | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 10 | Column Explorer interactivo (filtros, sort, drill-down) | Medio | Alto |
| 11 | Veredicto textual automático basado en score | Medio | Bajo |
| 12 | Dropdown de columna en Outlier Detail (en vez de apilar todas) | Medio | Medio |
| 13 | Indicador de "Health" por columna en Column Explorer | Bajo | Medio |
| 14 | Animaciones de transición entre tabs | Bajo | Bajo |
| 15 | Export de resultados a PDF/CSV | Medio | Alto |

---

## 8. Wireframe textual

```
╔══════════════════════════════════════════════════════════════╗
║  ← Evaluation #42                    [Completed ✓]          ║
║  Dataset: ventas_2024.csv | Creado: 18 mar 2026 10:30      ║
║                                         [↻ Refresh] [🗑]    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │              EXECUTIVE SUMMARY                        │   ║
║  │                                                       │   ║
║  │   ┌─────────┐                                         │   ║
║  │   │         │   Quality Score: 72.4%                  │   ║
║  │   │  72.4%  │   Calidad aceptable — 4 problemas      │   ║
║  │   │ (gauge) │   detectados, 1 de alta severidad       │   ║
║  │   └─────────┘                                         │   ║
║  │                                                       │   ║
║  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   ║
║  │   │ ✓ Complete.  │ │ ⚠ Unique.   │ │ ⚠ Outliers  │ │   ║
║  │   │   96.2%      │ │   98.5%      │ │   12 detect. │ │   ║
║  │   │  [ver →]     │ │  [ver →]     │ │  [ver →]     │ │   ║
║  │   └──────────────┘ └──────────────┘ └──────────────┘ │   ║
║  │                                                       │   ║
║  │   Issues: [🔴 1 high] [🟡 2 medium] [🟢 1 low]       │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  ── sticky nav ──────────────────────────────────────────── ║
║  [Resumen ↑] [Issues] [Métricas] [Columnas] [Cálculo]      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ PRIORITY ISSUES (4)                                   │   ║
║  │                                                       │   ║
║  │ Filtros: [🔴 High (1)] [🟡 Medium (2)] [🟢 Low (1)]  │   ║
║  │                                                       │   ║
║  │ ┌────────┬────────────────────────┬─────────┬──────┐ │   ║
║  │ │Severity│ Description            │ Metric  │Column│ │   ║
║  │ ├────────┼────────────────────────┼─────────┼──────┤ │   ║
║  │ │ 🔴 high│ 7 outliers extremos    │Outliers │precio│ │   ║
║  │ │ 🟡 med │ Completitud <95%       │Complete.│email │ │   ║
║  │ │ 🟡 med │ 3 filas duplicadas     │Unique.  │ —    │ │   ║
║  │ │ 🟢 low │ 2 outliers plausibles  │Outliers │edad  │ │   ║
║  │ └────────┴────────────────────────┴─────────┴──────┘ │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ METRIC DETAILS                                        │   ║
║  │                                                       │   ║
║  │ ┌──────────────┬──────────────┬──────────────┐       │   ║
║  │ │ Completeness │  Uniqueness  │   Outliers   │  tabs │   ║
║  │ └──────────────┴──────────────┴──────────────┘       │   ║
║  │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │   ║
║  │                                                       │   ║
║  │   [Contenido del tab activo]                          │   ║
║  │                                                       │   ║
║  │   Si Completeness:                                    │   ║
║  │   - Score 96.2% + barra con umbral                   │   ║
║  │   - "9 nulls en 3 columnas"                          │   ║
║  │   - Barras horizontales por columna                   │   ║
║  │   - Tabla: columna | nulls | % | estado              │   ║
║  │                                                       │   ║
║  │   Si Uniqueness:                                      │   ║
║  │   - Score 98.5% + contexto                            │   ║
║  │   - "3 filas duplicadas"                              │   ║
║  │   - Tabla de uniqueness por columna                   │   ║
║  │                                                       │   ║
║  │   Si Outliers:                                        │   ║
║  │   - 12 outliers en 3 columnas                         │   ║
║  │   - Selector: [precio ▼]                              │   ║
║  │   - Box-plot SVG (actual)                             │   ║
║  │   - Estadísticas Q1/Q2/Q3/IQR                        │   ║
║  │   - Tabla de valores outlier                          │   ║
║  │                                                       │   ║
║  │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ COLUMN EXPLORER (12 columns)        [Buscar... 🔍]   │   ║
║  │                                                       │   ║
║  │ ┌──────┬──────┬───────┬───────┬─────┬────┬────┬───┐ │   ║
║  │ │Column│ Type │Complet│Unique │Nulls│Min │Max │Std│ │   ║
║  │ ├──────┼──────┼───────┼───────┼─────┼────┼────┼───┤ │   ║
║  │ │email │string│ 91.8% │100.0% │  4  │ —  │ —  │ — │ │   ║
║  │ │precio│float │100.0% │ 95.0% │  0  │0.5 │999 │45 │ │   ║
║  │ │ ...  │      │       │       │     │    │    │   │ │   ║
║  │ └──────┴──────┴───────┴───────┴─────┴────┴────┴───┘ │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ▶ ¿Cómo se calcula el Quality Score?                       ║
║    (click para expandir)                                     ║
║  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ║
║  │ [Contenido actual de Score Breakdown, colapsado]      │  ║
║  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Lo que ve el usuario sin hacer scroll (~500px alto):
- Header completo
- Quality Score con veredicto
- 3 mini-cards de métricas (clickables)
- Conteo de issues por severidad
- Inicio de la sticky nav

### Lo que queda colapsado o en segundo nivel:
- Score Calculation → acordeón cerrado
- Detalle de cada métrica → dentro de tabs (solo se ve el tab activo)
- Outlier detail por columna → dentro del tab Outliers con selector de columna

---

## 9. Principios de diseño

### 1. Primero el veredicto, luego la evidencia, luego el método
El usuario debe entender el estado general en 3 segundos. Los detalles son para quien quiera profundizar. La metodología es referencia, no protagonista.

### 2. Una sola sección protagonista por nivel de profundidad
En el nivel 1 (above the fold), el protagonista es el score. En el nivel 2, los issues. En el nivel 3, el tab activo de métrica. Nunca dos bloques compiten por la misma atención.

### 3. El score sin contexto no tiene valor
Un "72.4%" solo es útil si va acompañado de: qué significa (veredicto textual), qué lo causa (desglose de métricas), y qué hacer al respecto (issues priorizados).

### 4. Simetría entre métricas
Si una métrica tiene detalle expandido, todas deben tenerlo. La asimetría actual (outliers con 340 líneas vs completeness con 20) crea una jerarquía visual falsa.

### 5. De problema a causa a columna en máximo 2 clicks
El usuario debe poder ir de "issue: completitud baja" → tab Completeness → columna `email` sin perderse. Cada elemento debe ser un enlace al siguiente nivel.

### 6. El scroll es para explorar, no para encontrar
Las secciones críticas (score, issues) deben estar accesibles sin scroll o con scroll mínimo. El scroll se reserva para exploración voluntaria (metric details, column explorer).

### 7. Colapsar lo que no es urgente
La información metodológica, las estadísticas detalladas y los análisis profundos deben estar disponibles pero no ocupar espacio por defecto. Usar acordeones, tabs y drill-down.

### 8. Cada bloque debe justificar su espacio
Si un bloque no responde a ninguna de las 5 preguntas objetivo ("¿qué tan bien está?", "¿por qué?", "¿qué problemas?", "¿dónde profundizar?", "¿qué corregir primero?"), debe compactarse o eliminarse.

---

## 10. Entregable final

### Estructura final recomendada

```
[id].tsx (rediseñado)
│
├── A. Header
│     Título + dataset + status + acciones
│
├── B. ExecutiveSummary (nuevo componente)
│     QualityScoreGauge + veredicto + MiniMetricCards (×3) + IssueChips
│
├── C. PriorityIssues (enriquecido)
│     IssuesSummary (filtros) + tabla ordenada por severidad + columna "Metric"
│
├── D. MetricDetails (nuevo componente con tabs)
│     ├── Tab 1: CompletenessDetail.tsx (nuevo)
│     ├── Tab 2: UniquenessDetail.tsx (nuevo)
│     └── Tab 3: OutlierDetail.tsx (extraído del inline actual)
│
├── E. ColumnExplorer (ColumnMetricsTable.tsx mejorado)
│     Tabla con búsqueda + ordenación + highlight de problemas
│
└── F. ScoreCalculation (actual Score Breakdown en acordeón)
      Accordion cerrado por defecto
```

### Por qué esta estructura es mejor que la actual

1. **Responde a las preguntas en orden**: score → problemas → detalle → exploración → método. La actual mezcla detalle profundo (outlier detail) con resumen ejecutivo.
2. **Reduce el scroll obligatorio en ~60%**: los tabs agrupan el detalle de 3 métricas en un solo espacio; el acordeón oculta la metodología; las mini-cards comprimen el resumen.
3. **Elimina la asimetría**: las tres métricas tienen el mismo peso visual y nivel de detalle dentro de tabs simétricos.
4. **Mejora la navegabilidad**: sticky nav + tabs + enlaces internos permiten acceso directo a cualquier sección sin scroll lineal.
5. **Reduce la complejidad del archivo**: extrae ~500 líneas de JSX inline (outlier detail) a componentes dedicados, dejando `[id].tsx` más mantenible.

### Los 3 cambios más importantes a implementar primero

| Prioridad | Cambio | Razón |
|-----------|--------|-------|
| **#1** | **Mover Issues arriba** (posición 3 → posición 2, justo después del summary) e integrar `IssuesSummary.tsx` como filtros | Es un cambio de reordenación con impacto máximo: el usuario ve los problemas concretos sin hacer scroll largo. Esfuerzo: ~30 min. |
| **#2** | **Colapsar Score Breakdown** en `<Accordion>` cerrado por defecto | Libera espacio visual significativo y elimina la competencia entre metodología y diagnóstico. Esfuerzo: ~15 min. |
| **#3** | **Implementar tabs para Metric Details** y extraer `OutlierDetail.tsx` como componente | Es el cambio estructural clave: elimina la asimetría, reduce scroll, y prepara la base para crear `CompletenessDetail` y `UniquenessDetail`. Esfuerzo: ~2-3 horas. |

Estos tres cambios, en ese orden, transforman la experiencia de "lista larga de bloques" a "dashboard con narrativa clara y navegable".

---

## Apéndice: Componentes a crear/modificar

### Componentes nuevos
- `components/evaluations/ExecutiveSummary.tsx` — score + veredicto + mini-cards + issue chips
- `components/evaluations/MetricDetailsTabs.tsx` — contenedor de tabs
- `components/evaluations/CompletenessDetail.tsx` — detalle de completitud
- `components/evaluations/UniquenessDetail.tsx` — detalle de unicidad
- `components/evaluations/OutlierDetail.tsx` — extraído de las líneas 519-856 de [id].tsx
- `components/evaluations/StickyNav.tsx` — barra de navegación sticky
- `components/evaluations/MiniMetricCard.tsx` — tarjeta compacta clickable

### Componentes existentes a modificar
- `pages/evaluations/[id].tsx` — reestructurar orden de secciones, reducir de ~1050 a ~300 líneas
- `components/evaluations/ColumnMetricsTable.tsx` — añadir búsqueda, ordenación, highlight
- `components/evaluations/IssuesSummary.tsx` — integrar en la página (actualmente no se usa)
- `components/evaluations/QualityScoreGauge.tsx` — añadir prop para veredicto textual

### Dependencias MUI adicionales necesarias
- `Tabs`, `Tab`, `TabPanel` (de `@mui/lab` o custom)
- `Accordion`, `AccordionSummary`, `AccordionDetails`
- `TextField` (para búsqueda en Column Explorer)
- `Select`, `MenuItem` (para dropdown de columna en Outlier Detail)
