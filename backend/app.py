import os
import logging
from datetime import timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

from config import get_config  # Importando desde el paquete config
from extensions import db
from api.routes import register_routes
from config.logging_config import setup_logging
from middleware.error_handlers import register_error_handlers
from middleware.request_middleware import register_request_middleware
from middleware.performance_monitor import register_performance_middleware

# Asegurar que existe el directorio de logs
def ensure_log_directory():
    """Crea el directorio de logs si no existe"""
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

# Configuración de limiter para rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)

# Configuración de JWT blacklist
jwt_blacklist = set()

def create_app(config_name=None):
    """Crea y configura la aplicación Flask
    
    Args:
        config_name (str, opcional): Nombre de la configuración a utilizar
            (development, testing, production). Por defecto usa FLASK_ENV.
    
    Returns:
        Flask: Instancia de la aplicación configurada
    """
    # Obtener configuración según entorno
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    config_object = get_config()
    
    # Crear instancia de Flask
    app = Flask(__name__)
    app.config.from_object(config_object)
    
    # Desactivar strict_slashes para evitar redirecciones 308
    app.url_map.strict_slashes = False
    
    # Asegurar que existe el directorio de logs
    ensure_log_directory()
    
    # Inicializar logging mejorado
    setup_logging(app)
    app.logger.info(f"Iniciando aplicación en modo {config_name}")
    
    # Registrar middlewares
    register_request_middleware(app)
    register_error_handlers(app)
    register_performance_middleware(app)
    
    # Configurar umbrales de rendimiento
    app.config['SLOW_REQUEST_THRESHOLD_MS'] = 500  # Umbral para solicitudes lentas (ms)
    app.config['SLOW_FUNCTION_THRESHOLD_MS'] = 200  # Umbral para funciones lentas (ms)
    
    # Inicializar extensiones
    CORS(app, 
         resources={r"/*": {"origins": app.config['CORS_ORIGINS']}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials", "X-Request-ID", "Cache-Control", "Pragma", "Expires"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type", "Authorization", "X-Request-ID"],
         max_age=600
    )
    db.init_app(app)
    
    # Inicializar Flask-Migrate
    migrate = Migrate(app, db)
    
    # Configurar JWT con blacklist
    jwt = JWTManager(app)
    
    # Configurar opciones adicionales de JWT
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)  # Aumentar tiempo de expiración
    app.config['JWT_ERROR_MESSAGE_KEY'] = 'message'  # Clave para mensajes de error
    
    @jwt.token_in_blocklist_loader
    def check_if_token_in_blacklist(jwt_header, jwt_payload):
        jti = jwt_payload['jti']
        return jti in jwt_blacklist
        
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'success': False,
            'error': 'token_expired',
            'message': 'El token ha expirado',
            'data': []  # Incluir data vacío para compatibilidad con frontend
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'success': False,
            'error': 'invalid_token',
            'message': 'Token inválido',
            'data': []  # Incluir data vacío para compatibilidad con frontend
        }), 401
        
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        app.logger.warning(f"Solicitud sin token: {error}")
        return jsonify({
            'success': False,
            'error': 'authorization_required',
            'message': 'Se requiere token de autorización',
            'data': []  # Incluir data vacío para compatibilidad con frontend
        }), 401
        
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        app.logger.warning(f"Token inválido: {error}")
        return jsonify({
            'success': False,
            'error': 'invalid_token',
            'message': f'Token inválido: {error}',
            'data': []  # Incluir data vacío para compatibilidad con frontend
        }), 401
        
    @jwt.token_verification_failed_loader
    def verification_failed_callback():
        app.logger.warning("Verificación de token fallida")
        return jsonify({
            'success': False,
            'error': 'token_verification_failed',
            'message': 'La verificación del token ha fallado',
            'data': []  # Incluir data vacío para compatibilidad con frontend
        }), 401
        
    # Nota: decode_error_loader no está disponible en esta versión de Flask-JWT-Extended
    # Usamos invalid_token_loader que captura errores similares
    
    # Inicializar rate limiter
    limiter.init_app(app)
    if app.config.get('REDIS_URL'):
        limiter.storage_uri = app.config['REDIS_URL']
    
    # Registrar rutas API
    register_routes(app)
    
    # Endpoint de health check
    @app.route('/health')
    def health_check():
        return jsonify({
            "status": "healthy", 
            "version": "0.1.0",
            "environment": config_name
        })
    
    # Logging de solicitudes
    @app.before_request
    def log_request_info():
        app.logger.debug(f"Request: {request.method} {request.path} from {request.remote_addr}")
    
    @app.after_request
    def log_response_info(response):
        app.logger.debug(f"Response: {response.status_code}")
        return response
    
    # Manejador de errores global
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Internal server error",
            "message": "Se ha producido un error inesperado",
            "data": []  # Incluir data vacío para compatibilidad con frontend
        }), 500
    
    return app

# Crear la aplicación Flask
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=app.config['DEBUG'])
