# Características del Dataset vs. Métricas de Evaluación

## ⚠️ IMPORTANTE: Distinción Conceptual

Este documento aclara una distinción crítica en el sistema de Data Profiling que debe mantenerse clara para evitar confusiones futuras.

---

## 📊 Características del Dataset (Dataset Characteristics)

**¿Qué son?**
Propiedades descriptivas **intrínsecas** del dataset que describen su contenido y estructura.

**Ejemplos:**
- **Completitud (Completeness)**: Porcentaje de valores no nulos
- **Unicidad (Uniqueness)**: Porcentaje de valores únicos / filas duplicadas
- **Outliers**: Valores atípicos detectados estadísticamente

**Características clave:**
- ✅ Son **descriptivas**, no evaluativas
- ✅ Describen **qué contiene** el dataset
- ✅ No implican juicio de "bueno" o "malo"
- ✅ Son **independientes** del contexto de negocio
- ✅ Se calculan automáticamente del dataset

**Ubicación actual:**
- `DataProfilingTab.tsx` - Sección "Valores nulos, registros duplicados y outliers"
- Componentes de visualización: `CompletenessDetail`, `UniquenessDetail`, `OutlierDetail`

---

## 🎯 Métricas de Evaluación (Evaluation Metrics)

**¿Qué son?**
Medidas de **calidad de datos** definidas por el usuario que evalúan si los datos cumplen con requisitos específicos.

**Ejemplos (futuros):**
- Validación de formato de email
- Rangos de valores permitidos
- Reglas de negocio personalizadas
- Consistencia entre columnas
- Conformidad con estándares

**Características clave:**
- ✅ Son **evaluativas**, implican juicio
- ✅ Evalúan si los datos son **adecuados para un propósito**
- ✅ Dependen del **contexto de negocio**
- ✅ Son **configurables** por el usuario
- ✅ Generan **issues** cuando no se cumplen

**Ubicación futura:**
- Sistema de evaluaciones (separado del profiling)
- Definición de reglas personalizadas
- Quality Gates y umbrales configurables

---

## 🔄 Estado Actual (Temporal)

### Reutilización de Componentes

Actualmente, los componentes del sistema de evaluaciones se **reutilizan temporalmente** para mostrar características del dataset:

```typescript
// DataProfilingTab.tsx - TEMPORAL
<MetricDetailsTabs 
  overallMetrics={evalOverallMetrics}  // ⚠️ Nombre engañoso - son características
  columnMetrics={evalColumnMetrics}     // ⚠️ Nombre engañoso - son características
  datasetId={datasetId} 
/>
```

**Variables con nombres temporales:**
- `evalColumnMetrics` → Debería ser `datasetCharacteristics` o similar
- `evalOverallMetrics` → Debería ser `overallCharacteristics` o similar
- `MetricDetailsTabs` → Se usa para características, no métricas

### Por qué esta confusión temporal

1. **Reutilización de código**: Los componentes de visualización ya existían
2. **Compatibilidad**: Mantener el formato permite usar los mismos componentes
3. **Desarrollo iterativo**: Se implementó profiling antes de separar conceptos

---

## 🚀 Plan de Refactorización Futura

### Fase 1: Separación de Interfaces
```typescript
// Nuevo: types/index.ts
export interface DatasetCharacteristics {
  completeness: number;
  uniqueness: number;
  outliers?: OutlierInfo[];
  // ... otras características descriptivas
}

export interface EvaluationMetrics {
  // Métricas de calidad definidas por el usuario
  customRules: Rule[];
  validationResults: ValidationResult[];
  // ... métricas evaluativas
}
```

### Fase 2: Componentes Dedicados
```typescript
// Nuevo componente para características
<DatasetCharacteristicsPanel 
  characteristics={datasetCharacteristics}
  datasetId={datasetId}
/>

// Componente existente solo para métricas
<MetricDetailsTabs 
  metrics={evaluationMetrics}
  evaluationId={evaluationId}
/>
```

### Fase 3: Separación de Rutas
- `/datasets/:id/profiling` → Características del dataset
- `/datasets/:id/evaluations/:evalId` → Métricas de evaluación

---

## 📝 Guía para Desarrolladores

### Al trabajar con características del dataset:
```typescript
// ✅ CORRECTO - Terminología clara
const datasetCharacteristics = calculateCharacteristics(dataset);
const completenessRate = datasetCharacteristics.completeness;

// ❌ INCORRECTO - Confunde con métricas de evaluación
const metrics = calculateMetrics(dataset);
const completenessMetric = metrics.completeness;
```

### Al trabajar con métricas de evaluación:
```typescript
// ✅ CORRECTO - Métricas evaluativas
const evaluationMetrics = runEvaluation(dataset, rules);
const emailValidationMetric = evaluationMetrics.emailFormat;

// ❌ INCORRECTO - Confunde con características
const characteristics = runEvaluation(dataset, rules);
```

---

## 🎓 Resumen Conceptual

| Aspecto | Características del Dataset | Métricas de Evaluación |
|---------|----------------------------|------------------------|
| **Propósito** | Describir el dataset | Evaluar calidad |
| **Naturaleza** | Descriptiva | Evaluativa |
| **Dependencia** | Independiente del contexto | Depende del contexto de negocio |
| **Configuración** | Automática | Definida por el usuario |
| **Resultado** | Información estadística | Issues/Alertas |
| **Ejemplo** | "98% de valores únicos" | "Email inválido detectado" |

---

## 📌 Recordatorio Final

**Completitud, Unicidad y Outliers NO son métricas de evaluación.**

Son **características descriptivas** del dataset que ayudan a entender su contenido, pero no evalúan si los datos son "buenos" o "malos" para un propósito específico.

Las **métricas de evaluación** vendrán después, cuando el usuario defina reglas de negocio y requisitos de calidad específicos.

---

*Documento creado: 2026-03-21*  
*Última actualización: 2026-03-21*
