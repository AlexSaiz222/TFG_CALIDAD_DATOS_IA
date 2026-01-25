#!/usr/bin/env python
"""
Script para aplicar migraciones SQL a la base de datos
"""
import os
import sys
from pathlib import Path

# Añadir el directorio raíz al path para importar módulos
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from flask import Flask
from sqlalchemy import text

from extensions import db
from config import get_config

# Cargar variables de entorno
load_dotenv()

def create_app():
    """Crear una instancia de la aplicación Flask"""
    app = Flask(__name__)
    app.config.from_object(get_config())
    db.init_app(app)
    return app

def apply_migration(migration_file):    
    """Aplicar un archivo de migración SQL"""
    app = create_app()
    
    with app.app_context():
        migration_path = Path(__file__).parent / 'migrations' / migration_file
        
        if not migration_path.exists():
            print(f"Error: El archivo de migración {migration_path} no existe.")
            return False
        
        print(f"Aplicando migración: {migration_file}")
        
        try:
            with open(migration_path, 'r') as f:
                sql = f.read()
            
            # Ejecutar el SQL
            db.session.execute(text(sql))
            db.session.commit()
            
            print(f"✓ Migración {migration_file} aplicada correctamente.")
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error al aplicar la migración: {str(e)}")
            return False

def main():
    """Función principal"""
    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
    else:
        # Por defecto, aplicar la migración de metrics_config
        migration_file = 'add_metrics_config.sql'
    
    success = apply_migration(migration_file)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
