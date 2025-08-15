@echo off
echo ===================================
echo Iniciando Celery Flower
echo ===================================

REM Activar el entorno virtual si existe
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
)

REM Ejecutar el script de Python
python run_flower.py

REM Mantener la ventana abierta en caso de error
if %ERRORLEVEL% neq 0 (
    echo.
    echo Hubo un error al ejecutar Flower. Presiona cualquier tecla para cerrar...
    pause > nul
)
