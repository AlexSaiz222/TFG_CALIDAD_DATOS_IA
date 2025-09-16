@echo off
echo Reiniciando contenedores para aplicar cambios en Celery...

echo 1. Reiniciando backend...
docker restart tfg_calidad_datos_ia-backend-1

echo 2. Reiniciando worker de Celery...
docker restart tfg_calidad_datos_ia-celery-worker-1

echo 3. Reiniciando beat de Celery...
docker restart tfg_calidad_datos_ia-celery-beat-1

echo 4. Reiniciando flower...
docker restart tfg_calidad_datos_ia-flower-1

echo Contenedores reiniciados correctamente.
echo Para verificar el estado de los contenedores, ejecuta: docker ps

pause
