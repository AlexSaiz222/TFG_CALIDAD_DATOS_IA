import os
import pandas as pd
import urllib.request

# Definir directorios y archivos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_CSV_PATH = os.path.join(DATA_DIR, "adult_raw.csv")

# URLs del dataset en el repositorio UCI
URL_DATA = "https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.data"
URL_TEST = "https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.test"

# Nombres de las columnas
COLUMNS = [
    "age", "workclass", "fnlwgt", "education", "education_num", 
    "marital_status", "occupation", "relationship", "race", "sex", 
    "capital_gain", "capital_loss", "hours_per_week", "native_country", 
    "income"
]

def main():
    # Crear directorio de datos si no existe
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Directorio creado: {DATA_DIR}")

    print("Descargando dataset Adult Income de UCI Machine Learning Repository...")
    
    # Descargar y cargar adult.data (Train)
    print(f"Descargando datos de entrenamiento desde {URL_DATA}...")
    try:
        df_train = pd.read_csv(URL_DATA, header=None, names=COLUMNS, sep=",", skipinitialspace=False)
        print(f"Cargadas {len(df_train)} filas de entrenamiento.")
    except Exception as e:
        print(f"Error al descargar train data: {e}")
        return

    # Descargar y cargar adult.test (Test)
    # Nota: La primera línea de adult.test es un comentario (|1x3 Cross validator) que debemos saltar.
    print(f"Descargando datos de prueba desde {URL_TEST}...")
    try:
        # Usamos skiprows=1 para saltar el comentario inicial
        df_test = pd.read_csv(URL_TEST, header=None, names=COLUMNS, sep=",", skiprows=1, skipinitialspace=False)
        print(f"Cargadas {len(df_test)} filas de prueba.")
    except Exception as e:
        print(f"Error al descargar test data: {e}")
        return

    # Combinar los dos conjuntos de datos
    print("Combinando conjuntos de entrenamiento y prueba...")
    df_combined = pd.concat([df_train, df_test], ignore_index=True)
    
    # Inspeccionar las clases de ingresos para corregir inconsistencias
    # En adult.test, los valores suelen acabar con un punto '.' (e.g. " <=50K." o " >50K.")
    print("Clases originales detectadas en la columna 'income':")
    print(df_combined["income"].unique())
    
    # Limpiar la columna de ingresos (quitar el punto final si existe, manteniendo los espacios iniciales para el 'raw')
    df_combined["income"] = df_combined["income"].astype(str).str.rstrip(".")
    
    print("Clases normalizadas en la columna 'income':")
    print(df_combined["income"].unique())
    
    # Guardar como CSV
    print(f"Guardando dataset unificado en {RAW_CSV_PATH}...")
    df_combined.to_csv(RAW_CSV_PATH, index=False)
    print(f"Completado con éxito. Total registros: {len(df_combined)}")

if __name__ == "__main__":
    main()
