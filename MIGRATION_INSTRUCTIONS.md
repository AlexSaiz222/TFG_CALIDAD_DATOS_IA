# Instrucciones para Aplicar Migración de Métricas

## Resumen de Cambios

Se ha creado una migración para:
1. **Eliminar métricas obsoletas** de la base de datos: `drift`, `distribution`, `accuracy`, `consistency`
2. **Traducir descripciones al español** para todas las métricas existentes
3. **Actualizar referencias en el frontend** para eliminar métricas obsoletas

## Archivos Modificados

### Backend
- **Nueva migración**: `backend/migrations/versions/remove_obsolete_metrics_and_translate.py`
  - Elimina métricas obsoletas (drift, distribution, accuracy)
  - Traduce descripciones de métricas al español
  - Actualiza parámetros por defecto

### Frontend
- **`frontend/src/pages/projects/[id].tsx`**: Eliminada referencia a métrica 'drift'
- **`frontend/src/pages/evaluations/[id].tsx`**: Traducido "Syntactic Accuracy" → "Exactitud sintáctica"
- **`frontend/src/components/evaluations/MetricDetailsTabs.tsx`**: Traducidos nombres de métricas con capitalización correcta

## Cómo Aplicar la Migración

### Opción 1: Usando Flask-Migrate (Recomendado)

```bash
cd backend
# Activar entorno virtual si lo tienes
# source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate   # Windows

# Aplicar la migración
flask db upgrade
```

### Opción 2: Aplicar SQL Manualmente

Si prefieres revisar los cambios antes de aplicarlos, puedes generar el SQL:

```bash
cd backend
flask db upgrade --sql > migration.sql
# Revisar migration.sql y ejecutarlo en tu base de datos
```

## Métricas Afectadas

### Métricas Eliminadas
- ❌ `drift` - Ya no disponible
- ❌ `distribution` - Ya no disponible  
- ❌ `accuracy` - Ya no disponible (reemplazada por `syntactic_accuracy`)
- ❌ `consistency` - Ya no disponible (su funcionalidad está cubierta por `syntactic_accuracy` con patrones custom)

### Métricas Actualizadas (Traducciones)

| Métrica | Descripción Anterior (EN) | Descripción Nueva (ES) |
|---------|---------------------------|------------------------|
| `completeness` | Measures the percentage of non-null values | Mide el porcentaje de valores no nulos en cada columna. Detecta campos vacíos, nulos o faltantes que pueden afectar la calidad del análisis. |
| `uniqueness` | Detects duplicate rows and measures value variability | Detecta filas duplicadas y mide la variabilidad de valores únicos por columna. Identifica problemas de duplicación y baja cardinalidad. |
| `outliers` | Detects outliers in numeric columns | Detecta valores atípicos en columnas numéricas usando métodos estadísticos (IQR, Z-score). Identifica datos anómalos que pueden ser errores o casos excepcionales. |
| `syntactic_accuracy` | Validates that values conform to expected data types... | Valida que los valores cumplan con el tipo de dato esperado, patrones regex o restricciones de longitud. Detecta violaciones de formato como emails inválidos, fechas malformadas o IDs incorrectos. |
| `logical_consistency` | Validates cross-field logical rules within each record | Valida reglas lógicas entre campos dentro de cada registro. Detecta inconsistencias como un paciente fallecido con cita futura o una fecha de fin anterior a la fecha de inicio. |
| `class_balance` | Measures the distribution balance of categorical variables | Mide el equilibrio en la distribución de variables categóricas usando entropía de Shannon. Detecta desbalanceo de clases que podría sesgar modelos de ML. |
| `timeliness` | Measures data freshness and recency | Mide la frescura y actualidad de los datos analizando columnas de fecha. Detecta datos obsoletos que pueden no ser relevantes para análisis o entrenamiento de modelos. |

## Verificación Post-Migración

Después de aplicar la migración, verifica:

1. **Backend**: Las métricas obsoletas ya no aparecen en `/api/metrics`
2. **Frontend**: Los nombres de métricas están en español
3. **Base de datos**: 
   ```sql
   -- Verificar que las métricas obsoletas fueron eliminadas
   SELECT name FROM metrics WHERE name IN ('drift', 'distribution', 'accuracy', 'consistency');
   -- Debería devolver 0 filas
   
   -- Verificar que las descripciones están en español
   SELECT name, description FROM metrics;
   ```

## Rollback

Si necesitas revertir los cambios:

```bash
cd backend
flask db downgrade
```

Esto restaurará las descripciones en inglés (versión simplificada) pero NO recreará las métricas obsoletas.

## Notas Importantes

- ⚠️ **Datos existentes**: La migración elimina referencias a métricas obsoletas en la tabla `issues`. Asegúrate de tener un backup si tienes datos importantes.
- ✅ **Idempotente**: La migración es segura de ejecutar múltiples veces
- 📝 **Logs**: La migración imprime mensajes de confirmación para cada métrica procesada

## Soporte

Si encuentras algún problema durante la migración, revisa:
1. Los logs de la migración
2. El estado de la base de datos con `flask db current`
3. El historial de migraciones con `flask db history`
