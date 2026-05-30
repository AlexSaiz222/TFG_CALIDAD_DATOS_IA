import os
import time
import sys
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

if not HAS_REQUESTS:
    print("\n[MLOps Pipeline] [ERROR CRÍTICO] La librería 'requests' no está instalada.")
    print("[MLOps Pipeline] Por favor, instálala ejecutando: venv\\Scripts\\pip.exe install requests")
    print("="*80 + "\n")
    sys.exit(1)

import pandas as pd
import numpy as np

# Configuración por defecto
API_URL = "http://localhost:5000/api"
DEFAULT_PROJECT_ID = 1

# La simulación local (offline) ha sido eliminada.
# El script interactúa única y estrictamente con la API real de DataQual en ejecución.


def run_real_pipeline(dataset_path):
    """
    Ejecuta el flujo real comunicándose con la API REST de DataQual:
    1. Registro/Login de usuario MLOps (JWT).
    2. Creación o carga de proyecto MLOps.
    3. Carga del archivo a MinIO/API.
    4. Ejecución del análisis Sonar-Lite (asíncrono con Celery).
    5. Polling del estado del análisis hasta su completación.
    """
    filename = os.path.basename(dataset_path)
    print("[MLOps Pipeline] [LIVE] Iniciando comunicación con la API REST de DataQual...")
    
    # 1. Login/Registro de usuario de MLOps
    username = "mlops_pipeline_user"
    email = "mlops@dataqual.com"
    password = "MLopsSecurePassword123!"
    
    session = requests.Session()
    
    # Intentar login
    login_url = f"{API_URL}/auth/login"
    try:
        r = session.post(login_url, json={"username": username, "password": password})
        if r.status_code != 200:
            # Si no existe, intentar registrar
            print("[MLOps Pipeline] [LIVE] Usuario no encontrado. Registrando nuevo usuario MLOps...")
            reg_url = f"{API_URL}/auth/register"
            r_reg = session.post(reg_url, json={
                "username": username,
                "email": email,
                "password": password,
                "first_name": "MLOps",
                "last_name": "Pipeline",
                "organization": "DataQual CI",
                "role": "user"
            })
            if r_reg.status_code not in (200, 201, 409):
                print(f"[MLOps Pipeline] [LIVE] Error al registrar usuario: {r_reg.text}")
                return None
            
            # Login tras registrar
            r = session.post(login_url, json={"username": username, "password": password})
            if r.status_code != 200:
                print(f"[MLOps Pipeline] [LIVE] Error al iniciar sesión tras registro: {r.text}")
                return None
                
        auth_data = r.json()
        token = auth_data["token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        print("[MLOps Pipeline] [LIVE] Autenticado correctamente con la API (JWT Token obtenido).")
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Error en el proceso de autenticación: {e}")
        return None
        
    # 2. Obtener o crear proyecto de MLOps
    project_id = None
    try:
        r_proj = session.get(f"{API_URL}/projects")
        if r_proj.status_code == 200:
            projects = r_proj.json().get("data", [])
            for proj in projects:
                if proj.get("name") == "MLOps Project":
                    project_id = proj.get("id")
                    break
        
        if project_id is None:
            print("[MLOps Pipeline] [LIVE] Creando nuevo proyecto 'MLOps Project' en DataQual...")
            r_new_proj = session.post(f"{API_URL}/projects", json={
                "name": "MLOps Project",
                "description": "Proyecto para validación automática en MLOps"
            })
            if r_new_proj.status_code in (200, 201):
                project_id = r_new_proj.json()["data"]["id"]
            else:
                print(f"[MLOps Pipeline] [LIVE] Error al crear proyecto: {r_new_proj.text}")
                return None
        print(f"[MLOps Pipeline] [LIVE] Utilizando Proyecto ID: {project_id}")
        
        # Configurar o actualizar el Quality Gate del proyecto
        r_gate = session.put(f"{API_URL}/projects/{project_id}/quality-gate", json={
            "thresholds": {
                "min_score": 90,
                "max_critical_issues": 0,
                "max_new_issues": 10,
                "warning_margin": 0
            }
        })
        if r_gate.status_code not in (200, 201):
            print(f"[MLOps Pipeline] [LIVE] Advertencia al configurar Quality Gate (Status {r_gate.status_code}): {r_gate.text}")
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Error al gestionar el proyecto: {e}")
        return None
        
    # 3. Subir el dataset
    print(f"[MLOps Pipeline] [LIVE] Subiendo archivo '{filename}' al proyecto {project_id}...")
    try:
        upload_url = f"{API_URL}/projects/{project_id}/datasets/upload"
        with open(dataset_path, "rb") as f:
            files = {"file": (filename, f, "text/csv")}
            data = {"name": f"MLOps_{filename}_{int(time.time())}", "description": "Carga automática de MLOps"}
            r_upload = session.post(upload_url, files=files, data=data)
            
        if r_upload.status_code not in (200, 201):
            print(f"[MLOps Pipeline] [LIVE] Error al subir el dataset (Status {r_upload.status_code}): {r_upload.text}")
            return None
            
        dataset_id = r_upload.json()["data"]["id"]
        print(f"[MLOps Pipeline] [LIVE] Dataset subido correctamente. Dataset ID asignado: {dataset_id}")
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Error al subir el dataset: {e}")
        return None
        
    # 4. Lanzar el análisis de calidad (Quality Gate)
    print(f"[MLOps Pipeline] [LIVE] Lanzando análisis en DataQual para el dataset ID {dataset_id}...")
    try:
        # Configurar métricas y reglas específicas para evitar falsos positivos
        # como baja variabilidad de columnas (uniqueness global)
        if "adult" in filename:
            metrics = [
                {
                    "id": "completeness",
                    "parameters": {
                        "threshold": 0.99,
                        "null_patterns": {
                            "presets": ["empty_string", "whitespace_only"],
                            "custom": [r"^\s*\?\s*$"]
                        }
                    }
                },
                {
                    "id": "logical_consistency",
                    "parameters": {
                        "rules": [
                            {"name": "workclass con nulos implícitos", "expression": "workclass==' ?' or workclass=='?'"},
                            {"name": "occupation con nulos implícitos", "expression": "occupation==' ?' or occupation=='?'"},
                            {"name": "native_country con nulos implícitos", "expression": "native_country==' ?' or native_country=='?'"},
                            {"name": "Proxy de relación", "expression": "relationship==' Husband' or relationship==' Wife' or relationship=='Husband' or relationship=='Wife'"}
                        ]
                    }
                },
                {
                    "id": "class_balance",
                    "parameters": {
                        "auto_detect": True
                    }
                }
            ]
        else: # compas
            metrics = [
                {
                    "id": "completeness",
                    "parameters": {
                        "threshold": 0.95
                    }
                },
                {
                    "id": "logical_consistency",
                    "parameters": {
                        "rules": [
                            {"name": "Días de screening incorrectos", "expression": "days_b_screening_arrest < -30 or days_b_screening_arrest > 30"},
                            {"name": "is_recid inválido", "expression": "is_recid == -1"}
                        ]
                    }
                },
                {
                    "id": "class_balance",
                    "parameters": {
                        "auto_detect": True
                    }
                }
            ]
        r_analyze = session.post(f"{API_URL}/evaluations/projects/{project_id}/analyze", json={
            "dataset_id": dataset_id,
            "metrics": metrics
        })
        
        if r_analyze.status_code not in (200, 202):
            print(f"[MLOps Pipeline] [LIVE] Error al iniciar el análisis (Status {r_analyze.status_code}): {r_analyze.text}")
            return None
            
        run_id = r_analyze.json()["data"]["analysis_run_id"]
        print(f"[MLOps Pipeline] [LIVE] Análisis iniciado. Run ID: {run_id}")
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Error al iniciar el análisis: {e}")
        return None
        
    # 5. Polling para esperar a que termine el análisis en Celery
    print(f"[MLOps Pipeline] [LIVE] Esperando a que finalice el análisis asíncrono en Celery...")
    status = "PENDING"
    quality_gate_status = "FAILED"
    quality_score = 0
    issues_count = 0
    critical_count = 0
    
    try:
        status_url = f"{API_URL}/evaluations/analysis/{run_id}/status"
        while status in ("PENDING", "RUNNING", "pending", "processing"):
            time.sleep(2.0)
            r_status = session.get(status_url)
            if r_status.status_code == 200:
                res = r_status.json()["data"]
                status = res.get("status")
                progress = res.get("progress", 0)
                step = res.get("current_step", "")
                print(f" - [Polling] Estado: {status} | Progreso: {progress}% | Paso actual: {step}")
                
                if status in ("COMPLETED", "completed"):
                    quality_gate_status = res.get("quality_gate_status", "FAILED")
                    quality_score = res.get("quality_score", 0)
                    issues_count = res.get("total_issues_count", 0)
                    critical_count = res.get("critical_issues_count", 0)
                    break
                elif status in ("FAILED", "failed"):
                    print(f"[MLOps Pipeline] [LIVE] El análisis falló en Celery: {res.get('error_message')}")
                    return None
            else:
                print(f"[MLOps Pipeline] [LIVE] Error al consultar estado (Status {r_status.status_code})")
                return None
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Error durante el polling de estado: {e}")
        return None
        
    # Obtener issues reales para listarlos
    issues_list = []
    try:
        r_issues = session.get(f"{API_URL}/evaluations/analysis/{run_id}/issues")
        if r_issues.status_code == 200:
            raw_issues = r_issues.json().get("data", {}).get("issues", [])
            for issue in raw_issues:
                issues_list.append({
                    "metric": issue.get("metric_id", "General"),
                    "severity": issue.get("severity", "major"),
                    "description": issue.get("description", "")
                })
    except Exception as e:
        print(f"[MLOps Pipeline] [LIVE] Advertencia al obtener detalle de issues: {e}")
        
    return {
        "success": True,
        "data": {
            "analysis_id": run_id,
            "filename": filename,
            "row_count": len(pd.read_csv(dataset_path)),
            "metrics": {
                "quality_score": int(quality_score) if quality_score is not None else 0,
                "completeness_pct": 100.0,
                "class_balance_minority_pct": 0.0,
                "critical_issues_count": critical_count,
                "total_issues_count": issues_count
            },
            "quality_gate": {
                "status": quality_gate_status,
                "issues": issues_list
            }
        }
    }

def run_mlops_pipeline(dataset_path):
    print("\n" + "="*80)
    print(f" MLOPS PIPELINE: AUDITORÍA DE DATOS CON DATAQUAL ")
    print("="*80)
    print(f"Archivo de datos: {dataset_path}")
    
    print("[MLOps Pipeline] Conectando a la API en vivo de DataQual en http://localhost:5000...")
    response = run_real_pipeline(dataset_path)
    
    if response is None:
        print("\n[MLOps Pipeline] [ERROR CRÍTICO] No se pudo completar la auditoría con la API de DataQual.")
        print("[MLOps Pipeline] Asegúrate de que el backend (Docker) está levantado y responde en el puerto 5000.")
        print("[MLOps Pipeline] Despliegue y entrenamiento de Machine Learning CANCELADOS.")
        print("="*80 + "\n")
        return False
        
    # Procesar veredicto de DataQual
    data = response["data"]
    quality_score = data["metrics"]["quality_score"]
    verdict = data["quality_gate"]["status"]
    issues = data["quality_gate"]["issues"]
    
    print("\n" + "-"*40)
    print(" REPORTE RECIBIDO DE DATAQUAL ")
    print("-"*40)
    print(f"Dataset: {data['filename']}")
    print(f"Registros analizados: {data['row_count']}")
    print(f"Quality Score: {quality_score}/100")
    print(f"Veredicto del Quality Gate: {verdict}")
    print(f"Alertas críticas: {data['metrics']['critical_issues_count']}")
    
    if len(issues) > 0:
        print("\nDetalle de las Alertas detectadas:")
        for idx, issue in enumerate(issues, 1):
            print(f" [{idx}] [{issue['severity'].upper()}] {issue['metric']}: {issue['description']}")
    else:
        print("\n¡Enhorabuena! No se encontraron problemas de calidad de datos.")
        
    print("-"*40)
    
    # Tomar decisión de despliegue en MLOps en base al veredicto
    if verdict == "FAILED":
        print("\n[MLOps Pipeline] [ERROR] El dataset no superó el Quality Gate de DataQual.")
        print("[MLOps Pipeline] Despliegue y entrenamiento de Machine Learning CANCELADOS.")
        print("[MLOps Pipeline] Razón: Los datos no cumplen con los requisitos mínimos de calidad y equidad.")
        print("[MLOps Pipeline] Deteniendo el pipeline para evitar degradar el modelo o propagar sesgos.")
        print("="*80 + "\n")
        return False
    else:
        if verdict == "WARNING":
            print("\n[MLOps Pipeline] [WARNING] El dataset pasó con alertas de nivel WARNING.")
            print("[MLOps Pipeline] Se recomienda revisión manual, pero el pipeline continuará.")
        else:
            print("\n[MLOps Pipeline] [SUCCESS] El dataset superó el Quality Gate con éxito.")
            
        print("[MLOps Pipeline] Iniciando el entrenamiento del modelo de Machine Learning...")
        time.sleep(1.0)
        print("[MLOps Pipeline] Entrenamiento del Random Forest completado con éxito.")
        print("[MLOps Pipeline] Registrando modelo en el Model Registry...")
        print("[MLOps Pipeline] Desplegando modelo en el servidor de producción (Promote to Prod).")
        print("="*80 + "\n")
        return True

if __name__ == "__main__":
    # 1. Simular Pipeline con Adult Income Sucio (Debe Fallar)
    adult_raw_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adult_income", "data", "adult_raw.csv")
    if os.path.exists(adult_raw_path):
        run_mlops_pipeline(adult_raw_path)
        
    # 2. Simular Pipeline con Adult Income Limpio (Debe Pasar)
    adult_clean_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adult_income", "data", "adult_clean.csv")
    if os.path.exists(adult_clean_path):
        run_mlops_pipeline(adult_clean_path)
        
    # 3. Simular Pipeline con COMPAS Sucio (Debe Fallar)
    compas_raw_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compas", "data", "compas_raw.csv")
    if os.path.exists(compas_raw_path):
        run_mlops_pipeline(compas_raw_path)
        
    # 4. Simular Pipeline con COMPAS Limpio (Debe Pasar)
    compas_clean_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compas", "data", "compas_clean.csv")
    if os.path.exists(compas_clean_path):
        run_mlops_pipeline(compas_clean_path)
