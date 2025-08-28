#!/bin/bash
# No usar set -e para evitar que el script termine por errores

echo "=== Iniciando entrypoint.sh ==="

# Instalar psql si no está disponible
if ! command -v psql &> /dev/null; then
    echo "Instalando cliente PostgreSQL..."
    apt-get update && apt-get install -y postgresql-client
fi

# Esperar a que PostgreSQL esté disponible
echo "Esperando a que PostgreSQL esté disponible..."
PGCONNECT_TIMEOUT=5
PGMAX_ATTEMPTS=30
PGATTEMPT=0

while [ $PGATTEMPT -lt $PGMAX_ATTEMPTS ]; do
    echo "Intento $((PGATTEMPT+1))/$PGMAX_ATTEMPTS de conexión a PostgreSQL..."
    if PGPASSWORD=postgres psql -h postgres -U postgres -d postgres -c '\l' &> /dev/null; then
        echo "¡PostgreSQL está disponible!"
        break
    fi
    PGATTEMPT=$((PGATTEMPT+1))
    echo "PostgreSQL no está disponible aún - esperando..."
    sleep 5
done

if [ $PGATTEMPT -eq $PGMAX_ATTEMPTS ]; then
    echo "ERROR: No se pudo conectar a PostgreSQL después de $PGMAX_ATTEMPTS intentos."
    echo "Continuando de todos modos..."
fi

# Verificar si la base de datos existe
echo "Verificando si la base de datos dataquality existe..."
if ! PGPASSWORD=postgres psql -h postgres -U postgres -lqt | cut -d \| -f 1 | grep -qw dataquality; then
    echo "Creando base de datos dataquality..."
    PGPASSWORD=postgres psql -h postgres -U postgres -c 'CREATE DATABASE dataquality;'
fi

# Aplicar migraciones
echo "Aplicando migraciones..."
flask db init || echo "Flask db ya está inicializado"
flask db migrate || echo "No se pudo crear la migración, pero continuamos"
flask db upgrade || echo "No se pudieron aplicar las migraciones, pero continuamos"

# Iniciar la aplicación
echo "Iniciando la aplicación..."
exec gunicorn --bind 0.0.0.0:5000 --log-level debug app:app
