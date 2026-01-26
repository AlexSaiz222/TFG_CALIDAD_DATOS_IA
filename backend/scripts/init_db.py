#!/usr/bin/env python
"""
Script para inicializar la base de datos con las tablas necesarias
y datos iniciales para el funcionamiento de la aplicación.
"""
import os
import sys
from pathlib import Path

# Añadir el directorio raíz al path para importar módulos
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from flask import Flask
from sqlalchemy import inspect

from extensions import db
from models.user import User
from models.project import Project
from models.dataset import Dataset
from models.evaluation import Evaluation, Issue
from models.analysis import AnalysisRun, QualityGate, DataQualityIssue
from config import config

# Cargar variables de entorno
load_dotenv()

def create_app():
    """Crear una instancia de la aplicación Flask para inicializar la base de datos"""
    app = Flask(__name__)
    config_name = os.getenv('FLASK_ENV', 'development')
    app.config.from_object(config[config_name])
    db.init_app(app)
    return app

def init_db(app):
    """Inicializar la base de datos con las tablas necesarias"""
    with app.app_context():
        inspector = inspect(db.engine)
        
        # Verificar si las tablas ya existen
        existing_tables = inspector.get_table_names()
        
        if not existing_tables:
            print("Creando tablas en la base de datos...")
            db.create_all()
            print("Tablas creadas correctamente.")
        else:
            print(f"Tablas existentes: {', '.join(existing_tables)}")
            
            # Verificar si la tabla de evaluaciones existe pero no tiene las nuevas columnas
            if 'evaluation' in existing_tables:
                columns = [column['name'] for column in inspector.get_columns('evaluation')]
                new_columns = ['task_id', 'progress', 'current_step', 'error']
                
                missing_columns = [col for col in new_columns if col not in columns]
                if missing_columns:
                    print(f"La tabla 'evaluation' existe pero faltan las columnas: {', '.join(missing_columns)}")
                    print("Ejecute las migraciones para actualizar la estructura de la tabla.")
                else:
                    print("La tabla 'evaluation' ya tiene todas las columnas necesarias.")

def create_migration_script():
    """Crear un script SQL de migración para añadir las nuevas columnas"""
    migration_sql = """
-- Migración para añadir nuevas columnas a la tabla evaluation
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS task_id VARCHAR(255);
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS current_step VARCHAR(255);
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS error TEXT;

-- Actualizar evaluaciones existentes
UPDATE evaluation SET progress = 100 WHERE status = 'completed';
UPDATE evaluation SET progress = 0 WHERE status = 'pending';
UPDATE evaluation SET progress = 0 WHERE status = 'failed';
    """
    
    migration_path = Path(__file__).parent / 'migrations'
    migration_path.mkdir(exist_ok=True)
    
    file_path = migration_path / 'add_async_columns.sql'
    with open(file_path, 'w') as f:
        f.write(migration_sql)
    
    print(f"Script de migración creado en: {file_path}")
    return file_path

def main():
    """Función principal"""
    app = create_app()
    init_db(app)
    migration_path = create_migration_script()
    
    print("\nPara aplicar la migración manualmente, ejecute:")
    print(f"psql -U <usuario> -d <base_de_datos> -f {migration_path}")
    print("\nO desde Python:")
    print("from flask import current_app")
    print("with current_app.app_context():")
    print("    db.session.execute(text(open('scripts/migrations/add_async_columns.sql').read()))")
    print("    db.session.commit()")

if __name__ == '__main__':
    main()
