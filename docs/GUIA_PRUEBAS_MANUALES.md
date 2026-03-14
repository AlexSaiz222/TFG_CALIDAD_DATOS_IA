# Guía de Pruebas Manuales (Workflow del Usuario)

Este documento describe paso a paso el flujo de trabajo completo que un usuario puede realizar en la plataforma **DataQual** para probar que todos los módulos integrados funcionan correctamente. Incluye un **tutorial práctico con ejemplo concreto** usando datasets generados automáticamente.

---

## 🧪 Parte 0: Tutorial Práctico con Ejemplo (Paso a Paso)

Este tutorial utiliza 3 versiones de un dataset de clientes, cada una con un nivel de calidad diferente, para demostrar todo el flujo de la plataforma: desde la configuración del Quality Gate hasta la comparación entre versiones.

### Requisitos previos

- La plataforma DataQual debe estar corriendo localmente (`docker-compose up` o similar).
- Python 3 instalado en tu máquina.

---

### Paso 0: Generar los datasets de prueba

Ejecuta el script generador desde la raíz del proyecto:

```bash
python samples/generate_test_datasets.py
```

Esto creará 3 archivos en la carpeta `samples/`:

| Archivo | Calidad | Quality Gate esperado |
|---------|---------|----------------------|
| `clientes_v1_desastre.csv` | 🔴 Muy mala (~35%) | ❌ **FAILED** |
| `clientes_v2_mejorado.csv` | 🟡 Media (~65%) | ⚠️ **WARNING** |
| `clientes_v3_limpio.csv` | 🟢 Buena (~92%) | ✅ **PASSED** |

**¿Qué errores tiene cada versión?**

- **v1 (desastre):** ~30% emails vacíos/inválidos, ~25% teléfonos nulos, ~20% nombres vacíos, salarios con outliers extremos (negativos, >1M€), fechas inválidas, 3 filas duplicadas, 2 filas completamente vacías.
- **v2 (mejorado):** Se corrigen la mayoría de los nulos y formatos. Quedan ~10% emails vacíos, algunos salarios fuera de rango, 1 fila duplicada.
- **v3 (limpio):** Todos los campos correctos y consistentes. Solo 2 valores vacíos menores (1 teléfono y 1 email). Sin duplicados.

---

### Paso 1: Registro e inicio de sesión

1. Abre tu navegador y ve a `http://localhost:3000`.
2. Si no tienes cuenta, regístrate en `/register` con un usuario nuevo.
3. Inicia sesión en `/login`. Se generará un JWT y accederás al Dashboard.

---

### Paso 2: Crear un proyecto de prueba

1. Ve a la pestaña **Projects** en la navegación lateral.
2. Haz clic en **"Nuevo Proyecto"**.
3. Rellena:
   - **Nombre:** `Prueba Manual - Clientes`
   - **Descripción:** `Prueba del flujo completo con 3 versiones de dataset`
4. Haz clic en **Crear**.

---

### Paso 3: Configurar el Quality Gate (Umbrales exigentes)

> 💡 **¿Qué es el Quality Gate?** Es un conjunto de umbrales que determinan si un dataset APRUEBA o SUSPENDE la evaluación de calidad.

1. Dentro del proyecto, ve a la pestaña **"Quality Gate"**.
2. Verás los sliders de configuración. **Ajusta los siguientes valores exigentes** para que el v1 falle claramente:

   | Parámetro | Valor recomendado | Significado |
   |-----------|:-----------------:|-------------|
   | **Score mínimo** | `80%` | El score global debe ser ≥80% para aprobar |
   | **Completitud mínima** | `85%` | Al menos 85% de valores no nulos |
   | **Unicidad mínima** | `90%` | Al menos 90% de valores únicos (sin duplicados) |
   | **Máx. issues críticos** | `0` | Cero issues críticos permitidos |
   | **Máx. nuevos issues** | `5` | Máximo 5 nuevos issues permitidos |

3. Haz clic en **"Guardar cambios"**.

> ⚠️ **Importante:** Estos umbrales se guardан en la base de datos asociados a TU proyecto. Cada proyecto puede tener su propia configuración de Quality Gate.

---

### Paso 4: Subir el primer dataset — `v1_desastre` (el Baseline)

1. Dentro del proyecto, ve a la pestaña **"Datasets"**.
2. Haz clic en **"Añadir Dataset"**.
3. Selecciona el archivo `samples/clientes_v1_desastre.csv` y súbelo.
4. Confirma que aparece en la lista con el esquema previsualizado.

---

### Paso 5: Primera evaluación — Resultado esperado: ❌ FAILED

1. Haz clic en el dataset que acabas de subir para ver sus detalles.
2. Haz clic en el botón **"Run Evaluation" / "Analizar"**.
3. Observa la barra de progreso mientras se procesan los datos.
4. Al completarse, deberías ver:

   **Lo que debes verificar:**
   - ❌ **Quality Gate: FAILED** — El badge rojo debe aparecer.
   - 📊 **Quality Score: ~35-40%** — Muy por debajo del umbral del 80%.
   - 🐛 **Issues detectados:**
     - **Completeness:** Múltiples columnas con nulos (email, teléfono, nombre, ciudad).
     - **Uniqueness:** Filas duplicadas detectadas.
     - **Outliers:** Salarios negativos o extremadamente altos.
   - 📋 **Lista de Issues:** Cada issue con su severidad (`critical`, `major`, `minor`), las columnas afectadas y el número de filas implicadas.

> 📸 **Captura mental:** El gauge/medidor de calidad debería estar en rojo, con el veredicto "FAILED" claramente visible.

---

### Paso 6: Subir nueva versión — `v2_mejorado`

1. Vuelve a la vista del dataset (`/datasets/[id]`).
2. Busca el botón **"Subir Nueva Versión"**.
3. Selecciona `samples/clientes_v2_mejorado.csv`.
4. Opcionalmente, añade la etiqueta **"v2 - Mejorado"**.
5. Sube el archivo.
6. En la pestaña **"Versions"** (historial), verás la jerarquía visual:
   ```
   v1 (desastre) ──→ v2 (mejorado)
   ```

---

### Paso 7: Segunda evaluación — Resultado esperado: ⚠️ WARNING

1. Lanza un nuevo **"Run Evaluation"** sobre la versión 2.
2. El backend detectará automáticamente la evaluación anterior como **baseline** y ejecutará la comparación (diff).
3. Al completarse, verifica:

   **Lo que debes verificar:**
   - ⚠️ **Quality Gate: WARNING** — Badge naranja/amarillo.
   - 📊 **Quality Score: ~60-70%** — Mejorado, pero aún por debajo del 80%.
   - 🔄 **Comparación con baseline (diff):**
     - **Issues resueltos (Fixed):** Verás que muchos issues de nulos desaparecieron.
     - **Issues nuevos (New):** Pocos o ninguno nuevo.
     - **Issues recurrentes:** Algunos salarios fuera de rango persisten.
   - 📈 **Trendline:** En el dashboard del proyecto, el gráfico de tendencia debería mostrar una mejora desde v1 a v2.

---

### Paso 8: Subir versión final — `v3_limpio`

1. De nuevo, sube una nueva versión: `samples/clientes_v3_limpio.csv`.
2. Etiqueta: **"v3 - Limpio"**.
3. El historial de versiones mostrará:
   ```
   v1 (desastre) ──→ v2 (mejorado) ──→ v3 (limpio)
   ```

---

### Paso 9: Tercera evaluación — Resultado esperado: ✅ PASSED

1. Ejecuta la evaluación sobre la versión 3.
2. Al completarse, verifica:

   **Lo que debes verificar:**
   - ✅ **Quality Gate: PASSED** — Badge verde.
   - 📊 **Quality Score: ~90-95%** — Muy por encima del umbral del 80%.
   - 🎉 **Issues resueltos masivamente:**
     - Casi todos los issues de v2 aparecen como **"Fixed"**.
     - Muy pocos issues nuevos (quizá 1-2 menores).
   - 📈 **Trendline:** En el dashboard verás la evolución completa:
     ```
     v1: ~35% ──→ v2: ~65% ──→ v3: ~92%  📈
     ```

---

### Paso 10: Experimentar con el Quality Gate

Ahora que tienes 3 evaluaciones, prueba a **cambiar los umbrales** para ver cómo afectan retroactivamente al veredicto:

1. Ve a la pestaña **"Quality Gate"** del proyecto.
2. **Baja el score mínimo de 80% a 50%**.
3. Guarda los cambios.
4. Vuelve a ejecutar la evaluación de la **v2** (la que antes daba WARNING).
5. **Resultado:** Ahora debería dar **PASSED** ✅ porque 65% > 50%.

**Otro experimento:**
1. Sube el **score mínimo a 95%**.
2. Re-evalúa la **v3** (la limpia).
3. **Resultado:** Ahora incluso la v3 podría dar **WARNING** ⚠️ porque el umbral es muy exigente.

> 💡 **Conclusión:** El Quality Gate es configurable por proyecto. Los mismos datos pueden "aprobar" o "suspender" según los umbrales que defina el responsable de calidad.

---

### Tabla resumen del tutorial

| Paso | Acción | v1 (desastre) | v2 (mejorado) | v3 (limpio) |
|:----:|--------|:-------------:|:--------------:|:-----------:|
| 4 | Subir dataset | ✅ | - | - |
| 5 | Evaluar | ❌ FAILED ~35% | - | - |
| 6 | Subir nueva versión | - | ✅ | - |
| 7 | Evaluar + Diff | Baseline | ⚠️ WARNING ~65% | - |
| 8 | Subir nueva versión | - | - | ✅ |
| 9 | Evaluar + Diff | - | Baseline | ✅ PASSED ~92% |
| 10 | Ajustar Quality Gate | Variable | Variable | Variable |

---

## 🟢 Parte 1: Lo que funciona actualmente (Flujo a probar)

### Paso 1: Autenticación y Acceso
1. **Registro:** Accede a la pantalla de registro (`/register`) y crea un usuario nuevo.
2. **Login:** Inicia sesión (`/login`) con las credenciales creadas. Se generará un JWT y accederás al Dashboard principal.

### Paso 2: Creación y Configuración del Proyecto
1. Ve a la pestaña **Projects** y haz clic en "Nuevo Proyecto".
2. Asigna un nombre (Ej. "Análisis de Datos de Clientes") y una descripción.
3. Entra en el detalle del proyecto haciendo clic sobre él en la lista.
4. Explora las pestañas:
   - **Overview:** Resumen del proyecto.
   - **Metrics Config:** Configura los parámetros de las métricas (por defecto: Umbrales de *Completeness* y *Uniqueness*).
   - **Quality Gate:** Define los umbrales para pasar o fallar las evaluaciones de calidad de este proyecto entero (Ej. `Min Score: 80%`).

### Paso 3: Subida del Dataset (Primera Versión)
1. En el proyecto, ve a la pestaña **Datasets** y haz clic en "Añadir Dataset".
2. Selecciona un archivo CSV (Ej. uno con algunos valores nulos o datos problemáticos a propósito) y súbelo.
3. Revisa la previsualización de esquema en la tabla de Datasets.

### Paso 4: Primera Evaluación de Calidad (El Baseline)
1. Haz clic en el nombre del dataset subido para ir a sus detalles (`/datasets/[id]`).
2. Haz clic en el botón prominente **"Run Evaluation"** o "Analizar".
3. Observa la barra de progreso mientras Celery y Pandas procesan los datos en el backend.
4. Al finalizar:
   - El estado pasará a `COMPLETED`.
   - Se evaluará el **Quality Gate** contra los umbrales de tu Proyecto. Verás si el análisis indica `PASSED`, `WARNING` o `FAILED`.
   - Entra en los detalles de la evaluación (haciendo clic en la tabla de la pestaña "Evaluations").
   - **Revisa la página de detalles:** El gauge (medidor) del Quality Score, el componente visual de métricas, y la lista detallada de **Issues** encontrados en esta versión.

### Paso 5: Evolución y Versionado del Dataset
1. Corrige el archivo CSV original en tu ordenador (elimina nulos, arregla duplicados) o añade nuevos errores introduciendo datos sucios.
2. Vuelve a la vista del dataset en la plataforma (`/datasets/[id]`).
3. Busca el botón de **"Subir Nueva Versión"**.
4. Sube tu CSV modificado. Puedes añadir una etiqueta ("Corregido", "v2").
5. En la pestaña de historial ("Versions"), verás la jerarquía visual conectando la versión original y la nueva.

### Paso 6: Análisis de la Nueva Versión y Comparación
1. Lanza de nuevo un **"Run Evaluation"** sobre la nueva versión subida (v2).
2. Se generará un nuevo `AnalysisRun`. El backend buscará automáticamente el análisis anterior (`baseline`) y ejecutará la lógica de comparación.
3. En el detalle del proyecto o del dataset revisa las métricas:
   - Los **Nuevos Issues** que antes no estaban.
   - Los **Issues Resueltos** (Fixed) que arreglaste en el CSV.
   - Cómo ha cambiado la puntuación de calidad (Score) en el gráfico trendline del dashboard principal del proyecto.
4. Además, puedes ir a la vista específica de "Comparar" (si está habilitada en la UI / URL de comparación) para poner versiones lado a lado.

---

## 🚀 Parte 2: Lo que funcionará en el futuro (Prioridades faltantes)

Lo descrito arriba es el corazón (Core) funcional de la herramienta. Una vez valides que esos puntos funcionan anualmente, las prioridades de desarrollo pendientes de abordar (según tu ROADMAP) son:

### 1. Más métricas de calidad (ALTA Prioridad)
Actualmente el motor revisa Completeness (nulos) y Uniqueness (duplicados), además de algunos Outliers en numéricas. 
- **Falta:** Validaciones de formato (Ej. "¿es un email válido?"), consistencia lógica ("La fecha de fin no puede ser anterior a la de inicio") y duplicados "fuzzy" o difusos.

### 2. Exportación de Reportes (MEDIA Prioridad)
Cuando un análisis falla y hay que enviarlo al equipo de origen de los datos a que lo arreglen:
- **Falta:** Un botón "Exportar a PDF" en la página en detalle de evaluación, que genere un documento gerencial sobre los issues, y exportación a Excel cruda con las filas culpables (esto requiere un refactor en cómo se guardan muestras de las filas con error).

### 3. Integración Directa con Fuentes de Datos (DB Remotas) (MEDIA/ALTA Prioridad)
Subir CSVs a mano está bien para un MVP, pero no es escalable para un sistema automatizado empresarial.
- **Falta:** Opción de crear "Sources" (Ej. Conectar a PostgreSQL, S3, o Snowflake). Esto elimina la subida de CSVs manual.

### 4. Análisis Programados - Celery Beat (MEDIA Prioridad)
Atado al punto 3 anterior, si los datos vienen de una Base de Datos:
- **Falta:** Un pequeño componente que programe (ej. Todos los días a las 02:00 AM) un barrido sobre la base de datos remota para subir la última "versión" y evaluarla de manera autónoma.

### 5. Webhooks y Alertas (MEDIA Prioridad)
- **Falta:** Cuando la configuración del Quality Gate diga "FAILED", que dispare automáticamente un correo electrónico o un mensaje a un canal de Slack (para no tener que entrar a la web a revisar).
