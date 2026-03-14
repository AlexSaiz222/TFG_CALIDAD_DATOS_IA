#!/usr/bin/env python3
"""
Script para generar 3 versiones de un dataset de prueba con diferentes niveles de calidad.

Versión 1 (DESASTRE):  ~35% quality score → Quality Gate: FAILED
Versión 2 (MEJORADO):  ~65% quality score → Quality Gate: WARNING
Versión 3 (LIMPIO):    ~92% quality score → Quality Gate: PASSED

Uso:
    python samples/generate_test_datasets.py

Los archivos se generan en la carpeta samples/ junto a este script.
"""

import csv
import os
import random
from datetime import datetime, timedelta

# Semilla para reproducibilidad
random.seed(42)

# Directorio de salida (junto al script)
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────
# Datos base realistas
# ─────────────────────────────────────────────────────────────
NOMBRES = [
    "María García", "Carlos López", "Ana Martínez", "Pedro Sánchez",
    "Laura Fernández", "Miguel Torres", "Carmen Ruiz", "David Moreno",
    "Lucía Jiménez", "Javier Hernández", "Elena Díaz", "Roberto Muñoz",
    "Isabel Álvarez", "Francisco Romero", "Patricia Navarro", "Andrés Gil",
    "Sofía Molina", "Diego Ortega", "Raquel Serrano", "Pablo Domínguez",
    "Cristina Vázquez", "Manuel Ramos", "Teresa Castro", "Sergio Blanco",
    "Marta Morales", "Alejandro Guerrero", "Rosa Suárez", "Daniel Méndez",
    "Natalia Cortés", "Héctor Iglesias",
]

CIUDADES = [
    "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza",
    "Málaga", "Bilbao", "Alicante", "Córdoba", "Granada",
]

DEPARTAMENTOS = ["Ventas", "Marketing", "Ingeniería", "RRHH", "Finanzas", "Soporte", "Logística"]

EMAILS_VALIDOS = [
    f"{n.split()[0].lower()}.{n.split()[1].lower()}@empresa.com"
    for n in NOMBRES
]

# Corregir caracteres especiales en emails
def limpiar_email(email: str) -> str:
    reemplazos = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "ñ": "n", "ü": "u",
    }
    for k, v in reemplazos.items():
        email = email.replace(k, v)
    return email

EMAILS_VALIDOS = [limpiar_email(e) for e in EMAILS_VALIDOS]


def fecha_aleatoria(start_year=2022, end_year=2025) -> str:
    """Genera una fecha ISO aleatoria entre start_year y end_year."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).strftime("%Y-%m-%d")


def telefono_valido() -> str:
    """Genera un teléfono español válido (6XX XXX XXX)."""
    return f"6{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}"


def salario_normal() -> int:
    """Genera un salario razonable (22k-85k)."""
    return random.randint(22000, 85000)


HEADER = ["id", "nombre", "email", "telefono", "departamento", "ciudad", "salario", "fecha_contratacion"]
NUM_ROWS = 30

# ─────────────────────────────────────────────────────────────
# VERSIÓN 1: DESASTRE (~35% quality score → FAILED)
# ─────────────────────────────────────────────────────────────
def generar_v1_desastre() -> list[list]:
    """Genera un dataset con MUCHOS errores de calidad."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre = NOMBRES[(i - 1) % len(NOMBRES)]
        email = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono = telefono_valido()
        depto = random.choice(DEPARTAMENTOS)
        ciudad = random.choice(CIUDADES)
        salario = salario_normal()
        fecha = fecha_aleatoria()

        # ── Introducir errores masivos ──

        # 30% emails vacíos o inválidos
        if random.random() < 0.30:
            email = random.choice(["", "sin-arroba", "@@doble.com", "  ", "noesuncorreo"])

        # 25% teléfonos nulos o con formato roto
        if random.random() < 0.25:
            telefono = random.choice(["", "123", "teléfono", "000-000-000", None])

        # 20% nombres vacíos
        if random.random() < 0.20:
            nombre = ""

        # 15% ciudades vacías
        if random.random() < 0.15:
            ciudad = ""

        # 20% salarios con outliers extremos
        if random.random() < 0.20:
            salario = random.choice([-5000, -999, 0, 1500000, 2000000, 999999999])

        # 15% fechas inválidas
        if random.random() < 0.15:
            fecha = random.choice(["no-es-fecha", "31/13/2025", "2099-99-99", "", "ayer"])

        # 10% departamentos vacíos o con typos
        if random.random() < 0.10:
            depto = random.choice(["", "Vntas", "MKT", "ingenieria "])

        rows.append([i, nombre, email, telefono or "", depto, ciudad, salario, fecha])

    # Añadir 3 filas duplicadas exactas (copias de filas existentes)
    for dup_idx in [2, 7, 15]:
        rows.append(rows[dup_idx - 1].copy())  # Duplicado EXACTO

    # Añadir 2 filas más con todos los campos vacíos (filas fantasma)
    rows.append([31, "", "", "", "", "", "", ""])
    rows.append([32, "", "", "", "", "", "", ""])

    return rows


# ─────────────────────────────────────────────────────────────
# VERSIÓN 2: MEJORADO (~65% quality score → WARNING)
# ─────────────────────────────────────────────────────────────
def generar_v2_mejorado() -> list[list]:
    """Genera un dataset con ALGUNOS errores de calidad (mejora respecto a v1)."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre = NOMBRES[(i - 1) % len(NOMBRES)]
        email = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono = telefono_valido()
        depto = random.choice(DEPARTAMENTOS)
        ciudad = random.choice(CIUDADES)
        salario = salario_normal()
        fecha = fecha_aleatoria()

        # ── Errores moderados ──

        # 10% emails vacíos (bajado de 30%)
        if random.random() < 0.10:
            email = random.choice(["", "correo-invalido"])

        # 10% teléfonos vacíos (bajado de 25%)
        if random.random() < 0.10:
            telefono = ""

        # 5% nombres vacíos (bajado de 20%)
        if random.random() < 0.05:
            nombre = ""

        # Ciudades: ya no hay vacías → CORREGIDO

        # 8% salarios con outliers (bajado de 20%, menos extremos)
        if random.random() < 0.08:
            salario = random.choice([-1000, 0, 200000])

        # 5% fechas inválidas (bajado de 15%)
        if random.random() < 0.05:
            fecha = random.choice(["no-es-fecha", ""])

        rows.append([i, nombre, email, telefono, depto, ciudad, salario, fecha])

    # Solo 1 fila duplicada (bajado de 3)
    rows.append(rows[4].copy())

    return rows


# ─────────────────────────────────────────────────────────────
# VERSIÓN 3: LIMPIO (~92% quality score → PASSED)
# ─────────────────────────────────────────────────────────────
def generar_v3_limpio() -> list[list]:
    """Genera un dataset LIMPIO con datos consistentes y válidos."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre = NOMBRES[(i - 1) % len(NOMBRES)]
        email = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono = telefono_valido()
        depto = random.choice(DEPARTAMENTOS)
        ciudad = random.choice(CIUDADES)
        salario = salario_normal()
        fecha = fecha_aleatoria()

        # Sin errores intencionados. Solo un par de nulos menores
        # para que el score no sea un 100% perfecto (más realista).
        if i == 12:
            telefono = ""  # Un único teléfono vacío (menor)
        if i == 25:
            email = ""     # Un único email vacío (menor)

        rows.append([i, nombre, email, telefono, depto, ciudad, salario, fecha])

    # Sin duplicados
    return rows


# ─────────────────────────────────────────────────────────────
# Escritura de archivos CSV
# ─────────────────────────────────────────────────────────────
def escribir_csv(filename: str, rows: list[list]):
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(HEADER)
        writer.writerows(rows)
    print(f"  ✅ {filename} → {len(rows)} filas")
    return filepath


def main():
    print("=" * 60)
    print("🧪 Generador de Datasets de Prueba para DataQual")
    print("=" * 60)
    print()

    print("📁 Directorio de salida:", OUTPUT_DIR)
    print()

    # Versión 1
    print("🔴 Generando v1 (DESASTRE - muchos errores)...")
    v1 = generar_v1_desastre()
    escribir_csv("clientes_v1_desastre.csv", v1)

    print()

    # Versión 2
    print("🟡 Generando v2 (MEJORADO - algunos errores)...")
    v2 = generar_v2_mejorado()
    escribir_csv("clientes_v2_mejorado.csv", v2)

    print()

    # Versión 3
    print("🟢 Generando v3 (LIMPIO - datos de calidad)...")
    v3 = generar_v3_limpio()
    escribir_csv("clientes_v3_limpio.csv", v3)

    print()
    print("=" * 60)
    print("✨ ¡Datasets generados con éxito!")
    print()
    print("Próximos pasos:")
    print("  1. Accede a DataQual (http://localhost:3000)")
    print("  2. Crea un proyecto de prueba")
    print("  3. Configura el Quality Gate (min_score: 80%)")
    print("  4. Sube clientes_v1_desastre.csv → verás FAILED")
    print("  5. Sube v2 como nueva versión → verás WARNING")
    print("  6. Sube v3 como nueva versión → verás PASSED ✅")
    print("=" * 60)


if __name__ == "__main__":
    main()
