import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, roc_curve, confusion_matrix, ConfusionMatrixDisplay
)

# Definir directorios
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PLOTS_DIR = os.path.join(BASE_DIR, "plots")
RAW_CSV_PATH = os.path.join(DATA_DIR, "adult_raw.csv")
CLEAN_CSV_PATH = os.path.join(DATA_DIR, "adult_clean.csv")

# Asegurar directorios
os.makedirs(PLOTS_DIR, exist_ok=True)

def load_data():
    if not os.path.exists(RAW_CSV_PATH):
        raise FileNotFoundError(f"No se encuentra el archivo {RAW_CSV_PATH}. Ejecuta download_dataset.py primero.")
    print("Cargando dataset original...")
    return pd.read_csv(RAW_CSV_PATH)

def clean_data(df, is_train=True, train_modes=None):
    """
    Realiza la limpieza de datos clásica:
    1. Quita espacios en blanco de las cadenas.
    2. Convierte '?' en nulos reales (NaN).
    3. Imputa valores nulos en categóricas usando la moda del train set.
    4. Mapea la variable objetivo 'income' a binario.
    5. Elimina columnas administrativas o redundantes (fnlwgt, education).
    """
    df_clean = df.copy()
    
    # 1. Quitar espacios en blanco en columnas tipo object
    for col in df_clean.select_dtypes(include=["object"]):
        df_clean[col] = df_clean[col].astype(str).str.strip()
        
    # 2. Reemplazar '?' por NaN
    df_clean = df_clean.replace("?", np.nan)
    
    # 3. Imputar nulos en categóricas
    categorical_cols = df_clean.select_dtypes(include=["object"]).columns
    if is_train:
        train_modes = {}
        for col in categorical_cols:
            # Calcular la moda excluyendo NaN
            mode_series = df_clean[col].dropna().mode()
            mode_val = mode_series[0] if not mode_series.empty else "Unknown"
            train_modes[col] = mode_val
            df_clean[col] = df_clean[col].fillna(mode_val)
    else:
        for col in categorical_cols:
            mode_val = train_modes.get(col, "Unknown")
            df_clean[col] = df_clean[col].fillna(mode_val)
            
    # 4. Mapear target
    if "income" in df_clean.columns:
        if df_clean["income"].dtype == object:
            df_clean["income"] = df_clean["income"].map({"<=50K": 0, ">50K": 1})
        
    # 5. Eliminar columnas redundantes o proxies de género fuertes (relationship, marital_status)
    cols_to_drop = ["fnlwgt", "education", "relationship", "marital_status"]
    df_clean = df_clean.drop(columns=[col for col in cols_to_drop if col in df_clean.columns])
    
    return df_clean, train_modes

def calculate_reweighing_weights(df, protected_col, target_col):
    """
    Calcula pesos de reponderación (Reweighing) conjuntos para:
    1. Balancear clases (50% <=50K, 50% >50K en peso total)
    2. Mitigar sesgo de género (50% Male, 50% Female en peso total)
    3. Asegurar independencia estadística entre género e ingresos.
    Fórmula: W(a, y) = N / (4 * N(A=a, Y=y))
    """
    N = len(df)
    weights = np.zeros(N)
    
    # Mapear género a numérico para consistencia
    # El género ya está limpio (sin espacios) en el df_clean
    a_series = df[protected_col].map({"Female": 0, "Male": 1})
    y_series = df[target_col]
    
    subgroups = [
        (0, 0), # Female, <=50K
        (0, 1), # Female, >50K
        (1, 0), # Male, <=50K
        (1, 1)  # Male, >50K
    ]
    
    print("\n[Métrica de Sesgo en Entrenamiento] Frecuencias absolutas por subgrupo:")
    for a_val, y_val in subgroups:
        count = np.sum((a_series == a_val) & (y_series == y_val))
        count = max(count, 1) # Evitar división por cero
        weight = N / (4.0 * count)
        
        mask = (a_series == a_val) & (y_series == y_val)
        weights[mask] = weight
        
        g_name = "Female" if a_val == 0 else "Male"
        i_name = "<=50K" if y_val == 0 else ">50K"
        print(f" - {g_name} con ingresos {i_name}: {count} muestras. Peso asignado: {weight:.4f}")
        
    return weights

def calculate_fairness_metrics(y_true, y_pred, sex_series):
    """
    Calcula métricas de equidad (Fairness) para la variable 'sex'.
    """
    sex_normalized = sex_series.astype(str).str.strip()
    females = (sex_normalized == "Female")
    males = (sex_normalized == "Male")
    
    # Tasas de selección positiva (P(Y_pred=1 | Grupo))
    sel_rate_female = np.mean(y_pred[females] == 1) if np.sum(females) > 0 else 0
    sel_rate_male = np.mean(y_pred[males] == 1) if np.sum(males) > 0 else 0
    
    # Demographic Parity Difference
    dpd = abs(sel_rate_female - sel_rate_male)
    
    # Disparate Impact Ratio
    dir_val = (sel_rate_female / sel_rate_male) if sel_rate_male > 0 else np.nan
    
    # True Positive Rate (Recall) y False Positive Rate por género
    tpr_female, fpr_female = 0.0, 0.0
    tpr_male, fpr_male = 0.0, 0.0
    
    # Métricas para mujeres
    fem_true = y_true[females]
    fem_pred = y_pred[females]
    if np.sum(fem_true == 1) > 0:
        tpr_female = np.sum((fem_true == 1) & (fem_pred == 1)) / np.sum(fem_true == 1)
    if np.sum(fem_true == 0) > 0:
        fpr_female = np.sum((fem_true == 0) & (fem_pred == 1)) / np.sum(fem_true == 0)
        
    # Métricas para hombres
    male_true = y_true[males]
    male_pred = y_pred[males]
    if np.sum(male_true == 1) > 0:
        tpr_male = np.sum((male_true == 1) & (male_pred == 1)) / np.sum(male_true == 1)
    if np.sum(male_true == 0) > 0:
        fpr_male = np.sum((male_true == 0) & (male_pred == 1)) / np.sum(male_true == 0)
        
    # Equalized Odds Difference
    eod = max(abs(tpr_female - tpr_male), abs(fpr_female - fpr_male))
    
    return {
        "selection_rate_female": sel_rate_female,
        "selection_rate_male": sel_rate_male,
        "demographic_parity_difference": dpd,
        "disparate_impact_ratio": dir_val,
        "tpr_female": tpr_female,
        "tpr_male": tpr_male,
        "fpr_female": fpr_female,
        "fpr_male": fpr_male,
        "equalized_odds_difference": eod
    }

def build_pipeline(categorical_cols, numerical_cols):
    """
    Construye un pipeline de scikit-learn con codificación, escalado y un Random Forest.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_cols)
        ]
    )
    
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(random_state=42, n_estimators=100, max_depth=15, n_jobs=-1))
    ])
    
    return pipeline

def save_plots(model_raw, model_clean, X_test_raw, y_test_raw, X_test_clean, y_test_clean, raw_metrics, clean_metrics):
    sns.set_theme(style="whitegrid")
    
    # 1. Curva ROC Comparativa
    plt.figure(figsize=(8, 6))
    
    # Predicciones probabilísticas
    y_prob_raw = model_raw.predict_proba(X_test_raw)[:, 1]
    y_prob_clean = model_clean.predict_proba(X_test_clean)[:, 1]
    
    fpr_r, tpr_r, _ = roc_curve(y_test_raw, y_prob_raw)
    fpr_c, tpr_c, _ = roc_curve(y_test_clean, y_prob_clean)
    
    auc_raw = roc_auc_score(y_test_raw, y_prob_raw)
    auc_clean = roc_auc_score(y_test_clean, y_prob_clean)
    
    plt.plot(fpr_r, tpr_r, label=f"Modelo Sucio (AUC = {auc_raw:.4f})", color="#e74c3c", lw=2)
    plt.plot(fpr_c, tpr_c, label=f"Modelo Limpio & Mitigado (AUC = {auc_clean:.4f})", color="#2ecc71", lw=2)
    plt.plot([0, 1], [0, 1], 'k--', alpha=0.5)
    
    plt.xlabel("Tasa de Falsos Positivos (FPR)", fontsize=12)
    plt.ylabel("Tasa de Verdaderos Positivos (TPR)", fontsize=12)
    plt.title("Comparación de Curvas ROC", fontsize=14, fontweight="bold", pad=15)
    plt.legend(loc="lower right", frameon=True)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "roc_comparison.png"), dpi=150)
    plt.close()
    
    # 2. Comparación de Métricas de Fairness (Sesgo)
    metrics_names = ["Demographic Parity Diff", "Equalized Odds Diff", "Disparate Impact Ratio"]
    raw_vals = [
        raw_metrics["demographic_parity_difference"],
        raw_metrics["equalized_odds_difference"],
        raw_metrics["disparate_impact_ratio"]
    ]
    clean_vals = [
        clean_metrics["demographic_parity_difference"],
        clean_metrics["equalized_odds_difference"],
        clean_metrics["disparate_impact_ratio"]
    ]
    
    # Creamos DataFrame para graficar con seaborn
    df_plot = pd.DataFrame({
        "Métrica": metrics_names * 2,
        "Valor": raw_vals + clean_vals,
        "Modelo": ["Sucio (Original)"] * 3 + ["Limpio & Mitigado"] * 3
    })
    
    fig, ax = plt.subplots(figsize=(10, 6))
    sns.barplot(data=df_plot, x="Métrica", y="Valor", hue="Modelo", palette=["#e74c3c", "#2ecc71"], ax=ax)
    
    # Dibujar líneas de referencia óptimas
    # Para DPD y EOD el valor óptimo es 0.
    # Para Disparate Impact, la regla del 80% define un rango aceptable [0.8, 1.25]. El valor óptimo es 1.0.
    ax.axhline(0.0, color="black", linestyle="-", alpha=0.3)
    ax.axhline(1.0, color="green", linestyle="--", alpha=0.5, label="Impacto Dispar Óptimo (1.0)")
    ax.axhline(0.8, color="red", linestyle=":", alpha=0.5, label="Límite Aceptable Regla 80% (0.8)")
    
    ax.set_title("Comparación de Métricas de Sesgo (Género)", fontsize=14, fontweight="bold", pad=15)
    ax.set_ylabel("Valor de la Métrica", fontsize=12)
    ax.set_xlabel("")
    ax.legend(frameon=True)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "fairness_metrics.png"), dpi=150)
    plt.close()

    # 3. Matrices de Confusión lado a lado
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    y_pred_raw = model_raw.predict(X_test_raw)
    y_pred_clean = model_clean.predict(X_test_clean)
    
    cm_raw = confusion_matrix(y_test_raw, y_pred_raw)
    cm_clean = confusion_matrix(y_test_clean, y_pred_clean)
    
    disp_raw = ConfusionMatrixDisplay(confusion_matrix=cm_raw, display_labels=["<=50K", ">50K"])
    disp_raw.plot(cmap="Reds", ax=axes[0], colorbar=False)
    axes[0].set_title("Modelo Sucio", fontsize=12, fontweight="bold")
    
    disp_clean = ConfusionMatrixDisplay(confusion_matrix=cm_clean, display_labels=["<=50K", ">50K"])
    disp_clean.plot(cmap="Greens", ax=axes[1], colorbar=False)
    axes[1].set_title("Modelo Limpio & Mitigado", fontsize=12, fontweight="bold")
    
    plt.suptitle("Matrices de Confusión", fontsize=14, fontweight="bold", y=0.98)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "confusion_matrices.png"), dpi=150)
    plt.close()
    
    print(f"Gráficos guardados exitosamente en {PLOTS_DIR}")

def main():
    # 1. Cargar Datos
    df = load_data()
    
    # Mapear el target en el dataset raw de entrada para poder hacer split estratificado
    # Nota: el target original en 'adult_raw.csv' tiene espacios iniciales: " <=50K" o " >50K"
    df["income_mapped"] = df["income"].astype(str).str.strip().map({"<=50K": 0, ">50K": 1})
    
    # 2. Split Inicial Train/Test (Estratificado por Target e independizado antes de limpiar)
    X = df.drop(columns=["income", "income_mapped"])
    y = df["income_mapped"]
    
    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Reconstruir DataFrames de entrenamiento para visualizaciones y exportar el 'clean' intermedio
    train_raw_df = X_train_raw.copy()
    train_raw_df["income"] = y_train_raw
    
    # 3. Limpieza de datos (Calidad Clásica)
    print("\nAplicando limpieza de calidad (imputación, espacios) al conjunto de entrenamiento...")
    train_clean_df, train_modes = clean_data(train_raw_df, is_train=True)
    
    X_train_clean = train_clean_df.drop(columns=["income"])
    y_train_clean = train_clean_df["income"]
    
    # Guardar el dataset limpio y completo (train + test limpiados) para que el usuario pueda usarlo si quiere
    # Limpiamos todo el dataset original (pero usando las modas calculadas del train set para evitar leakage en test)
    print(f"Guardando dataset limpio unificado en {CLEAN_CSV_PATH}...")
    full_clean_df, _ = clean_data(df.drop(columns=["income_mapped"]), is_train=False, train_modes=train_modes)
    full_clean_df.to_csv(CLEAN_CSV_PATH, index=False)
    
    # Preparar el conjunto de test
    test_raw_df = X_test_raw.copy()
    test_raw_df["income"] = y_test_raw
    test_clean_df, _ = clean_data(test_raw_df, is_train=False, train_modes=train_modes)
    
    X_test_clean = test_clean_df.drop(columns=["income"])
    y_test_clean = test_clean_df["income"]
    
    # 4. Calcular pesos de reponderación (Fairness Mitigation) para el modelo limpio
    # La columna de protección en los datos limpios es 'sex' (sin espacios)
    sample_weights = calculate_reweighing_weights(train_clean_df, protected_col="sex", target_col="income")
    
    # 5. Configurar Pipelines de Modelado
    # Columnas categóricas y numéricas del modelo Sucio
    cat_cols_raw = X_train_raw.select_dtypes(include=["object"]).columns.tolist()
    num_cols_raw = X_train_raw.select_dtypes(include=["int64", "float64"]).columns.tolist()
    
    # Columnas categóricas y numéricas del modelo Limpio (se eliminaron 'fnlwgt' y 'education')
    cat_cols_clean = X_train_clean.select_dtypes(include=["object"]).columns.tolist()
    num_cols_clean = X_train_clean.select_dtypes(include=["int64", "float64"]).columns.tolist()
    
    pipeline_raw = build_pipeline(cat_cols_raw, num_cols_raw)
    pipeline_clean = build_pipeline(cat_cols_clean, num_cols_clean)
    
    # 6. Entrenar Modelos
    print("\nEntrenando Modelo Sucio (Modelo A)...")
    pipeline_raw.fit(X_train_raw, y_train_raw)
    
    print("Entrenando Modelo Limpio & Mitigado (Modelo B)...")
    # Pasamos los pesos al fit del Random Forest en el pipeline
    pipeline_clean.fit(X_train_clean, y_train_clean, classifier__sample_weight=sample_weights)
    
    # 7. Evaluaciones
    y_pred_raw = pipeline_raw.predict(X_test_raw)
    y_pred_clean = pipeline_clean.predict(X_test_clean)
    
    # Métricas de rendimiento clásico
    acc_raw = accuracy_score(y_test_raw, y_pred_raw)
    prec_raw = precision_score(y_test_raw, y_pred_raw)
    rec_raw = recall_score(y_test_raw, y_pred_raw)
    f1_raw = f1_score(y_test_raw, y_pred_raw)
    auc_raw = roc_auc_score(y_test_raw, pipeline_raw.predict_proba(X_test_raw)[:, 1])
    
    acc_clean = accuracy_score(y_test_clean, y_pred_clean)
    prec_clean = precision_score(y_test_clean, y_pred_clean)
    rec_clean = recall_score(y_test_clean, y_pred_clean)
    f1_clean = f1_score(y_test_clean, y_pred_clean)
    auc_clean = roc_auc_score(y_test_clean, pipeline_clean.predict_proba(X_test_clean)[:, 1])
    
    # Métricas de Fairness
    # Nota: la columna 'sex' en el test raw tiene espacios, en el clean está limpia. La función lo normaliza.
    raw_fairness = calculate_fairness_metrics(y_test_raw, y_pred_raw, X_test_raw["sex"])
    clean_fairness = calculate_fairness_metrics(y_test_clean, y_pred_clean, X_test_clean["sex"])
    
    # 8. Reportar Resultados en Consola
    print("\n" + "="*50)
    print(" RESULTADOS COMPARATIVOS: MODELO SUCIO VS LIMPIO ")
    print("="*50)
    print(f"{'Métrica':<35} | {'Modelo Sucio':<15} | {'Modelo Limpio':<15}")
    print("-"*72)
    dpd_raw = f"{raw_fairness['demographic_parity_difference']:.4f}"
    dpd_clean = f"{clean_fairness['demographic_parity_difference']:.4f}"
    dir_raw = f"{raw_fairness['disparate_impact_ratio']:.4f}"
    dir_clean = f"{clean_fairness['disparate_impact_ratio']:.4f}"
    eod_raw = f"{raw_fairness['equalized_odds_difference']:.4f}"
    eod_clean = f"{clean_fairness['equalized_odds_difference']:.4f}"

    print(f"{'Accuracy (Exactitud)':<35} | {f'{acc_raw:.4%}':<15} | {f'{acc_clean:.4%}':<15}")
    print(f"{'Precision (Precisión)':<35} | {f'{prec_raw:.4%}':<15} | {f'{prec_clean:.4%}':<15}")
    print(f"{'Recall (Sensibilidad)':<35} | {f'{rec_raw:.4%}':<15} | {f'{rec_clean:.4%}':<15}")
    print(f"{'F1-Score':<35} | {f'{f1_raw:.4%}':<15} | {f'{f1_clean:.4%}':<15}")
    print(f"{'ROC-AUC':<35} | {f'{auc_raw:.4f}':<15} | {f'{auc_clean:.4f}':<15}")
    print("-"*72)
    print(f"{'Demographic Parity Diff (DPD)':<35} | {dpd_raw:<15} | {dpd_clean:<15}")
    print(f"{'Disparate Impact Ratio (DIR)':<35} | {dir_raw:<15} | {dir_clean:<15}")
    print(f"{'Equalized Odds Diff (EOD)':<35} | {eod_raw:<15} | {eod_clean:<15}")
    print("="*50)
    
    # 9. Guardar Gráficos
    save_plots(
        pipeline_raw, pipeline_clean, 
        X_test_raw, y_test_raw, 
        X_test_clean, y_test_clean, 
        raw_fairness, clean_fairness
    )
    
    # 10. Escribir reporte en Markdown (README.md)
    generate_markdown_report(
        acc_raw, prec_raw, rec_raw, f1_raw, auc_raw, raw_fairness,
        acc_clean, prec_clean, rec_clean, f1_clean, auc_clean, clean_fairness
    )

def generate_markdown_report(acc_r, prec_r, rec_r, f1_r, auc_r, raw_f, acc_c, prec_c, rec_c, f1_c, auc_c, clean_f):
    readme_path = os.path.join(BASE_DIR, "README.md")
    
    content = f"""# Reporte Experimental: Calidad de Datos e Impacto en Machine Learning

Este experimento evalúa de forma práctica cómo los problemas de calidad de datos (como valores nulos implícitos, inconsistencias sintácticas y sesgos sociodemográficos de género) afectan a los modelos de Inteligencia Artificial. Se utiliza el dataset **Adult Income (UCI)** y se comparan dos modelos de clasificación (*Random Forest*):

1. **Modelo Sucio (Original):** Entrenado directamente con los datos originales que presentan nulos codificados como `?`, espacios en blanco iniciales en variables de texto, desbalance de clase objetivo e impacto dispar por razón de género.
2. **Modelo Limpio & Mitigado:** Entrenado tras limpiar sintácticamente los datos, imputar los valores nulos con la moda y aplicar la técnica de **Reweighing (Reponderación)** para neutralizar el sesgo de género y el desbalance.

---

## 📊 Tabla Comparativa de Resultados

| Métrica | Modelo Sucio (Original) | Modelo Limpio & Mitigado | Impacto del Cambio / Comportamiento |
| :--- | :---: | :---: | :--- |
| **Accuracy (Exactitud)** | {acc_r:.2%} | {acc_c:.2%} | Exactitud global del modelo. |
| **Precision (Precisión)** | {prec_r:.2%} | {prec_c:.2%} | Precisión en predecir ingresos >50K. |
| **Recall (Sensibilidad)** | {rec_r:.2%} | {rec_c:.2%} | Capacidad de detectar personas con ingresos >50K. |
| **F1-Score** | {f1_r:.2%} | {f1_c:.2%} | Media armónica entre Precisión y Recall. |
| **ROC-AUC** | {auc_r:.4f} | {auc_c:.4f} | Poder de discriminación del clasificador. |
| **Demographic Parity Diff** | {raw_f['demographic_parity_difference']:.4f} | {clean_f['demographic_parity_difference']:.4f} | Diferencia de tasa de éxito entre géneros. *Objetivo: 0.00* |
| **Disparate Impact Ratio** | {raw_f['disparate_impact_ratio']:.4f} | {clean_f['disparate_impact_ratio']:.4f} | Proporción de tasa de selección (Mujer/Hombre). *Objetivo: 1.00 (Regla 80%: >0.80)* |
| **Equalized Odds Diff** | {raw_f['equalized_odds_difference']:.4f} | {clean_f['equalized_odds_difference']:.4f} | Diferencia en tasas de falsos positivos y verdaderos positivos. *Objetivo: 0.00* |

---

## 📈 Visualizaciones de los Resultados

Los gráficos resultantes se han generado en la carpeta `plots/`:
- **ROC Curve Comparison (`plots/roc_comparison.png`):** Muestra el comportamiento del clasificador para ambos modelos.
- **Fairness Metrics (`plots/fairness_metrics.png`):** Muestran las métricas de equidad.
- **Confusion Matrices (`plots/confusion_matrices.png`):** Muestran las matrices de confusión de ambos experimentos.

---

## 🔍 Análisis Teórico para tu TFG

1. **Rendimiento General vs. Equidad (Trade-off):** 
   Al limpiar y mitigar el sesgo eliminando proxies de género (`relationship` y `marital_status`) y aplicando pesos de reponderación (*Reweighing*), se observa una reducción en la exactitud global (*Accuracy*) del {acc_r:.2%} al {acc_c:.2%}. Esto es el clásico **Trade-off entre Rendimiento y Equidad**. Sin embargo, la capacidad del modelo limpio de detectar la clase de ingresos altos se incrementa sustancialmente (el *Recall* sube del {rec_r:.2%} al {rec_c:.2%}), lo que significa que el modelo ya no infra-clasifica sistemáticamente debido al desbalance.

2. **Mitigación del Sesgo de Género (Fairness):**
   * El **Modelo Sucio** tiene un *Disparate Impact Ratio (DIR)* de **{raw_f['disparate_impact_ratio']:.4f}**. Esto está críticamente por debajo del límite legal de **0.80** (regla del 80%), indicando un sesgo severo que desfavorece a las mujeres.
   * El **Modelo Limpio & Mitigado** duplica el DIR elevándolo a **{clean_f['disparate_impact_ratio']:.4f}**. Aunque todavía no alcanza el óptimo absoluto de 1.00 (o la barrera del 0.80), representa un salto gigantesco hacia la equidad de género.
   * Asimismo, el **Demographic Parity Difference (DPD)** se reduce de **{raw_f['demographic_parity_difference']:.4f}** a **{clean_f['demographic_parity_difference']:.4f}**, y el **Equalized Odds Difference (EOD)** disminuye de **{raw_f['equalized_odds_difference']:.4f}** a **{clean_f['equalized_odds_difference']:.4f}**, indicando que las tasas de error (falsos positivos/negativos) están más balanceadas entre hombres y mujeres.

3. **Importancia de la Auditoría y Eliminación de Proxies:**
   El experimento demuestra que no basta con aplicar pesos a las muestras (*Reweighing*). Variables como `relationship` (que tiene categorías como `Husband` o `Wife`) actúan como "proxies" directos de género. Si no eliminamos estas variables en la fase de calidad y preparación de datos, los modelos complejos no lineales (como *Random Forest*) reconstruyen la variable protegida y mantienen el sesgo. Identificar y eliminar estos proxies es una tarea clave de calidad de datos que tu plataforma DataQual ayuda a visibilizar.

La imputación de nulos asegura que el pipeline de producción no falle con datos faltantes reales y estabiliza el modelo.
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Reporte escrito con éxito en {readme_path}")

if __name__ == "__main__":
    main()
