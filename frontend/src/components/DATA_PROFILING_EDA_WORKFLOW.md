# Flujo de EDA (Exploratory Data Analysis) en Data Profiling

## Descripción General

El componente `DataProfilingTab` implementa un flujo completo de **Análisis Exploratorio de Datos (EDA)** que permite a los usuarios comprender la estructura, distribución y características de sus datasets de manera progresiva y visual.

## Arquitectura del Flujo EDA

### 1. **Principio de Divulgación Progresiva (Progressive Disclosure)**

El flujo EDA está diseñado siguiendo el principio de **progressive disclosure**, donde la información se presenta en capas jerárquicas que van de lo general a lo específico:

```
Nivel 1: Resumen General (Overview)
    ↓
Nivel 2: Características del Dataset (Completitud, Unicidad, Outliers)
    ↓
Nivel 3: Análisis Detallado por Característica
    ↓
Nivel 4: Análisis por Columna Individual
    ↓
Nivel 5: Análisis de Relaciones (Correlación y Dispersión)
```

### 2. **Gestión de Estado de Secciones**

Todas las secciones son **colapsables** y se gestionan mediante un estado centralizado:

```typescript
type SectionKey = 'overview' | 'metricDetails' | 'columns' | 'correlation' | 'scatter';
```

**Estado por defecto:**
- `overview`: Colapsado (información básica visible en subtitle)
- `metricDetails`: Colapsado (accesible mediante tarjetas métricas)
- `columns`: Colapsado (análisis detallado bajo demanda)
- `correlation`: Colapsado (análisis avanzado)
- `scatter`: Colapsado (visualización interactiva)

---

## Fases del Flujo EDA

### **FASE 1: Carga y Transformación de Datos**

#### 1.1 Obtención del Profiling
```typescript
useEffect(() => {
  const fetchProfiling = async () => {
    const res = await datasetsAPI.getDatasetProfiling(datasetId);
    setProfiling(data);
  };
  fetchProfiling();
}, [datasetId]);
```

**Datos obtenidos:**
- `overview`: Volumetría general (filas, columnas, celdas, tamaño)
- `type_summary`: Distribución de tipos de datos (numéricos vs categóricos)
- `columns`: Información detallada por columna
- `correlation_matrix`: Matriz de correlación de Pearson para variables numéricas

#### 1.2 Transformación a Formato de Evaluación

**NOTA IMPORTANTE:** El sistema actualmente reutiliza componentes de evaluación para mostrar **características del dataset** (NO métricas de calidad):

```typescript
const { evalColumnMetrics, evalOverallMetrics } = useMemo(() => {
  // Construir características por columna
  const cm: Record<string, ColumnMetrics> = {};
  
  for (const col of profiling.columns) {
    cm[col.name] = {
      completeness: col.n_valid / (col.n_valid + col.n_missing),
      uniqueness: col.n_unique / col.n_valid,
      n_nulls: col.n_missing,
      n_non_nulls: col.n_valid,
      // ... estadísticas descriptivas
    };
  }
  
  // Características generales del dataset
  const overallCompleteness = (total_cells - total_missing) / total_cells;
  const overallUniqueness = (total_rows - duplicate_rows) / total_rows;
  
  return { evalColumnMetrics: cm, evalOverallMetrics: {...} };
}, [profiling]);
```

**Características calculadas:**
- **Completitud global**: % de celdas con valores válidos
- **Unicidad global**: % de registros únicos (no duplicados)
- **Outliers por columna**: Valores atípicos detectados mediante método IQR

---

### **FASE 2: Resumen del Dataset (Overview)**

#### 2.1 Volumetría Compacta

Presenta 6 métricas clave en formato inline:

| Métrica | Descripción | Formato |
|---------|-------------|---------|
| **Filas** | Total de registros | `overview.total_rows.toLocaleString()` |
| **Columnas** | Total de variables | `overview.total_columns` |
| **Celdas** | Filas × Columnas | `overview.total_cells.toLocaleString()` |
| **Tamaño** | Estimación en bytes | `formatBytes(overview.estimated_size_bytes)` |
| **Numéricas** | Columnas numéricas + % | `${numeric_count} (${numPct}%)` |
| **Categóricas** | Columnas categóricas + % | `${categorical_count} (${catPct}%)` |

#### 2.2 Tarjetas de Características del Dataset

Tres **MetricCards** interactivas que resumen las características principales:

##### **A) Valores Nulos (Completitud)**
```typescript
<MetricCard
  title="Valores nulos"
  value={`${nullPct}%`}  // % de valores nulos
  badge={compBadge}      // Badge según thresholds
  insight={`${nullCols} de ${total_columns} columnas con nulos`}
  onDetail={openValoresNulos}  // Abre tab 0 de MetricDetailsTabs
/>
```

**Sistema de Badges:**
- ≥ 98% completo → **Excelente** (verde)
- ≥ 95% completo → **Bueno** (verde claro)
- ≥ 90% completo → **Aceptable** (amarillo)
- ≥ 80% completo → **Requiere atención** (naranja)
- < 80% completo → **Crítico** (rojo)

##### **B) Registros Duplicados (Unicidad)**
```typescript
<MetricCard
  title="Registros duplicados"
  value={`${dupPct}%`}   // % de registros duplicados
  badge={uniqBadge}      // Badge basado en unicidad
  insight={`${duplicate_rows} fila(s) duplicada(s)`}
  onDetail={openRegistrosDuplicados}  // Abre tab 1
/>
```

##### **C) Outliers (Valores Atípicos)**
```typescript
<MetricCard
  title="Outliers detectados"
  value={String(totalOutliers)}  // Cantidad total de outliers
  badge={outBadge}               // Badge informativo (NO indica calidad)
  insight={`${outlierColCount} columna(s) · ${outlierProp}% de valores`}
  onDetail={openOutliers}        // Abre tab 2
/>
```

**Cálculo de outliers:**
- Se agregan outliers de todas las columnas numéricas
- Densidad = `totalOutliers / totalOutlierVals`
- **Badge informativo** (NO indica calidad automáticamente):
  - Sin outliers → "Sin outliers" (verde)
  - < 1% → "Muy pocos" (azul)
  - 1-5% → "Algunos" (morado)
  - 5-10% → "Moderados" (amarillo)
  - ≥ 10% → "Frecuentes" (naranja)

**IMPORTANTE:** Los outliers NO son automáticamente indicadores de mala calidad. Pueden ser valores legítimos según el contexto de la variable (ej: salarios ejecutivos, transacciones grandes, eventos raros).

---

### **FASE 3: Análisis Detallado de Características**

#### 3.1 Componente MetricDetailsTabs

Cuando el usuario hace clic en una **MetricCard**, se abre la sección `metricDetails` con el tab correspondiente:

```typescript
const openAnalysisDetails = useCallback((tabIndex: number = 0) => {
  setInitialMetricTab(tabIndex);
  setSections(prev => ({ ...prev, metricDetails: true }));
  setTimeout(() => {
    document.getElementById('profiling-analysis-details')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, 100);
}, []);
```

**Tabs disponibles:**
- **Tab 0**: Valores nulos (completitud por columna)
- **Tab 1**: Registros duplicados (análisis de unicidad)
- **Tab 2**: Outliers (valores atípicos con detalles estadísticos)

#### 3.2 Navegación Inteligente

El sistema implementa **scroll automático** para mejorar la UX:
1. Usuario hace clic en MetricCard
2. Sección se expande
3. Scroll suave hacia `#profiling-analysis-details`
4. Tab específico se activa automáticamente

---

### **FASE 4: Análisis por Columna Individual**

#### 4.1 Estructura de Acordeones

Cada columna se presenta en un **Accordion** con información resumida en el header:

```typescript
<AccordionSummary>
  <Chip label={category === 'numeric' ? 'NUM' : 'CAT'} />
  <Typography>{col.name}</Typography>
  <Chip label={getSubTypeLabel(col.sub_type)} />  // Continua, Discreta, etc.
  <Typography>{col.n_unique} únicos</Typography>
  <MiniCompletenessBar value={compColPct} />      // Barra inline
</AccordionSummary>
```

**Subtipos de columnas:**
- **Numéricas**: `continuous`, `discrete`, `binary`
- **Categóricas**: `nominal`, `text`, `binary`

#### 4.2 Análisis de Columnas Numéricas

Cuando se expande un acordeón numérico, se muestran:

##### **A) Estadísticas Descriptivas (Grid 8 elementos)**
```typescript
[
  { label: 'Media', value: col.mean },
  { label: 'Mediana', value: col.median },
  { label: 'Desv. Est.', value: col.std },
  { label: 'Mín', value: col.min },
  { label: 'Máx', value: col.max },
  { label: 'Q1', value: col.q1 },
  { label: 'Q3', value: col.q3 },
  { label: 'IQR', value: col.iqr },
]
```

##### **B) Visualizaciones (Grid 2 columnas)**

**1. Histograma (EnhancedHistogramCard):**
- Muestra distribución de frecuencias
- Bins configurables desde backend
- Gradiente verde (#00B37E)
- Tooltip con rango, frecuencia y porcentaje
- Botón de expansión a modal fullscreen

```typescript
chartData = {
  labels: column.histogram.bins.map(b => b.toFixed(1)),
  datasets: [{
    data: column.histogram.counts,
    backgroundColor: gradient(#00B37E),
    borderRadius: 4,
  }]
}
```

**2. Boxplot (EnhancedBoxplotCard):**
- Visualización SVG personalizada
- Elementos interactivos con tooltips:
  - **Lower whisker**: Límite inferior (Q1 - 1.5×IQR)
  - **Upper whisker**: Límite superior (Q3 + 1.5×IQR)
  - **IQR Box**: Caja intercuartílica (Q1 a Q3)
  - **Median line**: Línea de mediana (Q2)
  - **Outliers**: Círculos rojos para valores atípicos
- Muestra hasta 25 outliers (50 en modal expandido)
- Contador de outliers detectados

```typescript
const toX = (v: number) => ((v - min) / range) * 990 + 5;
// Mapeo de valores a coordenadas SVG
```

#### 4.3 Análisis de Columnas Categóricas

##### **A) Estadísticas Clave (2 tarjetas)**
```typescript
<Box>Valores únicos: {col.n_unique.toLocaleString()}</Box>
<Box>Moda (más frecuente): {col.mode}</Box>
```

##### **B) Gráfico de Barras (EnhancedBarChartCard)**
- Top 20 categorías más frecuentes
- Orientación automática:
  - Horizontal si > 8 categorías
  - Vertical si ≤ 8 categorías
- Tooltip con frecuencia, porcentaje y total
- Gradiente verde (#00B37E)

```typescript
chartOptions = {
  indexAxis: labels.length > 8 ? 'y' : 'x',
  // ...
}
```

---

### **FASE 5: Análisis de Relaciones entre Variables**

#### 5.1 Matriz de Correlación (Pearson)

**Condición de renderizado:**
```typescript
{correlation_matrix && (
  <CollapsibleSection title="Matriz de correlación">
    {/* Solo para variables numéricas */}
  </CollapsibleSection>
)}
```

##### **A) Estructura de la Matriz**

Tabla HTML con estilos personalizados:
- **Diagonal**: Valores 1.00 (autocorrelación) con fondo gris
- **Fuera de diagonal**: Valores de correlación con código de color

##### **B) Sistema de Colores**

```typescript
const correlationColor = (v: number) => {
  const abs = Math.abs(v);
  
  // Correlación débil (|v| < 0.05): Gris claro
  if (abs < 0.05) return { bg: '#FAFAFA', text: '#999' };
  
  // Correlación positiva: Gradiente rojo
  if (v > 0) return { bg: `rgb(255-abs*50, 220-abs*180, ...)`, ... };
  
  // Correlación negativa: Gradiente azul
  return { bg: `rgb(..., ..., 255-abs*50)`, ... };
};
```

**Escala visual:**
- **-1.0**: Azul intenso (correlación negativa perfecta)
- **-0.7 a -0.3**: Azul moderado
- **-0.3 a +0.3**: Gris claro (correlación débil)
- **+0.3 a +0.7**: Rojo moderado
- **+1.0**: Rojo intenso (correlación positiva perfecta)

##### **C) Interactividad**

**Hover effects:**
```typescript
onMouseEnter: {
  transform: 'scale(1.15)',
  boxShadow: '0 4px 12px rgba(0,179,126,0.25)',
  zIndex: 10,
  border: '1px solid #ffffff',
  fontWeight: 700
}
```

**Click handler:**
```typescript
const handleClick = () => {
  if (!isDiagonal) {
    setScatterX(correlation_matrix.columns[i]);
    setScatterY(correlation_matrix.columns[j]);
    setSections(prev => ({ ...prev, scatter: true }));
    // Scroll automático a sección scatter
  }
};
```

**Tooltips informativos:**
- Diagonal: "Correlación perfecta consigo misma"
- Fuera diagonal:
  - Nombres de variables
  - Coeficiente (4 decimales)
  - Interpretación: débil/moderada/fuerte + positiva/negativa
  - Hint: "Click para ver gráfico de dispersión"

##### **D) Leyenda de Correlación**

Gradiente visual con etiquetas:
```
[-1.0 Negativa] ←─── Gradiente ───→ [+1.0 Positiva]
     Azul                                 Rojo
```

#### 5.2 Gráfico de Dispersión (Scatter Plot)

**Condición de renderizado:**
```typescript
{type_summary.numeric_columns.length >= 2 && (
  <CollapsibleSection title="Dispersión">
    {/* Requiere al menos 2 variables numéricas */}
  </CollapsibleSection>
)}
```

##### **A) Selectores de Ejes**

Dos `FormControl` con `Select`:
```typescript
<Select value={scatterX} onChange={(e) => setScatterX(e.target.value)}>
  {type_summary.numeric_columns.map(c => <MenuItem value={c}>{c}</MenuItem>)}
</Select>

<Select value={scatterY} onChange={(e) => setScatterY(e.target.value)}>
  {type_summary.numeric_columns.map(c => <MenuItem value={c}>{c}</MenuItem>)}
</Select>
```

**Inicialización automática:**
```typescript
useEffect(() => {
  if (profiling && numeric_columns.length >= 2) {
    setScatterX(numeric_columns[0]);
    setScatterY(numeric_columns[1]);
  }
}, [profiling]);
```

##### **B) Componente ScatterPlotChart**

**Carga de datos bajo demanda:**
```typescript
useEffect(() => {
  const fetchData = async () => {
    const res = await datasetsAPI.previewDataset(datasetId);
    const rows = res.data?.data ?? [];
    setPoints(
      rows.map(r => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) }))
          .filter(p => !isNaN(p.x) && !isNaN(p.y))
    );
  };
  fetchData();
}, [datasetId, xCol, yCol]);
```

**Configuración del gráfico:**
```typescript
chartData = {
  datasets: [{
    data: points,  // Array de {x, y}
    backgroundColor: 'rgba(0,179,126,0.5)',
    borderColor: 'rgba(0,179,126,0.8)',
    pointRadius: 3.5,
    pointHoverRadius: 6,
  }]
}
```

**Características:**
- Ejes con títulos (nombres de columnas)
- Grid con color #F0F0F0
- Tooltip con valores de ambas variables
- Botón de expansión a modal fullscreen
- Animación suave (750ms, easeInOutQuart)

---

## Componentes Reutilizables

### 1. **CollapsibleSection**

Wrapper para todas las secciones principales:

```typescript
<CollapsibleSection
  id="section-id"              // Para scroll automático
  icon={<Icon />}              // Icono identificativo
  title="Título"               // Título principal
  subtitle="Subtítulo"         // Info resumida cuando colapsado
  count={number}               // Badge con cantidad (opcional)
  open={boolean}               // Estado de expansión
  onToggle={() => toggle()}    // Handler de toggle
>
  {children}
</CollapsibleSection>
```

**Características:**
- Hover effect (#FAFAFA)
- Transición suave (250ms)
- Scroll margin top (80px) para navegación
- Border y border-radius consistentes

### 2. **MetricCard**

Tarjeta interactiva para características del dataset:

```typescript
<MetricCard
  title="Título"
  value="Valor principal"
  badge={{ label, bg, color }}  // Badge de calidad
  insight="Texto explicativo"
  onDetail={() => openDetail()}
/>
```

**Interactividad:**
- Cursor pointer
- Hover: border azul + box-shadow
- Click: abre sección detallada + scroll automático

### 3. **ChartModal**

Modal fullscreen para visualizaciones expandidas:

```typescript
<ChartModal
  open={boolean}
  onClose={() => setModalOpen(false)}
  title="Título del gráfico"
>
  <Box sx={{ height: 450 }}>
    {/* Gráfico expandido */}
  </Box>
</ChartModal>
```

**Características:**
- Transición Fade
- Background gradient
- Box-shadow profundo
- Botón de cierre con animación de rotación
- Título con gradient text

### 4. **EnhancedBoxplot**

Componente SVG personalizado para boxplots:

```typescript
<EnhancedBoxplot
  boxplot={column.boxplot}
  columnName={column.name}
  onExpand={() => setModalOpen(true)}
  isExpanded={false}
/>
```

**Elementos SVG:**
- Whiskers (límites inferior/superior)
- IQR Box con gradiente
- Median line
- Outliers como círculos rojos
- Tooltips informativos en cada elemento
- Etiquetas de min/max

---

## Flujo de Interacción del Usuario

### **Escenario 1: Exploración Rápida**

1. Usuario abre tab "Data Profiling"
2. Ve resumen colapsado con volumetría en subtitle
3. Observa 3 MetricCards con valores destacados
4. Identifica problema (ej: 15% valores nulos)
5. Click en "Valores nulos" → scroll + apertura de detalle
6. Revisa tabla de completitud por columna

### **Escenario 2: Análisis de Distribución**

1. Expande sección "Análisis por columna"
2. Identifica columna de interés en headers (ej: "edad")
3. Expande acordeón de "edad"
4. Revisa estadísticas descriptivas (media, mediana, std)
5. Analiza histograma para detectar sesgos
6. Examina boxplot para identificar outliers
7. Click en botón fullscreen para vista ampliada

### **Escenario 3: Análisis de Correlaciones**

1. Expande sección "Matriz de correlación"
2. Identifica correlación fuerte (ej: 0.87 entre "precio" y "tamaño")
3. Hover sobre celda para ver interpretación
4. Click en celda → auto-selección en scatter plot
5. Scroll automático a sección "Dispersión"
6. Visualiza relación lineal en scatter plot
7. Expande modal para análisis detallado

### **Escenario 4: Comparación de Variables**

1. Expande sección "Dispersión"
2. Selecciona variable X (ej: "ingresos")
3. Selecciona variable Y (ej: "gastos")
4. Observa patrón de dispersión
5. Cambia variables para explorar otras relaciones
6. Vuelve a matriz de correlación para confirmar coeficiente

---

## Optimizaciones de Performance

### 1. **Memoización de Cálculos**

```typescript
const { evalColumnMetrics, evalOverallMetrics } = useMemo(() => {
  // Cálculos pesados solo cuando cambia profiling
}, [profiling]);
```

### 2. **Lazy Loading de Scatter Plot**

```typescript
// Solo carga datos cuando se seleccionan ejes específicos
useEffect(() => {
  fetchScatterData();
}, [datasetId, xCol, yCol]);
```

### 3. **Cancelación de Requests**

```typescript
useEffect(() => {
  let cancelled = false;
  fetchData().then(data => {
    if (!cancelled) setData(data);
  });
  return () => { cancelled = true; };
}, [deps]);
```

### 4. **Renderizado Condicional**

```typescript
// Solo renderiza matriz si existe
{correlation_matrix && <CorrelationMatrix />}

// Solo renderiza scatter si hay ≥2 variables numéricas
{numeric_columns.length >= 2 && <ScatterPlot />}
```

---

## Consideraciones de UX

### 1. **Feedback Visual Inmediato**

- Loading spinners durante fetch
- Transiciones suaves (250-750ms)
- Hover effects en elementos interactivos
- Color coding consistente

### 2. **Navegación Inteligente**

- Scroll automático a secciones relevantes
- Apertura automática de secciones relacionadas
- Breadcrumbs visuales mediante badges

### 3. **Tooltips Informativos**

- Explicaciones contextuales en hover
- Interpretaciones de valores estadísticos
- Hints de interacción ("Click para...")

### 4. **Responsive Design**

- Grid adaptativo (auto-fit, minmax)
- Orientación de gráficos según cantidad de datos
- Modales fullscreen para análisis detallado

### 5. **Accesibilidad**

- Contraste de colores adecuado
- Tooltips con aria-labels
- Keyboard navigation en selectores
- Focus states visibles

---

## Limitaciones y Futuras Mejoras

### **Limitaciones Actuales**

1. **Reutilización de componentes de evaluación**: Se usa `MetricDetailsTabs` para mostrar características (no métricas)
2. **Scatter plot limitado**: Solo muestra datos del preview (no todo el dataset)
3. **Outliers sample**: Máximo 50 outliers visualizados en boxplot expandido
4. **Correlación solo Pearson**: No incluye Spearman o Kendall

### **Mejoras Planificadas**

1. **Separación de componentes**: Crear componentes específicos para características del dataset
2. **Sampling inteligente**: Implementar sampling estratificado para scatter plots grandes
3. **Más métodos de correlación**: Agregar opciones de Spearman y Kendall
4. **Detección de patrones**: Identificar automáticamente distribuciones (normal, uniforme, etc.)
5. **Exportación de reportes**: Generar PDF con análisis completo
6. **Comparación de datasets**: Permitir comparar perfiles de múltiples datasets

---

## Conclusión

El flujo EDA implementado en `DataProfilingTab` sigue las mejores prácticas de análisis exploratorio de datos:

1. ✅ **Visión general primero** (overview → detalles)
2. ✅ **Divulgación progresiva** (secciones colapsables)
3. ✅ **Visualizaciones múltiples** (histogramas, boxplots, scatter, correlación)
4. ✅ **Interactividad** (click, hover, modales)
5. ✅ **Navegación inteligente** (scroll automático, auto-selección)
6. ✅ **Feedback visual** (badges, colores, tooltips)

Este diseño permite tanto **exploraciones rápidas** (overview + metric cards) como **análisis profundos** (correlaciones + scatter plots), adaptándose a las necesidades de diferentes tipos de usuarios.
