# Configuración de Métricas para el Dataset de Prueba

Este documento describe cómo configurar cada métrica disponible en DataQual usando los datasets
de prueba generados por `generate_test_datasets.py`.

## Dataset de prueba

| Columna | Tipo | Propósito |
|---|---|---|
| `id` | entero | Identificador único de fila |
| `nombre` | texto | Nombre completo (con nulos en v1/v2) |
| `email` | texto | Correo electrónico formato `nombre.apellido@empresa.com` |
| `telefono` | texto | Teléfono español sin espacios (`6XXXXXXXX`) |
| `departamento` | categórico | 7 posibles valores: Ventas, Marketing, Ingeniería... |
| `ciudad` | texto | Ciudad española (con nulos en v1) |
| `salario` | numérico | Salario anual en euros (con outliers en v1/v2) |
| `fecha_contratacion` | fecha ISO | Fecha de alta del empleado (con valores inválidos en v1) |
| `dni` | texto | DNI español `12345678A` (con valores inválidos en v1/v2) |
| `codigo_postal` | texto | Código postal español de 5 dígitos (con valores inválidos en v1/v2) |
| `nivel_experiencia` | categórico | Junior / Senior / Lead |
| `fecha_actualizacion` | fecha ISO | Última actualización del registro (reciente en v3, antigua en v1) |

---

## Quality Gate recomendado

Configura el Quality Gate del proyecto con `min_score: 0.80` (80%).

Resultados esperados por versión:

| Dataset | Score esperado | Estado |
|---|---|---|
| `clientes_v1_desastre.csv` | ~35% | FAILED |
| `clientes_v2_mejorado.csv` | ~65% | WARNING |
| `clientes_v3_limpio.csv` | ~92% | PASSED |

---

## Configuración de cada métrica

### 1. Completeness (Completitud)

Mide el porcentaje de valores no nulos en las columnas críticas.

```json
{
  "type": "completeness",
  "name": "Completitud de campos obligatorios",
  "parameters": {
    "columns": ["nombre", "email", "telefono", "ciudad", "dni", "codigo_postal"],
    "threshold": 0.95,
    "weight": 1.5
  }
}
```

**Comportamiento por versión:**
- v1: ~65-70% completitud (nulos masivos en email, teléfono, nombre, DNI, CP) → issue crítico
- v2: ~88-90% completitud → issue de severidad media
- v3: ~99% completitud (solo 2 nulos puntuales) → sin issues

---

### 2. Uniqueness (Unicidad)

Detecta filas duplicadas y columnas que deben ser únicas como identificadores.

```json
{
  "type": "uniqueness",
  "name": "Unicidad de registros e identificadores",
  "parameters": {
    "columns": ["id", "dni"],
    "threshold": 1.0,
    "weight": 1.5
  }
}
```

**Comportamiento por versión:**
- v1: 5 filas duplicadas + 3 filas fantasma → unicidad ~97%
- v2: 1 fila duplicada → unicidad ~99.5%
- v3: sin duplicados → unicidad 100%

---

### 3. Outliers (Valores Atípicos)

Detecta salarios anómalos mediante el método IQR.

```json
{
  "type": "outliers",
  "name": "Detección de salarios atípicos",
  "parameters": {
    "method": "iqr",
    "factor": 1.5,
    "columns": ["salario"],
    "weight": 1.0
  }
}
```

**Comportamiento por versión:**
- v1: ~20% de salarios extremos (-5000, 999999999, etc.) → issue crítico
- v2: ~8% de salarios anómalos (-1000, 200000) → issue medio
- v3: sin outliers → puntuación 1.0

> **Nota:** Con `factor: 1.5` (IQR estándar). Usa `factor: 3.0` si quieres detectar solo outliers muy extremos.

---

### 4. Syntactic Accuracy (Precisión Sintáctica)

Valida que los valores cumplan los formatos esperados mediante patrones regex.

```json
{
  "type": "syntactic_accuracy",
  "name": "Validación de formatos de datos",
  "parameters": {
    "threshold": 0.95,
    "columns": [
      { "column": "email",              "expected_type": "email" },
      { "column": "telefono",           "expected_type": "phone_es" },
      { "column": "dni",                "expected_type": "dni_es" },
      { "column": "codigo_postal",      "expected_type": "postal_code_es" },
      { "column": "fecha_contratacion", "expected_type": "date_iso" }
    ],
    "weight": 1.0
  }
}
```

**Patrones aplicados:**

| Columna | Tipo | Patrón |
|---|---|---|
| `email` | `email` | `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$` |
| `telefono` | `phone_es` | `^(\+34)?[6-9]\d{8}$` |
| `dni` | `dni_es` | `^\d{8}[A-Za-z]$` |
| `codigo_postal` | `postal_code_es` | `^\d{5}$` |
| `fecha_contratacion` | `date_iso` | `^\d{4}-\d{2}-\d{2}$` |

**Comportamiento por versión:**
- v1: ~55-65% de conformidad (emails inválidos, teléfonos rotos, DNIs corruptos, fechas inválidas)
- v2: ~85-88% de conformidad
- v3: ~99% de conformidad

---

### 5. Logical Consistency (Consistencia Lógica)

Valida reglas de negocio cross-columna mediante expresiones pandas.

```json
{
  "type": "logical_consistency",
  "name": "Reglas de negocio de RRHH",
  "parameters": {
    "rules": [
      {
        "name": "salario_positivo",
        "type": "violation",
        "expression": "salario <= 0"
      },
      {
        "name": "lead_salario_minimo",
        "type": "if_then",
        "condition": "nivel_experiencia == 'Lead'",
        "assertion": "salario >= 50000"
      },
      {
        "name": "salario_maximo_razonable",
        "type": "violation",
        "expression": "salario > 300000"
      }
    ],
    "weight": 1.0
  }
}
```

**Reglas configuradas:**

| Regla | Descripción | Tipo |
|---|---|---|
| `salario_positivo` | El salario no puede ser 0 ni negativo | violation |
| `lead_salario_minimo` | Un Lead debe cobrar al menos 50.000 € | if_then |
| `salario_maximo_razonable` | Ningún empleado cobra más de 300.000 € | violation |

**Comportamiento por versión:**
- v1: múltiples violaciones (salarios negativos, cero, millonarios; Leads con salario bajo)
- v2: pocas violaciones (algún -1000 o 0, algunos Leads con salario < 50k)
- v3: cumplimiento total → puntuación 1.0

---

### 6. Class Balance (Equilibrio de Clases)

Mide si la distribución de valores categóricos es equilibrada o presenta clases dominantes.

```json
{
  "type": "class_balance",
  "name": "Equilibrio de distribuciones categóricas",
  "parameters": {
    "columns": ["departamento", "nivel_experiencia"],
    "imbalance_threshold_high": 0.70,
    "imbalance_threshold_low": 0.05,
    "weight": 0.8
  }
}
```

**Distribución de `nivel_experiencia` por versión:**

| Versión | Junior | Senior | Lead | Estado |
|---|---|---|---|---|
| v1 | ~80% | ~15% | ~5% | Desbalanceado (Junior dominante) |
| v2 | ~50% | ~35% | ~15% | Moderadamente desbalanceado |
| v3 | ~34% | ~34% | ~32% | Equilibrado |

> Con `imbalance_threshold_high: 0.70` se detecta cuando una clase supera el 70% del total.

---

### 7. Timeliness (Frescura Temporal)

Mide la antigüedad de los registros de fecha. Usa `fecha_actualizacion`, que representa cuándo
fue actualizado el registro por última vez.

```json
{
  "type": "timeliness",
  "name": "Frescura de la última actualización",
  "parameters": {
    "columns": ["fecha_actualizacion"],
    "staleness_threshold_days": 365,
    "weight": 1.0
  }
}
```

**Fechas de `fecha_actualizacion` por versión:**

| Versión | Rango de fechas | Antigüedad desde 2026-03-31 | Resultado |
|---|---|---|---|
| v1 | 2020 – 2022 | 1.460 – 2.300 días | Datos obsoletos (crítico) |
| v2 | 2024 | 365 – 730 días | Parcialmente obsoletos |
| v3 | 2026-03-01 – 2026-03-31 | 0 – 30 días | Datos frescos |

> Con `staleness_threshold_days: 365`, los registros de v3 son frescos (< 1 año), los de v2 están
> en el límite, y los de v1 son claramente obsoletos.

---

## Resumen de configuración completa

A continuación se muestra la configuración completa de las 7 métricas para copiar y pegar
al crear el proyecto en DataQual:

```json
[
  {
    "type": "completeness",
    "name": "Completitud de campos obligatorios",
    "parameters": {
      "columns": ["nombre", "email", "telefono", "ciudad", "dni", "codigo_postal"],
      "threshold": 0.95,
      "weight": 1.5
    }
  },
  {
    "type": "uniqueness",
    "name": "Unicidad de registros e identificadores",
    "parameters": {
      "columns": ["id", "dni"],
      "threshold": 1.0,
      "weight": 1.5
    }
  },
  {
    "type": "outliers",
    "name": "Detección de salarios atípicos",
    "parameters": {
      "method": "iqr",
      "factor": 1.5,
      "columns": ["salario"],
      "weight": 1.0
    }
  },
  {
    "type": "syntactic_accuracy",
    "name": "Validación de formatos de datos",
    "parameters": {
      "threshold": 0.95,
      "columns": [
        { "column": "email",              "expected_type": "email" },
        { "column": "telefono",           "expected_type": "phone_es" },
        { "column": "dni",                "expected_type": "dni_es" },
        { "column": "codigo_postal",      "expected_type": "postal_code_es" },
        { "column": "fecha_contratacion", "expected_type": "date_iso" }
      ],
      "weight": 1.0
    }
  },
  {
    "type": "logical_consistency",
    "name": "Reglas de negocio de RRHH",
    "parameters": {
      "rules": [
        {
          "name": "salario_positivo",
          "type": "violation",
          "expression": "salario <= 0"
        },
        {
          "name": "lead_salario_minimo",
          "type": "if_then",
          "condition": "nivel_experiencia == 'Lead'",
          "assertion": "salario >= 50000"
        },
        {
          "name": "salario_maximo_razonable",
          "type": "violation",
          "expression": "salario > 300000"
        }
      ],
      "weight": 1.0
    }
  },
  {
    "type": "class_balance",
    "name": "Equilibrio de distribuciones categóricas",
    "parameters": {
      "columns": ["departamento", "nivel_experiencia"],
      "imbalance_threshold_high": 0.70,
      "imbalance_threshold_low": 0.05,
      "weight": 0.8
    }
  },
  {
    "type": "timeliness",
    "name": "Frescura de la última actualización",
    "parameters": {
      "columns": ["fecha_actualizacion"],
      "staleness_threshold_days": 365,
      "weight": 1.0
    }
  }
]
```
