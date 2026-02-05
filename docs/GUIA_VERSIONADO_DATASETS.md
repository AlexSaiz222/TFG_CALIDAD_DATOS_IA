# Guía de Usuario: Versionado de Datasets

## Índice
1. [Introducción](#introducción)
2. [Conceptos Básicos](#conceptos-básicos)
3. [Subir Nueva Versión](#subir-nueva-versión)
4. [Ver Historial de Versiones](#ver-historial-de-versiones)
5. [Comparar Versiones](#comparar-versiones)
6. [Indicadores Visuales](#indicadores-visuales)
7. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

El sistema de versionado de datasets permite mantener un historial completo de las diferentes versiones de tus datos. Esto es especialmente útil cuando:

- Corriges errores de calidad en tus datos
- Actualizas datos con nueva información
- Quieres comparar la evolución de la calidad entre versiones
- Necesitas mantener trazabilidad de los cambios

---

## Conceptos Básicos

### ¿Qué es una versión?
Una versión es una instantánea de un dataset en un momento específico. Cada versión tiene:
- **Número de versión**: Incrementa automáticamente (v1, v2, v3...)
- **Etiqueta de versión**: Nombre descriptivo opcional (ej: "corregido", "final", "v2.0-limpio")
- **Indicador "Latest"**: Marca la versión más reciente

### Cadena de versiones
Las versiones forman una cadena lineal donde cada versión tiene un "padre":
```
v1 (original) → v2 (corregido) → v3 (final) ← Latest
```

---

## Subir Nueva Versión

### Desde la página de detalle del dataset

1. Navega al dataset del que quieres crear una nueva versión
2. Haz clic en el botón **"Nueva versión"** (púrpura) en la esquina superior derecha
3. Se abrirá el formulario de upload con el proyecto preseleccionado
4. Sube el nuevo archivo CSV
5. (Opcional) Añade una **etiqueta de versión** descriptiva
6. Completa el proceso de upload

### Campos del formulario

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Archivo | El nuevo archivo CSV con los datos actualizados | Sí |
| Nombre | Nombre del dataset (heredado del padre) | Sí |
| Descripción | Descripción de los cambios en esta versión | No |
| Etiqueta de versión | Nombre descriptivo (ej: "v2.0-corregido") | No |

---

## Ver Historial de Versiones

### Acceder al historial

1. Abre cualquier dataset
2. Ve a la pestaña **"Versiones"**
3. Verás un timeline con todas las versiones

### Información mostrada

Para cada versión se muestra:
- **Fecha de creación**
- **Número/etiqueta de versión**
- **Quality Score** (si tiene análisis)
- **Estado del Quality Gate** (indicador de color)
- **Número de filas y columnas**
- **Badges**: "Latest" (última versión), "Actual" (versión que estás viendo)

### Navegación

- Haz clic en el icono de **ojo** para ver una versión específica
- Haz clic en el icono de **flechas** para seleccionar versiones a comparar

---

## Comparar Versiones

### Iniciar comparación

1. Ve a la pestaña "Versiones" de cualquier dataset
2. Haz clic en el icono de **comparar** (flechas) en la primera versión
3. Aparecerá un mensaje indicando que selecciones otra versión
4. Haz clic en el icono de comparar en la segunda versión
5. Se abrirá la página de comparación

### Página de comparación

La página muestra:

#### Vista lado a lado
- Información de ambas versiones (filas, columnas, score)
- Quality Gate de cada versión

#### Resumen de cambios
- **Cambio en Quality Score**: Diferencia porcentual
- **Cambio en Issues**: Más o menos issues
- **Issues resueltos**: Problemas que ya no existen
- **Nuevos issues**: Problemas nuevos detectados

#### Tablas de Issues
- **Issues Resueltos**: Lista de problemas corregidos (tachados)
- **Nuevos Issues**: Lista de problemas nuevos

---

## Indicadores Visuales

### Chips de versión

| Color | Significado |
|-------|-------------|
| **Gris** | Primera versión (v1) |
| **Púrpura** | Versiones posteriores (v2+) |
| **Azul "Latest"** | Versión más reciente |
| **Verde "Actual"** | Versión que estás viendo |

### Indicadores de Quality Gate en Timeline

| Color del punto | Estado |
|-----------------|--------|
| **Verde** | PASSED - Calidad aceptable |
| **Amarillo** | WARNING - Calidad con advertencias |
| **Rojo** | FAILED - Calidad insuficiente |
| **Gris** | Sin análisis |

### Tendencias en comparación

| Icono | Significado |
|-------|-------------|
| ↑ Verde | Mejora en la métrica |
| ↓ Rojo | Empeoramiento |
| → Amarillo | Sin cambio significativo |

---

## Preguntas Frecuentes

### ¿Puedo eliminar una versión intermedia?
No directamente. Las versiones forman una cadena y eliminar una intermedia rompería la trazabilidad. Si necesitas eliminar, contacta al administrador.

### ¿Qué pasa si subo una versión con menos columnas?
El sistema detectará el cambio y lo mostrará en la comparación. Los análisis se ejecutarán sobre la estructura actual.

### ¿Puedo cambiar la etiqueta de versión después de crearla?
Actualmente no. La etiqueta se define al momento de subir la versión.

### ¿Cómo sé cuál es la versión "correcta" para usar?
La versión marcada como "Latest" es siempre la más reciente. Revisa el Quality Score y el estado del Quality Gate para determinar cuál tiene mejor calidad.

### ¿Las evaluaciones se heredan entre versiones?
No. Cada versión tiene sus propias evaluaciones independientes. Debes ejecutar un nuevo análisis para cada versión.

### ¿Hay límite de versiones?
No hay límite técnico, pero se recomienda mantener un historial manejable para facilitar la navegación.

---

## Flujo de trabajo recomendado

1. **Subir dataset inicial** → Se crea como v1
2. **Ejecutar análisis** → Identificar problemas de calidad
3. **Corregir datos** en tu herramienta favorita
4. **Subir nueva versión** → Se crea como v2
5. **Ejecutar análisis** → Verificar mejoras
6. **Comparar versiones** → Confirmar issues resueltos
7. **Repetir** hasta alcanzar calidad deseada

---

## Soporte

Si tienes problemas con el sistema de versionado, contacta al equipo de soporte o revisa la documentación técnica en `docs/PLAN_VERSIONADO_DATASETS.md`.
