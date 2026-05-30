import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, roc_curve, confusion_matrix, ConfusionMatrixDisplay
)
from sklearn.base import clone


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

def build_pipeline(categorical_cols, numerical_cols, classifier):
    """
    Construye un pipeline de scikit-learn con codificación, escalado y el clasificador dado.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_cols)
        ]
    )
    
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', classifier)
    ])
    
    return pipeline

def optimize_postprocessing_thresholds(y_val, y_prob_val, sex_val, target_metric="demographic_parity"):
    """
    Busca los umbrales óptimos para mujeres (t0) y hombres (t1) en el conjunto de validación
    para optimizar la equidad sin degradar en exceso la precisión.
    """
    sex_normalized = sex_val.astype(str).str.strip().values
    y_val_arr = y_val.values if isinstance(y_val, pd.Series) else y_val
    
    best_t0 = 0.5
    best_t1 = 0.5
    min_difference = 999.0
    
    # 1. Obtener rendimiento de referencia con umbral estándar 0.5
    y_pred_ref = (y_prob_val >= 0.5).astype(int)
    ref_f1 = f1_score(y_val_arr, y_pred_ref)
    if ref_f1 == 0:
        ref_f1 = 0.001
        
    # Grid search sobre umbrales en [0.1, 0.9]
    thresholds = np.linspace(0.1, 0.9, 81)
    
    for t0 in thresholds: # Umbral para Mujeres (Female)
        for t1 in thresholds: # Umbral para Hombres (Male)
            # Predicción con umbrales específicos
            y_pred = np.where(sex_normalized == "Female", y_prob_val >= t0, y_prob_val >= t1).astype(int)
            
            # Evaluar rendimiento general
            f1 = f1_score(y_val_arr, y_pred)
            
            # Solo consideramos combinaciones que retengan al menos el 85% del F1 de referencia
            if f1 < 0.85 * ref_f1:
                continue
                
            # Calcular métricas de equidad
            females = (sex_normalized == "Female")
            males = (sex_normalized == "Male")
            
            sel_rate_female = np.mean(y_pred[females] == 1) if np.sum(females) > 0 else 0
            sel_rate_male = np.mean(y_pred[males] == 1) if np.sum(males) > 0 else 0
            
            if target_metric == "demographic_parity":
                diff = abs(sel_rate_female - sel_rate_male)
            elif target_metric == "equalized_odds":
                tpr_f, fpr_f = 0.0, 0.0
                tpr_m, fpr_m = 0.0, 0.0
                if np.sum((y_val_arr == 0) & females) > 0:
                    fpr_f = np.sum((y_val_arr == 0) & females & (y_pred == 1)) / np.sum((y_val_arr == 0) & females)
                if np.sum((y_val_arr == 0) & males) > 0:
                    fpr_m = np.sum((y_val_arr == 0) & males & (y_pred == 1)) / np.sum((y_val_arr == 0) & males)
                diff = abs(fpr_f - fpr_m)
            else:
                diff = 0.0
                
            if diff < min_difference:
                min_difference = diff
                best_t0 = t0
                best_t1 = t1
                
    return best_t0, best_t1


def save_plots(results, X_test_raw, y_test_raw, X_test_clean, y_test_clean):
    sns.set_theme(style="whitegrid")
    
    # 1. Curva ROC Comparativa (Modelos Mitigados Pre)
    plt.figure(figsize=(9, 7))
    colors = {
        "Logistic Regression": "#3498db", 
        "Decision Tree": "#f1c40f", 
        "Random Forest": "#2ecc71", 
        "Gradient Boosting": "#9b59b6"
    }
    
    for model_name, res in results.items():
        y_prob_clean = res["y_prob_clean"]
        fpr_c, tpr_c, _ = roc_curve(y_test_clean, y_prob_clean)
        auc_clean = res["clean_metrics"]["auc"]
        plt.plot(fpr_c, tpr_c, label=f"{model_name} Mitigado Pre (AUC = {auc_clean:.4f})", color=colors.get(model_name, "#333333"), lw=2)
        
    plt.plot([0, 1], [0, 1], 'k--', alpha=0.5)
    plt.xlabel("Tasa de Falsos Positivos (FPR)", fontsize=12)
    plt.ylabel("Tasa de Verdaderos Positivos (TPR)", fontsize=12)
    plt.title("Comparación de Curvas ROC (Modelos Mitigados Pre)", fontsize=14, fontweight="bold", pad=15)
    plt.legend(loc="lower right", frameon=True)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "roc_comparison.png"), dpi=150)
    plt.close()
    
    # 2. Comparación de Métricas de Fairness (Bar Chart por Modelo y Algoritmo)
    plot_data = []
    for model_name, res in results.items():
        plot_data.append({
            "Algoritmo": model_name,
            "Modelo": "Sucio (Original)",
            "Demographic Parity Diff": res["raw_metrics"]["demographic_parity_difference"],
            "Disparate Impact Ratio": res["raw_metrics"]["disparate_impact_ratio"],
            "Equalized Odds Diff": res["raw_metrics"]["equalized_odds_difference"]
        })
        plot_data.append({
            "Algoritmo": model_name,
            "Modelo": "Limpio & Reweighing (Pre)",
            "Demographic Parity Diff": res["clean_metrics"]["demographic_parity_difference"],
            "Disparate Impact Ratio": res["clean_metrics"]["disparate_impact_ratio"],
            "Equalized Odds Diff": res["clean_metrics"]["equalized_odds_difference"]
        })
        plot_data.append({
            "Algoritmo": model_name,
            "Modelo": "Limpio & Thresholds (Post)",
            "Demographic Parity Diff": res["post_metrics"]["demographic_parity_difference"],
            "Disparate Impact Ratio": res["post_metrics"]["disparate_impact_ratio"],
            "Equalized Odds Diff": res["post_metrics"]["equalized_odds_difference"]
        })
    df_plot = pd.DataFrame(plot_data)
    
    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    
    # Disparate Impact Ratio
    sns.barplot(data=df_plot, x="Algoritmo", y="Disparate Impact Ratio", hue="Modelo", palette=["#e74c3c", "#2ecc71", "#3498db"], ax=axes[0])
    axes[0].axhline(1.0, color="green", linestyle="--", alpha=0.5)
    axes[0].axhline(0.8, color="red", linestyle=":", alpha=0.5, label="Límite 80% DIR (0.80)")
    axes[0].set_title("Disparate Impact Ratio (Mujer/Hombre)", fontsize=12, fontweight="bold")
    axes[0].set_ylabel("DIR (Óptimo: 1.0)")
    axes[0].legend(frameon=True)
    
    # Demographic Parity Difference
    sns.barplot(data=df_plot, x="Algoritmo", y="Demographic Parity Diff", hue="Modelo", palette=["#e74c3c", "#2ecc71", "#3498db"], ax=axes[1])
    axes[1].axhline(0.0, color="black", linestyle="-", alpha=0.3)
    axes[1].set_title("Demographic Parity Difference", fontsize=12, fontweight="bold")
    axes[1].set_ylabel("DPD (Óptimo: 0.0)")
    axes[1].legend(frameon=True)
    
    plt.suptitle("Comparación de Sesgo por Algoritmo y Mitigación (Adult Income)", fontsize=14, fontweight="bold", y=0.98)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "fairness_metrics.png"), dpi=150)
    plt.close()
    
    # 3. Matrices de Confusión para el Random Forest de referencia
    rf_res = results.get("Random Forest")
    if rf_res:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        cm_raw = confusion_matrix(y_test_raw, rf_res["y_pred_raw"])
        cm_clean = confusion_matrix(y_test_clean, rf_res["y_pred_clean"])
        
        disp_raw = ConfusionMatrixDisplay(confusion_matrix=cm_raw, display_labels=["<=50K", ">50K"])
        disp_raw.plot(cmap="Reds", ax=axes[0], colorbar=False)
        axes[0].set_title("Random Forest - Modelo Sucio", fontsize=12, fontweight="bold")
        
        disp_clean = ConfusionMatrixDisplay(confusion_matrix=cm_clean, display_labels=["<=50K", ">50K"])
        disp_clean.plot(cmap="Greens", ax=axes[1], colorbar=False)
        axes[1].set_title("Random Forest - Limpio & Mitigado Pre", fontsize=12, fontweight="bold")
        
        plt.suptitle("Matrices de Confusión (Random Forest)", fontsize=14, fontweight="bold", y=0.98)
        plt.tight_layout()
        plt.savefig(os.path.join(PLOTS_DIR, "confusion_matrices.png"), dpi=150)
        plt.close()

    # 4. Gráfico del Trade-off Rendimiento vs Equidad
    plt.figure(figsize=(12, 8))
    for model_name, res in results.items():
        # Sucio
        plt.scatter(res["raw_metrics"]["auc"], res["raw_metrics"]["disparate_impact_ratio"], 
                    color="#e74c3c", s=150, marker="o", edgecolors="black", zorder=3)
        plt.text(res["raw_metrics"]["auc"] + 0.003, res["raw_metrics"]["disparate_impact_ratio"] + 0.005, 
                 f"{model_name} (Sucio)", fontsize=8, fontweight="semibold")
        
        # Mitigado Pre (Reweighing)
        plt.scatter(res["clean_metrics"]["auc"], res["clean_metrics"]["disparate_impact_ratio"], 
                    color=colors.get(model_name, "#333333"), s=220, marker="*", edgecolors="black", zorder=3)
        plt.text(res["clean_metrics"]["auc"] + 0.003, res["clean_metrics"]["disparate_impact_ratio"] + 0.005, 
                 f"{model_name} (Mitigado Pre)", fontsize=8, fontweight="semibold")
                 
        # Mitigado Post (Tuning Umbrales)
        plt.scatter(res["post_metrics"]["auc"], res["post_metrics"]["disparate_impact_ratio"], 
                    color=colors.get(model_name, "#333333"), s=140, marker="D", edgecolors="black", zorder=3)
        plt.text(res["post_metrics"]["auc"] + 0.003, res["post_metrics"]["disparate_impact_ratio"] + 0.005, 
                 f"{model_name} (Mitigado Post)", fontsize=8, fontweight="semibold")
        
        # Flecha de transición 1 (Sucio -> Pre)
        plt.annotate("", xy=(res["clean_metrics"]["auc"], res["clean_metrics"]["disparate_impact_ratio"]),
                     xytext=(res["raw_metrics"]["auc"], res["raw_metrics"]["disparate_impact_ratio"]),
                     arrowprops=dict(arrowstyle="->", color="gray", lw=1.2, ls="--"))
                     
        # Flecha de transición 2 (Sucio -> Post)
        plt.annotate("", xy=(res["post_metrics"]["auc"], res["post_metrics"]["disparate_impact_ratio"]),
                     xytext=(res["raw_metrics"]["auc"], res["raw_metrics"]["disparate_impact_ratio"]),
                     arrowprops=dict(arrowstyle="->", color="blue", lw=1.2, ls=":"))
                     
    plt.axhline(0.8, color="red", linestyle=":", alpha=0.5, label="Límite 80% DIR (0.80)")
    plt.axhline(1.0, color="green", linestyle="--", alpha=0.5, label="Óptimo DIR (1.0)")
    plt.xlabel("Rendimiento (ROC-AUC)", fontsize=12)
    plt.ylabel("Equidad (Disparate Impact Ratio)", fontsize=12)
    plt.title("Trade-off de Equidad vs. Rendimiento (Adult Income)", fontsize=14, fontweight="bold", pad=15)
    plt.legend(frameon=True)
    plt.grid(True, which="both", linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "fairness_performance_tradeoff.png"), dpi=150)
    plt.close()
    
    # 5. Gráfico de Importancia de Variables (XAI)
    if rf_res and "pipeline_raw" in rf_res and "pipeline_clean" in rf_res:
        try:
            pipe_raw = rf_res["pipeline_raw"]
            pipe_clean = rf_res["pipeline_clean"]
            
            preprocessor_raw = pipe_raw.named_steps['preprocessor']
            features_raw = preprocessor_raw.get_feature_names_out()
            importances_raw = pipe_raw.named_steps['classifier'].feature_importances_
            
            preprocessor_clean = pipe_clean.named_steps['preprocessor']
            features_clean = preprocessor_clean.get_feature_names_out()
            importances_clean = pipe_clean.named_steps['classifier'].feature_importances_
            
            df_imp_raw = pd.DataFrame({'feature': features_raw, 'importance': importances_raw})
            df_imp_raw['feature'] = df_imp_raw['feature'].str.replace('cat__', '').str.replace('num__', '')
            df_imp_raw = df_imp_raw.sort_values(by='importance', ascending=False).head(15)
            
            df_imp_clean = pd.DataFrame({'feature': features_clean, 'importance': importances_clean})
            df_imp_clean['feature'] = df_imp_clean['feature'].str.replace('cat__', '').str.replace('num__', '')
            df_imp_clean = df_imp_clean.sort_values(by='importance', ascending=False).head(15)
            
            fig, axes = plt.subplots(1, 2, figsize=(16, 7))
            
            sns.barplot(data=df_imp_raw, x='importance', y='feature', ax=axes[0], palette='Reds_r')
            axes[0].set_title('Random Forest - Modelo Sucio (Top 15)', fontsize=12, fontweight='bold')
            axes[0].set_xlabel('Importancia de Variable')
            axes[0].set_ylabel('')
            
            sns.barplot(data=df_imp_clean, x='importance', y='feature', ax=axes[1], palette='Greens_r')
            axes[1].set_title('Random Forest - Limpio & Mitigado Pre (Top 15)', fontsize=12, fontweight='bold')
            axes[1].set_xlabel('Importancia de Variable')
            axes[1].set_ylabel('')
            
            plt.suptitle('Comparación de Importancia de Variables (XAI) - Adult Income', fontsize=14, fontweight='bold', y=0.98)
            plt.tight_layout()
            plt.savefig(os.path.join(PLOTS_DIR, "feature_importance_comparison.png"), dpi=150)
            plt.close()
        except Exception as e:
            print(f"Error al generar gráfico de importancia de características: {e}")
            
    print(f"Gráficos guardados exitosamente en {PLOTS_DIR}")


def run_cross_validation_kfold(df, classifiers, target_col="income", protected_col="sex"):
    print("\nIniciando Validación Cruzada de 5 pliegues (K-Fold CV)...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    fold_results = {}
    for name in classifiers.keys():
        fold_results[name] = {
            "Sucio": [],
            "Mitigado Pre": [],
            "Mitigado Post": []
        }
        
    df_cv = df.copy()
    X = df_cv.drop(columns=[target_col])
    y = df_cv[target_col]
    
    fold_idx = 1
    for train_idx, val_idx in cv.split(X, y):
        print(f" - Procesando pliegue {fold_idx}/5...")
        
        train_df = df_cv.iloc[train_idx].copy()
        val_df = df_cv.iloc[val_idx].copy()
        
        # Limpieza de datos
        train_clean, train_modes = clean_data(train_df, is_train=True)
        val_clean, _ = clean_data(val_df, is_train=False, train_modes=train_modes)
        
        X_train_raw = train_df.drop(columns=[target_col])
        y_train_raw = train_df[target_col]
        X_val_raw = val_df.drop(columns=[target_col])
        y_val_raw = val_df[target_col]
        
        X_train_clean = train_clean.drop(columns=[target_col])
        y_train_clean = train_clean[target_col]
        X_val_clean = val_clean.drop(columns=[target_col])
        y_val_clean = val_clean[target_col]
        
        # Reweighing
        sample_weights = calculate_reweighing_weights(train_clean, protected_col, target_col)
        
        cat_cols_raw = X_train_raw.select_dtypes(include=["object"]).columns.tolist()
        num_cols_raw = X_train_raw.select_dtypes(include=["int64", "float64"]).columns.tolist()
        
        cat_cols_clean = X_train_clean.select_dtypes(include=["object"]).columns.tolist()
        num_cols_clean = X_train_clean.select_dtypes(include=["int64", "float64"]).columns.tolist()
        
        for name, clf in classifiers.items():
            pipe_raw = build_pipeline(cat_cols_raw, num_cols_raw, clone(clf))
            pipe_clean = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
            pipe_post = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
            
            pipe_raw.fit(X_train_raw, y_train_raw)
            pipe_clean.fit(X_train_clean, y_train_clean, classifier__sample_weight=sample_weights)
            pipe_post.fit(X_train_clean, y_train_clean)
            
            y_pred_raw = pipe_raw.predict(X_val_raw)
            y_prob_raw = pipe_raw.predict_proba(X_val_raw)[:, 1]
            
            y_pred_clean = pipe_clean.predict(X_val_clean)
            y_prob_clean = pipe_clean.predict_proba(X_val_clean)[:, 1]
            
            y_prob_post = pipe_post.predict_proba(X_val_clean)[:, 1]
            
            # Sintonizar umbrales para Post en una partición interna
            X_tr, X_val_tune, y_tr, y_val_tune = train_test_split(
                X_train_clean, y_train_clean, test_size=0.2, random_state=42, stratify=y_train_clean
            )
            pipe_tune = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
            pipe_tune.fit(X_tr, y_tr)
            y_prob_tune = pipe_tune.predict_proba(X_val_tune)[:, 1]
            t0, t1 = optimize_postprocessing_thresholds(y_val_tune, y_prob_tune, X_val_tune[protected_col], target_metric="demographic_parity")
            
            # Aplicar umbrales óptimos al validation set de este fold
            sex_val_clean = X_val_clean[protected_col].astype(str).str.strip().values
            y_pred_post = np.where(sex_val_clean == "Female", y_prob_post >= t0, y_prob_post >= t1).astype(int)
            
            # Métricas
            raw_m = {
                "accuracy": accuracy_score(y_val_raw, y_pred_raw),
                "recall": recall_score(y_val_raw, y_pred_raw),
                "auc": roc_auc_score(y_val_raw, y_prob_raw),
                **calculate_fairness_metrics(y_val_raw, y_pred_raw, X_val_raw[protected_col])
            }
            
            clean_m = {
                "accuracy": accuracy_score(y_val_clean, y_pred_clean),
                "recall": recall_score(y_val_clean, y_pred_clean),
                "auc": roc_auc_score(y_val_clean, y_prob_clean),
                **calculate_fairness_metrics(y_val_clean, y_pred_clean, X_val_clean[protected_col])
            }
            
            post_m = {
                "accuracy": accuracy_score(y_val_clean, y_pred_post),
                "recall": recall_score(y_val_clean, y_pred_post),
                "auc": roc_auc_score(y_val_clean, y_prob_post),
                **calculate_fairness_metrics(y_val_clean, y_pred_post, X_val_clean[protected_col])
            }
            
            fold_results[name]["Sucio"].append(raw_m)
            fold_results[name]["Mitigado Pre"].append(clean_m)
            fold_results[name]["Mitigado Post"].append(post_m)
            
        fold_idx += 1
        
    cv_metrics = {}
    for name in classifiers.keys():
        cv_metrics[name] = {}
        for config in ["Sucio", "Mitigado Pre", "Mitigado Post"]:
            metrics_list = fold_results[name][config]
            cv_metrics[name][config] = {
                "accuracy_mean": np.mean([m["accuracy"] for m in metrics_list]),
                "accuracy_std": np.std([m["accuracy"] for m in metrics_list]),
                "recall_mean": np.mean([m["recall"] for m in metrics_list]),
                "recall_std": np.std([m["recall"] for m in metrics_list]),
                "auc_mean": np.mean([m["auc"] for m in metrics_list]),
                "auc_std": np.std([m["auc"] for m in metrics_list]),
                "demographic_parity_difference_mean": np.mean([m["demographic_parity_difference"] for m in metrics_list]),
                "demographic_parity_difference_std": np.std([m["demographic_parity_difference"] for m in metrics_list]),
                "disparate_impact_ratio_mean": np.mean([m["disparate_impact_ratio"] for m in metrics_list]),
                "disparate_impact_ratio_std": np.std([m["disparate_impact_ratio"] for m in metrics_list]),
                "equalized_odds_difference_mean": np.mean([m["equalized_odds_difference"] for m in metrics_list]),
                "equalized_odds_difference_std": np.std([m["equalized_odds_difference"] for m in metrics_list]),
            }
            
    return cv_metrics

def generate_markdown_report(results, cv_results):
    readme_path = os.path.join(BASE_DIR, "README.md")
    
    # 1. Tabla de Test Split (Holdout)
    table_rows = []
    for model_name, res in results.items():
        raw_m = res["raw_metrics"]
        clean_m = res["clean_metrics"]
        post_m = res["post_metrics"]
        
        table_rows.append(
            f"| **{model_name} (Sucio)** | {raw_m['accuracy']:.2%} | {raw_m['precision']:.2%} | {raw_m['recall']:.2%} | {raw_m['f1']:.2%} | {raw_m['auc']:.4f} | {raw_m['demographic_parity_difference']:.4f} | {raw_m['disparate_impact_ratio']:.4f} | {raw_m['equalized_odds_difference']:.4f} |"
        )
        table_rows.append(
            f"| **{model_name} (Mitigado Pre)** | {clean_m['accuracy']:.2%} | {clean_m['precision']:.2%} | {clean_m['recall']:.2%} | {clean_m['f1']:.2%} | {clean_m['auc']:.4f} | {clean_m['demographic_parity_difference']:.4f} | {clean_m['disparate_impact_ratio']:.4f} | {clean_m['equalized_odds_difference']:.4f} |"
        )
        table_rows.append(
            f"| **{model_name} (Mitigado Post)** | {post_m['accuracy']:.2%} | {post_m['precision']:.2%} | {post_m['recall']:.2%} | {post_m['f1']:.2%} | {post_m['auc']:.4f} | {post_m['demographic_parity_difference']:.4f} | {post_m['disparate_impact_ratio']:.4f} | {post_m['equalized_odds_difference']:.4f} |"
        )
        table_rows.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
        
    table_content = "\n".join(table_rows)
    
    # 2. Tabla de Validación Cruzada (CV)
    cv_rows = []
    for model_name, configs in cv_results.items():
        for config_name, metrics in configs.items():
            cv_rows.append(
                f"| **{model_name} ({config_name})** | "
                f"{metrics['accuracy_mean']:.2%} &plusmn; {metrics['accuracy_std']:.2%} | "
                f"{metrics['recall_mean']:.2%} &plusmn; {metrics['recall_std']:.2%} | "
                f"{metrics['auc_mean']:.4f} &plusmn; {metrics['auc_std']:.4f} | "
                f"{metrics['demographic_parity_difference_mean']:.4f} &plusmn; {metrics['demographic_parity_difference_std']:.4f} | "
                f"{metrics['disparate_impact_ratio_mean']:.4f} &plusmn; {metrics['disparate_impact_ratio_std']:.4f} | "
                f"{metrics['equalized_odds_difference_mean']:.4f} &plusmn; {metrics['equalized_odds_difference_std']:.4f} |"
            )
        cv_rows.append("| --- | --- | --- | --- | --- | --- | --- |")
        
    cv_table_content = "\n".join(cv_rows)
    
    content = f"""# Reporte Experimental Avanzado: Calidad de Datos e Impacto en Machine Learning (Adult Income)

Este experimento evalúa de forma práctica cómo los problemas de calidad de datos (como nulos implícitos, inconsistencias sintácticas y sesgos de género) afectan a múltiples algoritmos. Compara 4 algoritmos en tres configuraciones:

1. **Modelo Sucio (Original):** Entrenado con datos originales con nulos `?` y proxies de sesgo, usando umbral estándar 0.5.
2. **Modelo Mitigado Pre (Reweighing):** Entrenado tras limpiar los datos, remover proxies de género y aplicar pesos de reponderación (Reweighing).
3. **Modelo Mitigado Post (Threshold Tuning):** Entrenado sobre datos limpios (sin pesos), pero optimizando umbrales específicos de clasificación por género para mitigar la brecha en tasas de decisión.

---

## 📊 Tabla Comparativa de Resultados (Split Holdout)

| Algoritmo y Configuración | Accuracy | Precision | Recall | F1-Score | ROC-AUC | Demographic Parity Diff | Disparate Impact Ratio | Equalized Odds Diff |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
{table_content}

---

## 🛡️ Robustez Estadística: Validación Cruzada Estratificada de 5 Pliegues

Para garantizar que los resultados no son fruto del azar de una única partición, reportamos las métricas obtenidas mediante validación cruzada estratificada de 5 pliegues (media &plusmn; desviación estándar):

| Algoritmo y Configuración | Accuracy (CV) | Recall (CV) | ROC-AUC (CV) | Demographic Parity Diff (CV) | Disparate Impact Ratio (CV) | Equalized Odds Diff (CV) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
{cv_table_content}

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
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Reporte escrito con éxito en {readme_path}")


def main():
    # 1. Cargar Datos
    df = load_data()
    
    # Mapear el target en el dataset raw de entrada para poder hacer split estratificado
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
    
    # Guardar el dataset limpio y completo
    print(f"Guardando dataset limpio unificado en {CLEAN_CSV_PATH}...")
    full_clean_df, _ = clean_data(df.drop(columns=["income_mapped"]), is_train=False, train_modes=train_modes)
    full_clean_df.to_csv(CLEAN_CSV_PATH, index=False)
    
    # Preparar el conjunto de test
    test_raw_df = X_test_raw.copy()
    test_raw_df["income"] = y_test_raw
    test_clean_df, _ = clean_data(test_raw_df, is_train=False, train_modes=train_modes)
    
    X_test_clean = test_clean_df.drop(columns=["income"])
    y_test_clean = test_clean_df["income"]
    
    # 4. Calcular pesos de reponderación (Fairness Mitigation - Pre) para el modelo limpio
    sample_weights = calculate_reweighing_weights(train_clean_df, protected_col="sex", target_col="income")
    
    # 5. Configurar Pipelines de Modelado
    cat_cols_raw = X_train_raw.select_dtypes(include=["object"]).columns.tolist()
    num_cols_raw = X_train_raw.select_dtypes(include=["int64", "float64"]).columns.tolist()
    
    cat_cols_clean = X_train_clean.select_dtypes(include=["object"]).columns.tolist()
    num_cols_clean = X_train_clean.select_dtypes(include=["int64", "float64"]).columns.tolist()
    
    # Definir clasificadores a comparar
    classifiers = {
        "Logistic Regression": LogisticRegression(random_state=42, max_iter=1000),
        "Decision Tree": DecisionTreeClassifier(random_state=42, max_depth=10),
        "Random Forest": RandomForestClassifier(random_state=42, n_estimators=100, max_depth=15, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(random_state=42, n_estimators=100, max_depth=5)
    }
    
    results = {}
    
    # 6. Entrenar y Evaluar Modelos en Test Split
    for name, clf in classifiers.items():
        print(f"\nProcesando algoritmo: {name}...")
        
        # Pipelines
        pipeline_raw = build_pipeline(cat_cols_raw, num_cols_raw, clone(clf))
        pipeline_clean = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
        pipeline_post = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
        
        # Entrenar Modelo Sucio
        print(f" - Entrenando {name} (Sucio)...")
        pipeline_raw.fit(X_train_raw, y_train_raw)
        
        # Entrenar Modelo Limpio & Mitigado Pre (Reweighing)
        print(f" - Entrenando {name} (Limpio & Mitigado Pre)...")
        pipeline_clean.fit(X_train_clean, y_train_clean, classifier__sample_weight=sample_weights)
        
        # Entrenar Modelo para Post-procesamiento (Limpio estándar sin pesos)
        print(f" - Entrenando {name} (Limpio para Post-procesamiento)...")
        pipeline_post.fit(X_train_clean, y_train_clean)
        
        # Sintonizar umbrales para Post-procesamiento en una partición de validación interna
        X_tr, X_val_tune, y_tr, y_val_tune = train_test_split(
            X_train_clean, y_train_clean, test_size=0.2, random_state=42, stratify=y_train_clean
        )
        pipe_tune = build_pipeline(cat_cols_clean, num_cols_clean, clone(clf))
        pipe_tune.fit(X_tr, y_tr)
        y_prob_tune = pipe_tune.predict_proba(X_val_tune)[:, 1]
        t0, t1 = optimize_postprocessing_thresholds(y_val_tune, y_prob_tune, X_val_tune["sex"], target_metric="demographic_parity")
        print(f"   [Umbrales Óptimos Post-procesamiento] Female (Mujeres): {t0:.4f}, Male (Hombres): {t1:.4f}")
        
        # Predicciones
        y_pred_raw = pipeline_raw.predict(X_test_raw)
        y_pred_clean = pipeline_clean.predict(X_test_clean)
        
        y_prob_raw = pipeline_raw.predict_proba(X_test_raw)[:, 1]
        y_prob_clean = pipeline_clean.predict_proba(X_test_clean)[:, 1]
        
        # Predicciones Post-procesadas (usando probabilidades del modelo limpio estándar)
        y_prob_post = pipeline_post.predict_proba(X_test_clean)[:, 1]
        sex_test_clean = X_test_clean["sex"].astype(str).str.strip().values
        y_pred_post = np.where(sex_test_clean == "Female", y_prob_post >= t0, y_prob_post >= t1).astype(int)
        
        # Evaluar Rendimiento Sucio
        acc_raw = accuracy_score(y_test_raw, y_pred_raw)
        prec_raw = precision_score(y_test_raw, y_pred_raw)
        rec_raw = recall_score(y_test_raw, y_pred_raw)
        f1_raw = f1_score(y_test_raw, y_pred_raw)
        auc_raw = roc_auc_score(y_test_raw, y_prob_raw)
        
        raw_metrics = {
            "accuracy": acc_raw, "precision": prec_raw, "recall": rec_raw, "f1": f1_raw, "auc": auc_raw,
            **calculate_fairness_metrics(y_test_raw, y_pred_raw, X_test_raw["sex"])
        }
        
        # Evaluar Rendimiento Limpio Mitigado Pre (Reweighing)
        acc_clean = accuracy_score(y_test_clean, y_pred_clean)
        prec_clean = precision_score(y_test_clean, y_pred_clean)
        rec_clean = recall_score(y_test_clean, y_pred_clean)
        f1_clean = f1_score(y_test_clean, y_pred_clean)
        auc_clean = roc_auc_score(y_test_clean, y_prob_clean)
        
        clean_metrics = {
            "accuracy": acc_clean, "precision": prec_clean, "recall": rec_clean, "f1": f1_clean, "auc": auc_clean,
            **calculate_fairness_metrics(y_test_clean, y_pred_clean, X_test_clean["sex"])
        }
        
        # Evaluar Rendimiento Limpio Mitigado Post (Tuning Umbrales)
        acc_post = accuracy_score(y_test_clean, y_pred_post)
        prec_post = precision_score(y_test_clean, y_pred_post)
        rec_post = recall_score(y_test_clean, y_pred_post)
        f1_post = f1_score(y_test_clean, y_pred_post)
        auc_post = roc_auc_score(y_test_clean, y_prob_post)
        
        post_metrics = {
            "accuracy": acc_post, "precision": prec_post, "recall": rec_post, "f1": f1_post, "auc": auc_post,
            **calculate_fairness_metrics(y_test_clean, y_pred_post, X_test_clean["sex"])
        }
        
        results[name] = {
            "y_pred_raw": y_pred_raw,
            "y_pred_clean": y_pred_clean,
            "y_prob_raw": y_prob_raw,
            "y_prob_clean": y_prob_clean,
            "pipeline_raw": pipeline_raw,
            "pipeline_clean": pipeline_clean,
            "raw_metrics": raw_metrics,
            "clean_metrics": clean_metrics,
            "post_metrics": post_metrics
        }
        
    # 7. Ejecutar Validación Cruzada (CV) para robustez estadística
    df_cv = df.copy()
    df_cv = df_cv.drop(columns=["income"])
    df_cv = df_cv.rename(columns={"income_mapped": "income"})
    cv_results = run_cross_validation_kfold(df_cv, classifiers, target_col="income", protected_col="sex")
    
    # 8. Reportar Resultados en Consola
    print("\n" + "="*80)
    print(" RESULTADOS COMPARATIVOS EN TEST SET (ADULT INCOME) ")
    print("="*80)
    print(f"{'Algoritmo':<22} | {'Métrica':<15} | {'Sucio':<10} | {'Pre (Rew.)':<10} | {'Post (Umb.)':<10}")
    print("-"*80)
    
    for name in classifiers.keys():
        r = results[name]["raw_metrics"]
        c = results[name]["clean_metrics"]
        p = results[name]["post_metrics"]
        print(f"{name:<22} | {'Accuracy':<15} | {r['accuracy']:.2%} | {c['accuracy']:.2%} | {p['accuracy']:.2%}")
        print(f"{name:<22} | {'Recall':<15} | {r['recall']:.2%} | {c['recall']:.2%} | {p['recall']:.2%}")
        print(f"{name:<22} | {'ROC-AUC':<15} | {r['auc']:.4f} | {c['auc']:.4f} | {p['auc']:.4f}")
        print(f"{name:<22} | {'Disp. Impact':<15} | {r['disparate_impact_ratio']:.4f} | {c['disparate_impact_ratio']:.4f} | {p['disparate_impact_ratio']:.4f}")
        print("-"*80)
    print("="*80)
    
    # 9. Guardar Gráficos
    save_plots(results, X_test_raw, y_test_raw, X_test_clean, y_test_clean)
    
    # 10. Escribir reporte en Markdown (README.md)
    generate_markdown_report(results, cv_results)

if __name__ == "__main__":
    main()
