"""
Paquete de configuración para la aplicación Flask.

Este paquete contiene módulos para configurar la aplicación,
incluyendo configuración de logging, variables de entorno y opciones.
"""

from config.settings import get_config, Config, DevelopmentConfig, TestingConfig, ProductionConfig

__all__ = ['get_config', 'Config', 'DevelopmentConfig', 'TestingConfig', 'ProductionConfig']
