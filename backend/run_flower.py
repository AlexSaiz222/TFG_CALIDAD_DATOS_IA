#!/usr/bin/env python
"""
Script para instalar y ejecutar Celery Flower
"""
import os
import sys
import subprocess
import time

def check_flower_installed():
    """Verifica si flower está instalado"""
    try:
        import flower
        print("✅ Flower ya está instalado")
        return True
    except ImportError:
        print("❌ Flower no está instalado")
        return False

def install_flower():
    """Instala flower usando pip"""
    print("📦 Instalando Flower...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flower==1.2.0"])
        print("✅ Flower instalado correctamente")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al instalar Flower: {e}")
        return False

def run_flower():
    """Ejecuta Celery Flower"""
    print("🚀 Iniciando Celery Flower...")
    try:
        # Importamos aquí para asegurarnos de que está instalado
        from celery.bin import flower
        
        # Configuración de Flower
        flower_options = [
            '--port=5555',
            '--broker=redis://localhost:6379/0',
            '--address=0.0.0.0'  # Permite acceso desde cualquier IP
        ]
        
        # Ejecutar Flower
        flower.flower(argv=['flower'] + flower_options)
        return True
    except Exception as e:
        print(f"❌ Error al iniciar Flower: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("🌸 CELERY FLOWER LAUNCHER 🌸")
    print("=" * 50)
    
    # Verificar si Flower está instalado
    if not check_flower_installed():
        if not install_flower():
            print("❌ No se pudo instalar Flower. Saliendo...")
            sys.exit(1)
    
    # Ejecutar Flower
    print("\n🔄 Iniciando Flower...")
    run_flower()
