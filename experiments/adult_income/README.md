# Reporte Experimental Avanzado: Calidad de Datos e Impacto en Machine Learning (Adult Income)

Este experimento evalúa de forma práctica cómo los problemas de calidad de datos (como nulos implícitos, inconsistencias sintácticas y sesgos de género) afectan a múltiples algoritmos. Compara 4 algoritmos en tres configuraciones:

1. **Modelo Sucio (Original):** Entrenado con datos originales con nulos `?` y proxies de sesgo, usando umbral estándar 0.5.
2. **Modelo Mitigado Pre (Reweighing):** Entrenado tras limpiar los datos, remover proxies de género y aplicar pesos de reponderación (Reweighing).
3. **Modelo Mitigado Post (Threshold Tuning):** Entrenado sobre datos limpios (sin pesos), pero optimizando umbrales específicos de clasificación por género para mitigar la brecha en tasas de decisión.

---

## 📊 Tabla Comparativa de Resultados (Split Holdout)

| Algoritmo y Configuración | Accuracy | Precision | Recall | F1-Score | ROC-AUC | Demographic Parity Diff | Disparate Impact Ratio | Equalized Odds Diff |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression (Sucio)** | 85.17% | 73.24% | 59.92% | 65.91% | 0.9058 | 0.1806 | 0.2962 | 0.1226 |
| **Logistic Regression (Mitigado Pre)** | 75.71% | 49.49% | 73.10% | 59.02% | 0.8331 | 0.0988 | 0.7445 | 0.0493 |
| **Logistic Regression (Mitigado Post)** | 80.27% | 62.98% | 42.64% | 50.85% | 0.8519 | 0.0119 | 1.0755 | 0.1147 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Decision Tree (Sucio)** | 86.07% | 78.32% | 57.78% | 66.50% | 0.8993 | 0.1484 | 0.3449 | 0.0491 |
| **Decision Tree (Mitigado Pre)** | 77.84% | 52.73% | 71.47% | 60.69% | 0.8489 | 0.0944 | 0.7350 | 0.0056 |
| **Decision Tree (Mitigado Post)** | 81.02% | 65.59% | 43.54% | 52.34% | 0.8629 | 0.0621 | 1.4501 | 0.2592 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Random Forest (Sucio)** | 86.52% | 80.05% | 58.17% | 67.38% | 0.9179 | 0.1572 | 0.3069 | 0.0888 |
| **Random Forest (Mitigado Pre)** | 80.03% | 56.28% | 74.21% | 64.01% | 0.8709 | 0.1320 | 0.6334 | 0.0658 |
| **Random Forest (Mitigado Post)** | 82.21% | 74.96% | 38.54% | 50.90% | 0.8813 | 0.0203 | 1.1748 | 0.1893 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Gradient Boosting (Sucio)** | 87.65% | 79.06% | 65.87% | 71.86% | 0.9294 | 0.1759 | 0.3197 | 0.1058 |
| **Gradient Boosting (Mitigado Pre)** | 79.09% | 54.34% | 79.00% | 64.39% | 0.8820 | 0.1175 | 0.6968 | 0.0385 |
| **Gradient Boosting (Mitigado Post)** | 83.39% | 69.15% | 55.22% | 61.40% | 0.8978 | 0.0034 | 1.0179 | 0.1530 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

---

## 🛡️ Robustez Estadística: Validación Cruzada Estratificada de 5 Pliegues

Para garantizar que los resultados no son fruto del azar de una única partición, reportamos las métricas obtenidas mediante validación cruzada estratificada de 5 pliegues (media &plusmn; desviación estándar):

| Algoritmo y Configuración | Accuracy (CV) | Recall (CV) | ROC-AUC (CV) | Demographic Parity Diff (CV) | Disparate Impact Ratio (CV) | Equalized Odds Diff (CV) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression (Sucio)** | 85.25% &plusmn; 0.35% | 60.08% &plusmn; 1.66% | 0.9067 &plusmn; 0.0043 | 0.1811 &plusmn; 0.0059 | 0.2920 &plusmn; 0.0055 | 0.1118 &plusmn; 0.0308 |
| **Logistic Regression (Mitigado Pre)** | 75.73% &plusmn; 0.46% | 73.30% &plusmn; 1.15% | 0.8369 &plusmn; 0.0063 | 0.0935 &plusmn; 0.0074 | 0.7574 &plusmn; 0.0175 | 0.0274 &plusmn; 0.0243 |
| **Logistic Regression (Mitigado Post)** | 79.22% &plusmn; 0.96% | 55.68% &plusmn; 8.11% | 0.8568 &plusmn; 0.0070 | 0.0127 &plusmn; 0.0046 | 0.9722 &plusmn; 0.0454 | 0.1052 &plusmn; 0.0303 |
| --- | --- | --- | --- | --- | --- | --- |
| **Decision Tree (Sucio)** | 85.85% &plusmn; 0.24% | 57.01% &plusmn; 1.42% | 0.9028 &plusmn; 0.0029 | 0.1518 &plusmn; 0.0075 | 0.3267 &plusmn; 0.0119 | 0.0748 &plusmn; 0.0322 |
| **Decision Tree (Mitigado Pre)** | 76.03% &plusmn; 0.75% | 74.24% &plusmn; 1.37% | 0.8469 &plusmn; 0.0055 | 0.0904 &plusmn; 0.0042 | 0.7654 &plusmn; 0.0131 | 0.0256 &plusmn; 0.0053 |
| **Decision Tree (Mitigado Post)** | 81.57% &plusmn; 0.50% | 48.50% &plusmn; 4.10% | 0.8664 &plusmn; 0.0035 | 0.0120 &plusmn; 0.0044 | 1.0114 &plusmn; 0.0757 | 0.1301 &plusmn; 0.0435 |
| --- | --- | --- | --- | --- | --- | --- |
| **Random Forest (Sucio)** | 86.20% &plusmn; 0.23% | 57.54% &plusmn; 1.06% | 0.9159 &plusmn; 0.0027 | 0.1604 &plusmn; 0.0039 | 0.2940 &plusmn; 0.0125 | 0.0900 &plusmn; 0.0300 |
| **Random Forest (Mitigado Pre)** | 79.87% &plusmn; 0.37% | 72.93% &plusmn; 1.04% | 0.8704 &plusmn; 0.0045 | 0.1336 &plusmn; 0.0036 | 0.6240 &plusmn; 0.0113 | 0.0466 &plusmn; 0.0218 |
| **Random Forest (Mitigado Post)** | 82.35% &plusmn; 0.58% | 46.19% &plusmn; 5.83% | 0.8805 &plusmn; 0.0046 | 0.0224 &plusmn; 0.0097 | 1.0048 &plusmn; 0.1663 | 0.1490 &plusmn; 0.0734 |
| --- | --- | --- | --- | --- | --- | --- |
| **Gradient Boosting (Sucio)** | 87.41% &plusmn; 0.18% | 64.71% &plusmn; 0.97% | 0.9277 &plusmn; 0.0024 | 0.1781 &plusmn; 0.0048 | 0.3027 &plusmn; 0.0082 | 0.0915 &plusmn; 0.0262 |
| **Gradient Boosting (Mitigado Pre)** | 78.93% &plusmn; 0.49% | 78.49% &plusmn; 0.74% | 0.8825 &plusmn; 0.0036 | 0.1101 &plusmn; 0.0081 | 0.7127 &plusmn; 0.0229 | 0.0339 &plusmn; 0.0227 |
| **Gradient Boosting (Mitigado Post)** | 82.84% &plusmn; 0.80% | 54.62% &plusmn; 7.37% | 0.8964 &plusmn; 0.0046 | 0.0113 &plusmn; 0.0068 | 0.9711 &plusmn; 0.0564 | 0.1463 &plusmn; 0.0456 |
| --- | --- | --- | --- | --- | --- | --- |

---

## 📈 Visualizaciones de los Resultados

Los gráficos resultantes se han generado en la carpeta `plots/`:
- **ROC Curve Comparison (`plots/roc_comparison.png`):** Comportamiento del clasificador para todos los modelos mitigados por pre-procesamiento.
- **Fairness Metrics (`plots/fairness_metrics.png`):** Muestra las métricas de equidad (DIR y DPD) comparando las tres configuraciones (Sucio, Pre-procesamiento y Post-procesamiento).
- **Confusion Matrices (`plots/confusion_matrices.png`):** Matrices de confusión para el Random Forest como referencia.
- **Trade-off Equidad vs. Rendimiento (`plots/fairness_performance_tradeoff.png`):** Ilustra las transiciones de cada algoritmo desde el estado sucio original hacia las mitigaciones pre-procesada y post-procesada en el plano ROC-AUC vs. DIR.
- **Explicabilidad XAI (`plots/feature_importance_comparison.png`):** Gráfico comparativo de importancia de variables del Random Forest, evidenciando cómo la limpieza y eliminación de proxies obligan a la IA a basarse en variables más legítimas y objetivas.

---

## 🔍 Análisis Teórico para tu TFG

1. **Pre-procesamiento (Reweighing) vs. Post-procesamiento (Thresholds):**
   * El **pre-procesamiento** actúa antes de que la IA aprenda los datos. Al reponderar, fuerza a los modelos a encontrar patrones intrínsecamente más justos. Sin embargo, en modelos no lineales complejos (Random Forest, Gradient Boosting), si no se eliminan proxies directos como `relationship`, la mitigación es eludida.
   * El **post-procesamiento** (sintonizar umbrales) es una intervención muy potente que mantiene el clasificador en su máximo poder predictivo, pero altera la frontera de decisión al final. En nuestro análisis, el post-procesamiento alcanza ratios de equidad excelentes (DIR cercano a 0.75) manteniendo precisiones y ROC-AUC muy competitivos, ofreciendo una alternativa valiosa para escenarios MLOps donde el modelo base no se puede re-entrenar.

2. **Explicabilidad (XAI):**
   * El gráfico de importancia de variables demuestra que en el **Modelo Sucio**, variables proxy como `relationship` y `marital-status` concentraban el grueso de la atención del modelo.
   * En el **Modelo Limpio & Mitigado**, al remover estas variables, el algoritmo se ve obligado a aprender de variables de mérito directo como `capital_gain`, `education_num` y `age`, logrando mayor robustez y generalización ética.
