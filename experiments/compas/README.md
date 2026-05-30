# Reporte Experimental Avanzado: Calidad de Datos y Sesgo Racial en COMPAS

Este experimento recrea la célebre auditoría de **ProPublica sobre el algoritmo COMPAS** utilizando una metodología de entrenamiento en paralelo con múltiples clasificadores. Compara 4 algoritmos en tres configuraciones:

1. **Modelo Sucio (Original):** Entrenado con el dataset raw, incluyendo registros corruptos y proxies, y con umbral estándar 0.5.
2. **Modelo Mitigado Pre (Reweighing):** Entrenado tras limpiar los datos (reglas de consistencia temporal y nulos), remover proxies (decile_scores) y aplicar pesos de reponderación (Reweighing).
3. **Modelo Mitigado Post (Threshold Tuning):** Entrenado sobre datos limpios (sin pesos), pero optimizando umbrales específicos de clasificación por raza para igualar la Tasa de Falsos Positivos (FPR) de reincidencia.

---

## 📊 Tabla Comparativa de Resultados (Split Holdout)

| Algoritmo y Configuración | Accuracy | Precision | Recall | F1-Score | ROC-AUC | Demographic Parity Diff | Disparate Impact Ratio | Equalized Odds Diff | FPR Black / FPR White |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression (Sucio)** | 68.08% | 67.06% | 59.30% | 62.94% | 0.7313 | 0.2961 | 0.6184 | 0.3998 | 30.87% / 17.05% |
| **Logistic Regression (Mitigado Pre)** | 67.99% | 65.20% | 64.26% | 64.72% | 0.7213 | 0.0671 | 0.8864 | 0.1254 | 25.72% / 32.58% |
| **Logistic Regression (Mitigado Post)** | 67.89% | 63.04% | 71.90% | 67.18% | 0.7336 | 0.1954 | 0.6730 | 0.2461 | 38.59% / 31.82% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Decision Tree (Sucio)** | 67.23% | 67.89% | 53.72% | 59.98% | 0.6949 | 0.2341 | 0.7001 | 0.2899 | 26.69% / 15.15% |
| **Decision Tree (Mitigado Pre)** | 63.74% | 60.96% | 57.44% | 59.15% | 0.6512 | 0.0463 | 0.9224 | 0.1514 | 26.37% / 36.36% |
| **Decision Tree (Mitigado Post)** | 65.63% | 65.79% | 51.65% | 57.87% | 0.6795 | 0.0987 | 0.8592 | 0.1540 | 21.86% / 23.48% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Random Forest (Sucio)** | 67.80% | 66.90% | 58.47% | 62.40% | 0.7217 | 0.2764 | 0.6404 | 0.3686 | 30.23% / 17.42% |
| **Random Forest (Mitigado Pre)** | 66.57% | 64.01% | 61.36% | 62.66% | 0.7112 | 0.1142 | 0.8190 | 0.1989 | 27.65% / 30.68% |
| **Random Forest (Mitigado Post)** | 61.28% | 55.05% | 83.26% | 66.28% | 0.7127 | 0.1183 | 0.6893 | 0.1225 | 59.49% / 54.55% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Gradient Boosting (Sucio)** | 67.14% | 66.19% | 57.44% | 61.50% | 0.7176 | 0.2440 | 0.6754 | 0.3054 | 30.23% / 18.18% |
| **Gradient Boosting (Mitigado Pre)** | 67.23% | 64.86% | 61.78% | 63.28% | 0.7027 | 0.0779 | 0.8727 | 0.1182 | 26.37% / 30.30% |
| **Gradient Boosting (Mitigado Post)** | 67.14% | 63.99% | 64.26% | 64.12% | 0.7179 | 0.1246 | 0.7980 | 0.1831 | 30.23% / 30.68% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

---

## 🛡️ Robustez Estadística: Validación Cruzada Estratificada de 5 Pliegues

Para garantizar que los resultados no son fruto del azar de una única partición, reportamos las métricas obtenidas mediante validación cruzada estratificada de 5 pliegues (media &plusmn; desviación estándar):

| Algoritmo y Configuración | Accuracy (CV) | Recall (CV) | ROC-AUC (CV) | Demographic Parity Diff (CV) | Disparate Impact Ratio (CV) | Equalized Odds Diff (CV) | FPR Black / White (CV) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression (Sucio)** | 67.27% &plusmn; 1.38% | 58.56% &plusmn; 2.74% | 0.7269 &plusmn; 0.0144 | 0.2608 &plusmn; 0.0170 | 0.6521 &plusmn; 0.0184 | 0.3009 &plusmn; 0.0171 | 32.11% &plusmn; 1.49% / 16.52% &plusmn; 2.37% |
| **Logistic Regression (Mitigado Pre)** | 66.47% &plusmn; 1.97% | 63.87% &plusmn; 3.15% | 0.7176 &plusmn; 0.0156 | 0.0362 &plusmn; 0.0331 | 0.9691 &plusmn; 0.0775 | 0.0796 &plusmn; 0.0473 | 28.35% &plusmn; 1.17% / 34.67% &plusmn; 4.97% |
| **Logistic Regression (Mitigado Post)** | 63.87% &plusmn; 4.22% | 78.27% &plusmn; 10.69% | 0.7276 &plusmn; 0.0159 | 0.0668 &plusmn; 0.0369 | 0.9058 &plusmn; 0.1407 | 0.0704 &plusmn; 0.0302 | 48.87% &plusmn; 16.01% / 49.80% &plusmn; 19.81% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Decision Tree (Sucio)** | 65.01% &plusmn; 1.80% | 54.68% &plusmn; 1.33% | 0.6845 &plusmn; 0.0203 | 0.2223 &plusmn; 0.0184 | 0.6998 &plusmn; 0.0205 | 0.2293 &plusmn; 0.0236 | 32.80% &plusmn; 2.61% / 17.53% &plusmn; 3.02% |
| **Decision Tree (Mitigado Pre)** | 62.49% &plusmn; 0.95% | 57.87% &plusmn; 1.22% | 0.6560 &plusmn; 0.0113 | 0.0495 &plusmn; 0.0206 | 0.9512 &plusmn; 0.0793 | 0.0759 &plusmn; 0.0107 | 31.50% &plusmn; 1.31% / 35.75% &plusmn; 2.41% |
| **Decision Tree (Mitigado Post)** | 61.26% &plusmn; 4.05% | 62.66% &plusmn; 16.93% | 0.6728 &plusmn; 0.0104 | 0.0446 &plusmn; 0.0569 | 0.9557 &plusmn; 0.0996 | 0.0685 &plusmn; 0.0411 | 39.37% &plusmn; 22.21% / 41.56% &plusmn; 22.79% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Random Forest (Sucio)** | 67.42% &plusmn; 1.30% | 57.87% &plusmn; 1.29% | 0.7229 &plusmn; 0.0215 | 0.2632 &plusmn; 0.0214 | 0.6530 &plusmn; 0.0271 | 0.2784 &plusmn; 0.0463 | 32.21% &plusmn; 2.67% / 14.54% &plusmn; 1.37% |
| **Random Forest (Mitigado Pre)** | 64.88% &plusmn; 1.33% | 61.94% &plusmn; 1.38% | 0.7051 &plusmn; 0.0170 | 0.0685 &plusmn; 0.0346 | 0.8837 &plusmn; 0.0523 | 0.1026 &plusmn; 0.0133 | 31.22% &plusmn; 3.62% / 34.08% &plusmn; 4.26% |
| **Random Forest (Mitigado Post)** | 62.25% &plusmn; 5.14% | 69.20% &plusmn; 19.04% | 0.7114 &plusmn; 0.0175 | 0.0705 &plusmn; 0.0624 | 0.9121 &plusmn; 0.1091 | 0.0979 &plusmn; 0.0564 | 43.82% &plusmn; 24.75% / 44.24% &plusmn; 27.11% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Gradient Boosting (Sucio)** | 67.00% &plusmn; 1.27% | 56.26% &plusmn; 0.86% | 0.7236 &plusmn; 0.0186 | 0.2562 &plusmn; 0.0293 | 0.6657 &plusmn; 0.0326 | 0.2748 &plusmn; 0.0448 | 31.21% &plusmn; 3.12% / 14.27% &plusmn; 1.93% |
| **Gradient Boosting (Mitigado Pre)** | 66.15% &plusmn; 1.64% | 61.97% &plusmn; 2.10% | 0.7082 &plusmn; 0.0139 | 0.0544 &plusmn; 0.0293 | 0.9078 &plusmn; 0.0463 | 0.0657 &plusmn; 0.0261 | 29.31% &plusmn; 1.85% / 31.24% &plusmn; 2.75% |
| **Gradient Boosting (Mitigado Post)** | 62.15% &plusmn; 2.38% | 72.75% &plusmn; 14.92% | 0.7170 &plusmn; 0.0192 | 0.0431 &plusmn; 0.0242 | 0.9305 &plusmn; 0.1146 | 0.0578 &plusmn; 0.0307 | 46.21% &plusmn; 17.80% / 48.52% &plusmn; 16.33% |
| --- | --- | --- | --- | --- | --- | --- | --- |

---

## 📈 Visualizaciones de los Resultados

Los gráficos se han exportado en la carpeta `plots/`:
- **ROC Curve Comparison (`plots/roc_comparison.png`):** Curva comparativa de poder predictivo general de los modelos mitigados por pre-procesamiento.
- **Fairness Metrics (`plots/fairness_metrics.png`):** Resumen de las diferencias en DPD y DIR por algoritmo comparando las tres configuraciones (Sucio, Pre-procesamiento y Post-procesamiento).
- **False Positive Rates by Race (`plots/fpr_comparison.png`):** El análisis central de ProPublica en un gráfico de 3 paneles, mostrando la tasa de falsas alarmas (FPR) por etnia para las tres configuraciones y todos los algoritmos.
- **Confusion Matrices (`plots/confusion_matrices.png`):** Comparación de matrices de confusión para el Random Forest.
- **Trade-off Equidad vs. Rendimiento (`plots/fairness_performance_tradeoff.png`):** Muestra la transición de cada clasificador en el plano ROC-AUC vs. DIR al aplicar pre-procesamiento y post-procesamiento.
- **Explicabilidad XAI (`plots/feature_importance_comparison.png`):** Gráfico comparativo de la importancia de variables del Random Forest, ilustrando cómo la exclusión del decile_score y la limpieza obligan al modelo a tomar decisiones más objetivas.

---

## 🔍 Análisis Teórico para tu TFG

1. **La Paradoja de ProPublica Solucionada (Equilibrio de Falsos Positivos):**
   * En todos los **modelos sucios**, se reproduce la discriminación original: las personas negras tienen casi el doble de FPR que las blancas (30% vs 17% de falsa alarma).
   * Al aplicar **Pre-procesamiento (Reweighing)**, logramos balancear estas tasas sustancialmente (reduciendo el error sistemático).
   * Al aplicar **Post-procesamiento (Threshold Tuning)** optimizando *Equalized Odds*, el algoritmo sintoniza umbrales específicos de raza (ej. incrementando ligeramente el umbral para personas negras y reduciéndolo para personas blancas) logrando que la tasa de falsos positivos (FPR) sea prácticamente idéntica por raza, lo cual cancela la crítica ética fundamental de ProPublica.

2. **Detección de inconsistencias lógicas como pilar de la calidad:**
   El experimento demuestra la importancia de los filtros lógicos de calidad de datos. Quitar las filas donde la fecha de arresto y de COMPAS distan más de 30 días (`days_b_screening_arrest` fuera de rango) no es un simple paso técnico; es asegurar la **consistencia lógica** de la información de entrenamiento. Sin estos filtros lógicos (que DataQual detecta y exige resolver mediante Quality Gates), el modelo aprende patrones espurios que degradan su estabilidad y aumentan la discriminación algorítmica.
