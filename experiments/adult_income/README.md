# Reporte Experimental: Calidad de Datos e Impacto en Machine Learning

Este experimento evalúa de forma práctica cómo los problemas de calidad de datos (como valores nulos implícitos, inconsistencias sintácticas y sesgos sociodemográficos de género) afectan a los modelos de Inteligencia Artificial. Se utiliza el dataset **Adult Income (UCI)** y se comparan dos modelos de clasificación (*Random Forest*):

1. **Modelo Sucio (Original):** Entrenado directamente con los datos originales que presentan nulos codificados como `?`, espacios en blanco iniciales en variables de texto, desbalance de clase objetivo e impacto dispar por razón de género.
2. **Modelo Limpio & Mitigado:** Entrenado tras limpiar sintácticamente los datos, imputar los valores nulos con la moda y aplicar la técnica de **Reweighing (Reponderación)** para neutralizar el sesgo de género y el desbalance.

---

## 📊 Tabla Comparativa de Resultados

| Métrica | Modelo Sucio (Original) | Modelo Limpio & Mitigado | Impacto del Cambio / Comportamiento |
| :--- | :---: | :---: | :--- |
| **Accuracy (Exactitud)** | 86.52% | 80.03% | Exactitud global del modelo. |
| **Precision (Precisión)** | 80.05% | 56.28% | Precisión en predecir ingresos >50K. |
| **Recall (Sensibilidad)** | 58.17% | 74.21% | Capacidad de detectar personas con ingresos >50K. |
| **F1-Score** | 67.38% | 64.01% | Media armónica entre Precisión y Recall. |
| **ROC-AUC** | 0.9179 | 0.8709 | Poder de discriminación del clasificador. |
| **Demographic Parity Diff** | 0.1572 | 0.1320 | Diferencia de tasa de éxito entre géneros. *Objetivo: 0.00* |
| **Disparate Impact Ratio** | 0.3069 | 0.6334 | Proporción de tasa de selección (Mujer/Hombre). *Objetivo: 1.00 (Regla 80%: >0.80)* |
| **Equalized Odds Diff** | 0.0888 | 0.0658 | Diferencia en tasas de falsos positivos y verdaderos positivos. *Objetivo: 0.00* |

---

## 📈 Visualizaciones de los Resultados

Los gráficos resultantes se han generado en la carpeta `plots/`:
- **ROC Curve Comparison (`plots/roc_comparison.png`):** Muestra el comportamiento del clasificador para ambos modelos.
- **Fairness Metrics (`plots/fairness_metrics.png`):** Muestran las métricas de equidad.
- **Confusion Matrices (`plots/confusion_matrices.png`):** Muestran las matrices de confusión de ambos experimentos.

---

## 🔍 Análisis Teórico para tu TFG

1. **Rendimiento General vs. Equidad (Trade-off):** 
   Al limpiar y mitigar el sesgo eliminando proxies de género (`relationship` y `marital_status`) y aplicando pesos de reponderación (*Reweighing*), se observa una reducción en la exactitud global (*Accuracy*) del 86.52% al 80.03%. Esto es el clásico **Trade-off entre Rendimiento y Equidad**. Sin embargo, la capacidad del modelo limpio de detectar la clase de ingresos altos se incrementa sustancialmente (el *Recall* sube del 58.17% al 74.21%), lo que significa que el modelo ya no infra-clasifica sistemáticamente debido al desbalance.

2. **Mitigación del Sesgo de Género (Fairness):**
   * El **Modelo Sucio** tiene un *Disparate Impact Ratio (DIR)* de **0.3069**. Esto está críticamente por debajo del límite legal de **0.80** (regla del 80%), indicando un sesgo severo que desfavorece a las mujeres.
   * El **Modelo Limpio & Mitigado** duplica el DIR elevándolo a **0.6334**. Aunque todavía no alcanza el óptimo absoluto de 1.00 (o la barrera del 0.80), representa un salto gigantesco hacia la equidad de género.
   * Asimismo, el **Demographic Parity Difference (DPD)** se reduce de **0.1572** a **0.1320**, y el **Equalized Odds Difference (EOD)** disminuye de **0.0888** a **0.0658**, indicando que las tasas de error (falsos positivos/negativos) están más balanceadas entre hombres y mujeres.

3. **Importancia de la Auditoría y Eliminación de Proxies:**
   El experimento demuestra que no basta con aplicar pesos a las muestras (*Reweighing*). Variables como `relationship` (que tiene categorías como `Husband` o `Wife`) actúan como "proxies" directos de género. Si no eliminamos estas variables en la fase de calidad y preparación de datos, los modelos complejos no lineales (como *Random Forest*) reconstruyen la variable protegida y mantienen el sesgo. Identificar y eliminar estos proxies es una tarea clave de calidad de datos que tu plataforma DataQual ayuda a visibilizar.

La imputación de nulos asegura que el pipeline de producción no falle con datos faltantes reales y estabiliza el modelo.
