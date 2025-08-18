@echo off
echo Desplegando aplicacion Docker...
echo.

REM Detener contenedores existentes
echo Deteniendo contenedores existentes...
docker-compose down

REM Reconstruir y levantar contenedores
echo Reconstruyendo y levantando contenedores...
docker-compose up -d --build

echo.
echo Despliegue completado. Verifica el estado con 'docker-compose ps'
echo Para ver logs: 'docker-compose logs -f'
echo.
echo Servicios disponibles:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:5000
echo - MinIO Console: http://localhost:9001
echo - Flower (Celery Monitor): http://localhost:5555
