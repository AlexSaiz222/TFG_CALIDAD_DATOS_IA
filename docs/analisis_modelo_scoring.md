# Analisis del Modelo de Scoring por Penalizacion de Issues

## Contexto

Este documento analiza las decisiones de diseno del modelo de puntuacion de calidad (Quality Score) implementado en `evaluation_service.py`. Justifica por que se usa un modelo de penalizacion por issues en lugar de un modelo basado en ratios, y evalua sus fortalezas y areas de mejora.

---

## 1. Por que issues a nivel de columna y no de fila

### El modelo es hibrido, no puramente columnar

El sistema no opera exclusivamente a nivel de columna. La unidad real es el **hallazgo** (issue), que puede tener diferentes granularidades segun la metrica:

| Metrica | Granularidad de deteccion |
|---------|--------------------------|
| Completeness | 1 issue global + 1 issue por columna con baja completitud |
| Uniqueness (variabilidad) | 1 issue por columna con baja variabilidad |
| Uniqueness (duplicados) | 1 issue global por filas duplicadas |
| Syntactic accuracy | 1 issue por columna con formato invalido |
| Logical consistency | 1 issue por regla violada (afecta N filas) |
| Outliers | 1 issue por columna con outliers (solo profiling) |
| Class balance | 1 issue por columna con desbalance |
| Currentness | 1 issue por columna de fecha obsoleta |

La unidad es el *problema detectado*, no la celda ni la fila individual.

### Justificacion: por que no puntuar por fila

Si se puntuara contando filas con problemas:

- Un dataset de 1M de filas con 50 filas con fechas imposibles obtendria un **99.995%**. Parece perfecto, pero esas 50 filas pueden invalidar un analisis temporal completo.
- Con el modelo de issues, ese problema genera 1 issue de tipo `syntactic_accuracy` cuya severity se calcula por la conformance rate. El impacto es proporcional a la gravedad real del problema, no diluido por el tamano del dataset.

Los problemas de calidad de datos son **estructurales** (la columna `email` tiene mal formato, la columna `age` tiene nulls), no aleatorios fila a fila. Modelar issues por columna/regla refleja esa realidad.

> Cita del codigo (`evaluation_service.py:405-409`):
> *"Ratio-based scores dilute concentrated errors (e.g. 3 impossible dates in 200 rows barely affect the ratio, but the dataset is unusable for time-series). The issue-count approach captures this correctly."*

---

## 2. Formula actual

```
quality_score = max(0, 1 - min(0.97, raw_penalty / column_scale))
```

### Paso a paso

1. **Cada issue resta segun su severidad:**

   | Severidad | Penalizacion |
   |-----------|-------------|
   | `critical` | -0.12 |
   | `high` | -0.05 |
   | `medium` | -0.01 |
   | `low` | -0.003 |

2. **Se suman todas las penalizaciones** = `raw_penalty`

3. **Se ajusta por el ancho del dataset** (correccion de dimensionalidad):
   ```
   column_scale = sqrt(max(10, num_columns) / 10)
   ```
   - 10 columnas -> scale = 1.0 (sin cambio)
   - 40 columnas -> scale = 2.0 (divide la penalizacion entre 2)
   - 90 columnas -> scale = 3.0

4. **Se aplica:** `issue_penalty = min(0.97, raw_penalty / column_scale)`

### Ejemplo concreto

Dataset de 20 columnas con: 2 critical, 3 high, 5 medium:
```
raw_penalty  = 2x0.12 + 3x0.05 + 5x0.01 = 0.24 + 0.15 + 0.05 = 0.44
column_scale = sqrt(20/10) = 1.414
issue_penalty = 0.44 / 1.414 = 0.311
quality_score = 1 - 0.311 = 0.689 (68.9%)
```

---

## 3. Valoracion del diseno

### Fortalezas

1. **Modelo de penalizacion por issues es mas interpretable y accionable que ratios.** Cuando alguien ve "3 issues criticos", sabe exactamente que arreglar. Un score de 94.3% no le dice nada por si solo.

2. **La correccion por dimensionalidad** (`sqrt(cols/10)`) normaliza correctamente para que la misma densidad de problemas produzca la misma nota sin importar cuantas columnas tenga el dataset.

3. **La severidad dinamica** (distancia al umbral, no fija) hace que el sistema se adapte a los umbrales que configura el usuario.

4. **El fingerprinting** para tracking new/recurrent es un diseno maduro que permite comparacion entre evaluaciones.

5. **El tope de 0.97** garantiza que el score nunca baje de 3%, evitando un 0% absoluto confuso en la UI.

### Limitaciones identificadas

#### 3.1 No se normaliza por filas

El sistema trata igual:
- 5 issues criticos en un dataset de **100 filas**
- 5 issues criticos en un dataset de **10 millones de filas**

**Sin embargo**, esta decision es defensible: los issues son problemas estructurales, no filas individuales malas. Una columna con 40% de nulls es igual de grave si tiene 100 filas o 10M. Ademas, la severidad de cada issue ya se calcula a partir de **tasas/proporciones** (ej: outliers >= 20% -> critical), lo que implicitamente normaliza por filas.

**Oportunidad de mejora:** Anadir un campo `affected_rows_pct` como metadato informativo en cada issue sin cambiar la formula de scoring. Esto daria al usuario el contexto que el score deliberadamente omite.

#### 3.2 Los pesos de penalizacion son empiricos

```python
PENALTY_PER_ISSUE = {'critical': 0.12, 'high': 0.05, 'medium': 0.01, 'low': 0.003}
```

- Con solo 9 issues criticos (sin correccion dimensional) ya se llega a penalty > 1.0 (score ~3%).
- Se necesitarian 333 issues low para el mismo efecto. La proporcion 1:40 entre critical y low es razonable pero no esta formalmente justificada.
- **Recomendacion:** Documentar que estos pesos se calibraron empiricamente. Un estudio de sensibilidad con datasets de referencia aportaria evidencia adicional.

#### 3.3 La correccion dimensional sqrt es conservadora

Con `sqrt(cols/10)`, un dataset de 100 columnas divide la penalizacion entre 3.16. Si cada columna genera un issue medium, serian 100 x 0.01 = 1.0 -> 1.0/3.16 = 0.316 -> score 68.4%. Para un dataset donde *todas* las columnas tienen un problema medio, 68% es una nota razonable, por lo que sqrt funciona bien en la practica.

---

## 4. Comparacion con alternativas

| Modelo | Ventaja | Desventaja |
|--------|---------|-----------|
| **Ratio por celda** (% celdas validas) | Simple, intuitivo | Diluye problemas concentrados |
| **Worst-per-metric** (1 penalizacion por metrica) | Invariante al ancho | Pierde informacion de multiples problemas en la misma dimension |
| **Sum-all-issues con sqrt** (modelo actual) | Captura la cantidad real de problemas, corrige por ancho | Los pesos son empiricos, no normaliza por filas |
| **Modelo mixto** (ratio + issues como bonus/malus) | Lo mejor de ambos | Complejidad, riesgo de doble penalizacion |

El modelo actual (sum-all-issues con correccion sqrt) es un buen equilibrio entre sensibilidad y simplicidad.

---

## 5. Conclusion

El diseno actual es **solido y adecuado al contexto**. El modelo "empieza en 100%, resta por issue" es mas intuitivo que ratios, mas sensible a problemas concentrados que promedios, y correctamente ajustado por dimensionalidad. La mejora prioritaria seria anadir el porcentaje de filas afectadas como metadato informativo en cada issue.

---

## Archivos relevantes

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/services/evaluation_service.py:401-449` | Calculo del quality score |
| `backend/services/metrics/base.py:70-137` | `calculate_dynamic_severity()` |
| `backend/services/metrics/*.py` | Cada metrica genera issues con su logica |
| `backend/utils/fingerprint_utils.py` | Fingerprinting para tracking entre evaluaciones |
| `docs/evaluaciones.md` | Documentacion completa del sistema de evaluaciones |
