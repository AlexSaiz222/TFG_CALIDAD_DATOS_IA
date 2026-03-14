# Guía de Pruebas Manuales (Workflow del Usuario)

Este documento describe paso a paso el flujo de trabajo completo que un usuario puede realizar en la plataforma **DataQual** actualmente para probar que todos los módulos integrados funcionan correctamente. Al final del documento se listan las funcionalidades futuras prioritarias.

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
