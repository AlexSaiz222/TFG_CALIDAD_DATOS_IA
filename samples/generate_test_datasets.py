#!/usr/bin/env python3
"""
Script para generar 3 versiones de un dataset de prueba con diferentes niveles de calidad.

Versión 1 (DESASTRE):  ~35% quality score → Quality Gate: FAILED
Versión 2 (MEJORADO):  ~65% quality score → Quality Gate: WARNING
Versión 3 (LIMPIO):    ~92% quality score → Quality Gate: PASSED

Columnas del dataset:
  id, nombre, email, telefono, departamento, ciudad, salario,
  fecha_contratacion, dni, codigo_postal, nivel_experiencia, fecha_actualizacion

Métricas cubiertas por este dataset:
  - completeness:         nulos en nombre, email, telefono, ciudad, dni, codigo_postal
  - uniqueness:           filas duplicadas y unicidad de 'id' y 'dni'
  - outliers:             valores extremos en 'salario'
  - syntactic_accuracy:   email, phone_es, dni_es, postal_code_es, date_iso
  - logical_consistency:  salario > 0, Lead → salario >= 50000, salario <= 300000
  - class_balance:        distribución de 'departamento' y 'nivel_experiencia'
  - timeliness:           frescura de 'fecha_actualizacion' (threshold = 365 días)

Uso:
    python samples/generate_test_datasets.py

Los archivos se generan en la carpeta samples/ junto a este script.
Lee samples/configuracion_metricas_prueba.md para la configuración exacta de cada métrica.
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

NIVELES_EXPERIENCIA = ["Junior", "Senior", "Lead"]

# Rango salarial coherente con el nivel de experiencia
NIVEL_SALARIO = {
    "Junior": (22000, 35000),
    "Senior": (35000, 60000),
    "Lead":   (55000, 85000),
}

EMAILS_VALIDOS = [
    f"{n.split()[0].lower()}.{n.split()[1].lower()}@empresa.com"
    for n in NOMBRES
]

def limpiar_email(email: str) -> str:
    reemplazos = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n", "ü": "u"}
    for k, v in reemplazos.items():
        email = email.replace(k, v)
    return email

EMAILS_VALIDOS = [limpiar_email(e) for e in EMAILS_VALIDOS]

# ─────────────────────────────────────────────────────────────
# Generadores de datos específicos
# ─────────────────────────────────────────────────────────────
LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE"

def generar_dni(numero: int) -> str:
    """Genera un DNI español válido (8 dígitos + letra de control)."""
    letra = LETRAS_DNI[numero % 23]
    return f"{numero:08d}{letra}"

# Pre-generar 300 DNIs únicos válidos
_numeros_dni = random.sample(range(10000000, 90000000), 300)
DNIS_VALIDOS = [generar_dni(n) for n in _numeros_dni]


def generar_codigo_postal() -> str:
    """Genera un código postal español válido (5 dígitos, prefijo 01-52)."""
    return f"{random.randint(1, 52):02d}{random.randint(0, 999):03d}"


def fecha_aleatoria(start_year: int = 2022, end_year: int = 2025) -> str:
    """Genera una fecha ISO aleatoria entre start_year y end_year."""
    start = datetime(start_year, 1, 1)
    end   = datetime(end_year, 12, 31)
    return (start + timedelta(days=random.randint(0, (end - start).days))).strftime("%Y-%m-%d")


def fecha_actualizacion(days_back_min: int = 0, days_back_max: int = 30) -> str:
    """Genera una fecha de actualización a N días atrás desde el 2026-03-31 (fecha fija de prueba)."""
    hoy = datetime(2026, 3, 31)
    delta = random.randint(days_back_min, days_back_max)
    return (hoy - timedelta(days=delta)).strftime("%Y-%m-%d")


def telefono_valido() -> str:
    """Genera un teléfono español válido sin espacios (6XXXXXXXX), compatible con phone_es."""
    return f"6{random.randint(10000000, 99999999)}"


def salario_por_nivel(nivel: str) -> int:
    """Genera un salario coherente con el nivel de experiencia."""
    lo, hi = NIVEL_SALARIO[nivel]
    return random.randint(lo, hi)


HEADER = [
    "id", "nombre", "email", "telefono", "departamento", "ciudad",
    "salario", "fecha_contratacion", "dni", "codigo_postal",
    "nivel_experiencia", "fecha_actualizacion",
]

NUM_ROWS = 200


# ─────────────────────────────────────────────────────────────
# VERSIÓN 1: DESASTRE (~35% quality score → FAILED)
# ─────────────────────────────────────────────────────────────
def generar_v1_desastre() -> list[list]:
    """Dataset con MUCHOS errores que activan todas las métricas."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre    = NOMBRES[(i - 1) % len(NOMBRES)]
        email     = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono  = telefono_valido()
        depto     = random.choice(DEPARTAMENTOS)
        ciudad    = random.choice(CIUDADES)
        dni       = DNIS_VALIDOS[(i - 1) % len(DNIS_VALIDOS)]
        cp        = generar_codigo_postal()
        # Distribución muy desbalanceada: 80% Junior, 15% Senior, 5% Lead
        nivel     = random.choices(NIVELES_EXPERIENCIA, weights=[80, 15, 5])[0]
        salario   = salario_por_nivel(nivel)
        fecha_con = fecha_aleatoria(2022, 2025)
        # Fecha de actualización muy antigua (2020-2022) → timeliness crítica
        fecha_act = fecha_aleatoria(2020, 2022)

        # ── completeness: nulos masivos ──
        if random.random() < 0.30:
            email = random.choice(["", "sin-arroba", "@@doble.com", "  ", "noesuncorreo"])
        if random.random() < 0.25:
            telefono = random.choice(["", "123", "teléfono", "000-000-000"])
        if random.random() < 0.20:
            nombre = ""
        if random.random() < 0.15:
            ciudad = ""
        if random.random() < 0.20:
            dni = random.choice(["", "12345678", "ABCDEFGH1", "00000000A", "123-456-78X"])
        if random.random() < 0.15:
            cp = random.choice(["", "ABCDE", "123", "999999"])

        # ── outliers: salarios extremos ──
        if random.random() < 0.20:
            salario = random.choice([-5000, -999, 0, 1500000, 2000000, 999999999])

        # ── syntactic_accuracy: fechas de contratación inválidas ──
        if random.random() < 0.15:
            fecha_con = random.choice(["no-es-fecha", "31/13/2025", "2099-99-99", "", "ayer"])

        # ── class_balance: typos en departamento ──
        if random.random() < 0.10:
            depto = random.choice(["", "Vntas", "MKT", "ingenieria "])

        # ── logical_consistency: Leads con salario bajo (viola Lead → salario >= 50000) ──
        if nivel == "Lead" and random.random() < 0.60:
            salario = random.randint(20000, 45000)

        rows.append([i, nombre, email, telefono, depto, ciudad, salario,
                     fecha_con, dni, cp, nivel, fecha_act])

    # ── uniqueness: 5 filas duplicadas exactas ──
    for dup_idx in [2, 7, 15, 30, 50]:
        rows.append(rows[dup_idx - 1].copy())

    # ── completeness: 3 filas fantasma (todos vacíos) ──
    for j in range(NUM_ROWS + 6, NUM_ROWS + 9):
        rows.append([j, "", "", "", "", "", "", "", "", "", "", ""])

    return rows


# ─────────────────────────────────────────────────────────────
# VERSIÓN 2: MEJORADO (~65% quality score → WARNING)
# ─────────────────────────────────────────────────────────────
def generar_v2_mejorado() -> list[list]:
    """Dataset con ALGUNOS errores de calidad (mejora respecto a v1)."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre    = NOMBRES[(i - 1) % len(NOMBRES)]
        email     = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono  = telefono_valido()
        depto     = random.choice(DEPARTAMENTOS)
        ciudad    = random.choice(CIUDADES)
        dni       = DNIS_VALIDOS[(i - 1) % len(DNIS_VALIDOS)]
        cp        = generar_codigo_postal()
        # Distribución moderadamente desbalanceada: 50% Junior, 35% Senior, 15% Lead
        nivel     = random.choices(NIVELES_EXPERIENCIA, weights=[50, 35, 15])[0]
        salario   = salario_por_nivel(nivel)
        fecha_con = fecha_aleatoria(2022, 2025)
        # Fecha de actualización de 2024 (~365-730 días atrás) → parcialmente obsoleta
        fecha_act = fecha_aleatoria(2024, 2024)

        # ── completeness: errores moderados ──
        if random.random() < 0.10:
            email = random.choice(["", "correo-invalido"])
        if random.random() < 0.10:
            telefono = ""
        if random.random() < 0.05:
            nombre = ""
        if random.random() < 0.10:
            dni = random.choice(["", "12345678", "ABCDE"])
        if random.random() < 0.08:
            cp = random.choice(["", "ABCDE"])

        # ── outliers: algunos salarios anómalos ──
        if random.random() < 0.08:
            salario = random.choice([-1000, 0, 200000])

        # ── syntactic_accuracy: pocas fechas inválidas ──
        if random.random() < 0.05:
            fecha_con = random.choice(["no-es-fecha", ""])

        # ── logical_consistency: algunos Leads con salario bajo ──
        if nivel == "Lead" and random.random() < 0.20:
            salario = random.randint(35000, 49000)

        rows.append([i, nombre, email, telefono, depto, ciudad, salario,
                     fecha_con, dni, cp, nivel, fecha_act])

    # ── uniqueness: 1 fila duplicada ──
    rows.append(rows[4].copy())

    return rows


# ─────────────────────────────────────────────────────────────
# VERSIÓN 3: LIMPIO (~92% quality score → PASSED)
# ─────────────────────────────────────────────────────────────
def generar_v3_limpio() -> list[list]:
    """Dataset LIMPIO con datos consistentes y válidos."""
    rows = []
    for i in range(1, NUM_ROWS + 1):
        nombre    = NOMBRES[(i - 1) % len(NOMBRES)]
        email     = EMAILS_VALIDOS[(i - 1) % len(EMAILS_VALIDOS)]
        telefono  = telefono_valido()
        depto     = random.choice(DEPARTAMENTOS)
        ciudad    = random.choice(CIUDADES)
        dni       = DNIS_VALIDOS[(i - 1) % len(DNIS_VALIDOS)]
        cp        = generar_codigo_postal()
        # Distribución balanceada: ~33% cada nivel
        nivel     = random.choices(NIVELES_EXPERIENCIA, weights=[34, 34, 32])[0]
        salario   = salario_por_nivel(nivel)
        fecha_con = fecha_aleatoria(2022, 2025)
        # Fecha de actualización reciente (últimos 30 días de marzo 2026) → timeliness fresca
        fecha_act = fecha_actualizacion(0, 30)

        # Dos nulos menores para que el score no sea un 100% perfecto
        if i == 12:
            telefono = ""
        if i == 25:
            email = ""

        rows.append([i, nombre, email, telefono, depto, ciudad, salario,
                     fecha_con, dni, cp, nivel, fecha_act])

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
    print(f"  OK {filename} -> {len(rows)} filas")
    return filepath


def main():
    print("=" * 60)
    print("Generador de Datasets de Prueba para DataQual")
    print("=" * 60)
    print()
    print("Directorio de salida:", OUTPUT_DIR)
    print()

    print("[ROJO]    Generando v1 (DESASTRE - muchos errores)...")
    v1 = generar_v1_desastre()
    escribir_csv("clientes_v1_desastre.csv", v1)
    print()

    print("[AMARILLO] Generando v2 (MEJORADO - algunos errores)...")
    v2 = generar_v2_mejorado()
    escribir_csv("clientes_v2_mejorado.csv", v2)
    print()

    print("[VERDE]   Generando v3 (LIMPIO - datos de calidad)...")
    v3 = generar_v3_limpio()
    escribir_csv("clientes_v3_limpio.csv", v3)
    print()

    print("=" * 60)
    print("Datasets generados con exito!")
    print()
    print("Columnas del dataset:")
    print("  " + ", ".join(HEADER))
    print()
    print("Metricas cubiertas:")
    print("  completeness, uniqueness, outliers, syntactic_accuracy,")
    print("  logical_consistency, class_balance, timeliness")
    print()
    print("Proximos pasos:")
    print("  1. Lee samples/configuracion_metricas_prueba.md para la")
    print("     configuracion exacta de cada metrica y sus umbrales.")
    print("  2. Crea un proyecto de prueba en DataQual (http://localhost:3000)")
    print("  3. Configura el Quality Gate (min_score: 80%)")
    print("  4. Sube clientes_v1_desastre.csv -> veras FAILED")
    print("  5. Sube v2 como nueva version -> veras WARNING")
    print("  6. Sube v3 como nueva version -> veras PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
