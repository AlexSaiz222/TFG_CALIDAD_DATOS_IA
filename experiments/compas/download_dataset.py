import os
import pandas as pd

# Definir directorios y archivos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_CSV_PATH = os.path.join(DATA_DIR, "compas_raw.csv")

# URL del dataset COMPAS en el repositorio de ProPublica
URL_COMPAS = "https://raw.githubusercontent.com/propublica/compas-analysis/master/compas-scores-two-years.csv"

def main():
    # Crear directorio de datos si no existe
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Directorio creado: {DATA_DIR}")

    print("Descargando dataset COMPAS Recidivism desde ProPublica GitHub...")
    
    try:
        # Descargar usando pandas directamente desde la URL
        df = pd.read_csv(URL_COMPAS)
        print(f"Descargadas {len(df)} filas.")
        
        # Guardar como CSV localmente
        print(f"Guardando dataset en {RAW_CSV_PATH}...")
        df.to_csv(RAW_CSV_PATH, index=False)
        print("Completado con éxito.")
    except Exception as e:
        print(f"Error al descargar el dataset COMPAS: {e}")

if __name__ == "__main__":
    main()
