# DataQual: Plataforma para la Evaluación de Calidad de Datos en Proyectos de IA

**Documento base para el Trabajo Fin de Estudios**
**Título:** Creación de una Plataforma/API para la Evaluación de Calidad de Datos en Proyectos de IA
**Autor:** Alejandro Manuel Saiz García
**Institución:** Universidad de Castilla-La Mancha — Facultad de Ciencias Sociales de Talavera de la Reina
**Titulación:** Grado en Ingeniería Informática
**Curso académico:** 2025-2026

---

## Índice

1. [Visión General y Propósito de DataQual](#1-visión-general-y-propósito-de-dataqual)
2. [Contexto y Justificación](#2-contexto-y-justificación)
3. [Objetivos del Proyecto](#3-objetivos-del-proyecto)
4. [Arquitectura Técnica](#4-arquitectura-técnica)
5. [Motor de Métricas de Calidad](#5-motor-de-métricas-de-calidad)
6. [Funcionalidades Clave](#6-funcionalidades-clave)
7. [Pila Tecnológica y Justificación](#7-pila-tecnológica-y-justificación)
8. [Seguridad](#8-seguridad)
9. [Flujo de Datos y Evaluación End-to-End](#9-flujo-de-datos-y-evaluación-end-to-end)
10. [Resultados y Discusión](#10-resultados-y-discusión)
11. [Correspondencia con Secciones del TFG](#11-correspondencia-con-secciones-del-tfg)

---

# 1. Visión General y Propósito de DataQual

## 1.1 Qué es DataQual

DataQual es una plataforma web completa (full-stack) para la evaluación automatizada de la calidad de datos en proyectos de inteligencia artificial, aprendizaje automático y minería de datos. Combina una **interfaz gráfica interactiva** con una **API RESTful**, permitiendo que tanto usuarios técnicos como perfiles de negocio puedan diagnosticar, monitorizar y mejorar la calidad de sus datasets antes de utilizarlos para entrenar modelos o tomar decisiones basadas en datos.

La plataforma permite:

- **Subir datasets** en múltiples formatos (CSV, XLSX, JSON, Parquet) y almacenarlos de forma segura.
- **Configurar métricas de calidad** adaptadas al tipo de proyecto, con parámetros y umbrales personalizables.
- **Ejecutar evaluaciones asíncronas** que analizan el dataset contra las métricas configuradas y generan un informe detallado.
- **Visualizar resultados** en dashboards interactivos con gráficos, tablas de métricas por columna, histogramas, boxplots y matrices de correlación.
- **Rastrear la evolución de la calidad** a lo largo del tiempo, comparando ejecuciones consecutivas mediante un sistema de fingerprinting de issues.
- **Establecer Quality Gates** (umbrales de calidad mínima) que determinan si un dataset está listo para su uso.
- **Proteger datos sensibles** mediante el enmascaramiento automático de columnas marcadas como PII (Información Personal Identificable).

DataQual se despliega como un conjunto de **8 servicios Docker** orquestados con Docker Compose, lo que garantiza portabilidad, reproducibilidad y soberanía de datos (todos los datos permanecen en la infraestructura del usuario).

## 1.2 El problema de la calidad de datos en IA

En el campo de la inteligencia artificial y el aprendizaje automático existe un principio ampliamente reconocido: **"garbage in, garbage out"** (basura entra, basura sale). Este principio establece que la calidad de las salidas de un sistema está directamente limitada por la calidad de sus entradas. Un modelo de aprendizaje automático, por sofisticado que sea su algoritmo, producirá predicciones poco fiables si los datos con los que fue entrenado están incompletos, son inconsistentes, contienen sesgos o están desactualizados.

La problemática de la calidad de datos en proyectos de IA se manifiesta en múltiples dimensiones:

**Impacto en la fiabilidad de los modelos.** Estudios como los de Sambasivan et al. (2021) en Google Research ("Everyone wants to do the model work, not the data work") han demostrado que los problemas de calidad de datos son la causa principal de fallos en sistemas de IA en producción, superando incluso a los errores algorítmicos. Un dataset de entrenamiento con un 10% de etiquetas incorrectas puede reducir la precisión de un clasificador en más de 15 puntos porcentuales.

**Coste económico.** Según estimaciones de Gartner e IBM, la mala calidad de datos cuesta a las organizaciones una media de 12,9 millones de dólares anuales. En el contexto específico de proyectos de IA, este coste se amplifica: un modelo entrenado con datos defectuosos no solo produce resultados incorrectos, sino que las decisiones basadas en esas predicciones pueden tener consecuencias financieras, legales y reputacionales significativas.

**Tiempo dedicado a la preparación de datos.** Múltiples encuestas en la industria (Kaggle State of Data Science, CrowdFlower/Figure Eight Data Scientist Report) coinciden en que los profesionales de datos dedican entre el 60% y el 80% de su tiempo a tareas de limpieza y preparación de datos. Este porcentaje refleja tanto la prevalencia de los problemas de calidad como la ausencia de herramientas automatizadas que agilicen el diagnóstico.

**Sesgo algorítmico.** Los datos desequilibrados o no representativos son la raíz de muchos casos de sesgo en sistemas de IA. Desde algoritmos de contratación que discriminan por género (caso Amazon, 2018) hasta sistemas de reconocimiento facial con tasas de error desproporcionadas para minorías étnicas (estudio de Buolamwini y Gebru, 2018), la calidad de los datos —en particular, el equilibrio de clases y la representatividad— es un factor determinante en la equidad de los sistemas inteligentes.

**Requisitos regulatorios.** La creciente regulación de la IA (Reglamento Europeo de Inteligencia Artificial / AI Act, directivas sobre protección de datos como el RGPD) exige que las organizaciones puedan demostrar la calidad y trazabilidad de los datos utilizados en sus modelos. Esto convierte la evaluación de calidad de datos en una necesidad no solo técnica, sino también de cumplimiento normativo.

## 1.3 Por qué una plataforma dedicada

Tradicionalmente, la evaluación de calidad de datos en proyectos de IA se ha realizado mediante enfoques ad-hoc: scripts de Python escritos a medida, consultas SQL manuales, inspecciones visuales en notebooks de Jupyter, o simplemente confiando en la intuición del equipo. Estos enfoques presentan limitaciones fundamentales:

**Falta de estandarización.** Cada equipo o proyecto define sus propias métricas y umbrales, lo que dificulta la comparación entre proyectos y la aplicación consistente de estándares de calidad. DataQual implementa métricas alineadas con los estándares ISO/IEC 25012 e ISO/IEC 5259, proporcionando un marco común y reproducible.

**Ausencia de historización.** Los scripts ad-hoc evalúan un snapshot puntual del dataset, pero no registran el historial de evaluaciones ni permiten rastrear la evolución de la calidad. DataQual mantiene un historial completo de ejecuciones (AnalysisRun) con comparación automática contra la línea base anterior, identificando issues nuevos, recurrentes y corregidos.

**Barrera técnica.** Las herramientas basadas en código (como Great Expectations o Apache Deequ) requieren conocimientos de programación para configurar y ejecutar evaluaciones. DataQual proporciona una interfaz web completa que permite a usuarios no técnicos configurar métricas, lanzar evaluaciones y consultar resultados sin escribir una sola línea de código.

**Falta de integración en el flujo de trabajo.** Los scripts independientes no se integran fácilmente en pipelines de datos automatizados. La API RESTful de DataQual permite que las evaluaciones se lancen programáticamente desde pipelines de MLOps, CI/CD o flujos de ETL, y que los resultados se consulten mediante endpoints estándar.

**Ausencia de Quality Gates.** Pocas herramientas proporcionan un mecanismo claro de "semáforo" que indique si un dataset cumple los requisitos mínimos para su uso. Inspirado en SonarQube (la herramienta estándar de la industria para calidad de código), DataQual implementa Quality Gates configurables con estados PASSED/WARNING/FAILED que proporcionan una señal inequívoca sobre la aptitud del dataset.

## 1.4 Público objetivo

DataQual está diseñado para servir a diversos perfiles dentro del ecosistema de datos e IA:

- **Data Engineers:** responsables de la ingesta, transformación y calidad de los datos en los pipelines. Utilizan DataQual para validar la calidad de los datos antes y después de las transformaciones ETL/ELT.

- **Data Scientists y ML Engineers:** necesitan datasets de calidad para entrenar modelos fiables. Utilizan DataQual para diagnosticar problemas (outliers, desequilibrio de clases, valores faltantes) antes de la fase de modelado.

- **Analistas de datos:** evalúan la fiabilidad de los datos antes de producir informes o dashboards de negocio. El profiling interactivo de DataQual les permite explorar distribuciones, correlaciones y anomalías sin escribir código.

- **Responsables de calidad y compliance:** necesitan evidencia documentada de que los datos cumplen estándares de calidad. Los informes de DataQual, con sus Quality Gates y métricas estandarizadas, proporcionan esta evidencia.

- **Project Managers técnicos:** necesitan una visión de alto nivel del estado de salud de los datos de sus proyectos. El dashboard principal de DataQual muestra el resumen de calidad de todos los proyectos con indicadores visuales claros.

---

# 2. Contexto y Justificación

## 2.1 La importancia de la calidad de datos en proyectos de IA

La calidad de datos se ha consolidado como un campo de estudio dentro de la informática y la gestión de la información. Los trabajos seminales de Wang y Strong (1996) establecieron un marco conceptual para la calidad de datos basado en cuatro categorías: intrínseca (precisión, objetividad, credibilidad, reputación), contextual (relevancia, valor añadido, completitud, cantidad apropiada, oportunidad), representacional (interpretabilidad, facilidad de comprensión, representación concisa, representación consistente) y accesibilidad (accesibilidad, seguridad de acceso).

Redman (1998, 2001) cuantificó por primera vez el impacto económico de la mala calidad de datos en las organizaciones, estableciendo que las empresas gastan entre el 10% y el 25% de sus ingresos en gestionar problemas derivados de datos de baja calidad. Estos hallazgos han sido corroborados y ampliados por estudios posteriores del MIT Information Quality Program y del Data Management Body of Knowledge (DMBOK).

En el contexto específico de la inteligencia artificial, la calidad de datos adquiere una relevancia aún mayor. Andrew Ng, uno de los investigadores más influyentes en IA, ha popularizado el concepto de "data-centric AI" como contraposición al enfoque tradicional "model-centric". Mientras que el enfoque model-centric se centra en mejorar los algoritmos manteniendo los datos fijos, el enfoque data-centric propone mantener los modelos fijos y mejorar sistemáticamente los datos. Este cambio de paradigma reconoce que, para la mayoría de aplicaciones prácticas de IA, la mejora de los datos produce un impacto mayor que la mejora de los algoritmos.

El movimiento data-centric AI ha generado iniciativas como:

- **Data-Centric AI Competition** (organizado por Andrew Ng y Landing AI), donde los participantes compiten mejorando datos en lugar de modelos.
- **Dataperf** (MLCommons), un benchmark para evaluar la calidad de los datos de entrenamiento.
- **Data Quality for AI** (DQAI), un área de investigación emergente que estudia cómo las distintas dimensiones de calidad de datos afectan al rendimiento de los modelos.

Estos desarrollos confirman la necesidad de herramientas especializadas que permitan evaluar la calidad de datos de forma sistemática, reproducible y adaptada al contexto de los proyectos de IA.

## 2.2 Marco normativo: estándares ISO

La evaluación de calidad de datos no es una actividad arbitraria; existen estándares internacionales que definen las dimensiones de calidad, los métodos de medición y los requisitos para los datos utilizados en sistemas de IA. DataQual se alinea con tres familias de estándares:

### ISO/IEC 25012: Modelo de Calidad de Datos

La norma ISO/IEC 25012, parte de la familia SQuaRE (Systems and Software Quality Requirements and Evaluation), define un modelo de calidad de datos con 15 características organizadas en dos categorías:

**Calidad inherente** (propiedades intrínsecas del dato):
- Exactitud (accuracy)
- Completitud (completeness)
- Consistencia (consistency)
- Credibilidad (credibility)
- Actualidad (currentness / currentness)

**Calidad dependiente del sistema:**
- Disponibilidad (availability)
- Portabilidad (portability)
- Recuperabilidad (recoverability)

**Correspondencia con métricas de DataQual:**

| Característica ISO 25012 | Métrica DataQual | Implementación |
|--------------------------|------------------|----------------|
| Completitud | `completeness` | Ratio de valores no nulos |
| Exactitud | `syntactic_accuracy` | Conformidad con patrones de formato |
| Consistencia | `logical_consistency` | Reglas IF-THEN entre columnas |
| Actualidad | `currentness` | Antigüedad del dato más reciente |
| Credibilidad | `uniqueness` | Detección de duplicados |
| — | `outliers` | Detección de valores atípicos |
| — | `class_balance` | Equilibrio de clases (específica para ML) |

### ISO/IEC 5259: Calidad de datos para analítica e IA

La norma ISO/IEC 5259 es un estándar más reciente (publicación en curso, partes 1-4) diseñado específicamente para la calidad de datos en contextos de analítica e inteligencia artificial. Define:

- **Parte 1:** Visión general y vocabulario.
- **Parte 2:** Requisitos de calidad de datos.
- **Parte 3:** Requisitos de gestión de datos.
- **Parte 4:** Marco de calidad de datos para procesos analíticos.

DataQual se alinea con ISO/IEC 5259 al:
- Proporcionar métricas cuantitativas estandarizadas (Parte 2).
- Implementar gestión de datasets con versionado y trazabilidad (Parte 3).
- Ofrecer un flujo de evaluación integrado en el ciclo de vida del proyecto (Parte 4).

### ISO/IEC 25024: Medición de la calidad de datos

La ISO/IEC 25024 complementa a la 25012 proporcionando métricas concretas para medir cada característica de calidad. DataQual implementa mediciones directamente inspiradas en este estándar, como la ratio de completitud (valores no nulos / total de valores), la ratio de unicidad (valores únicos / total de valores) y la conformidad sintáctica (valores conformes / total de valores evaluados).

## 2.3 Estado del arte: herramientas existentes

El ecosistema de herramientas para evaluación de calidad de datos incluye tanto soluciones de código abierto como comerciales. A continuación se analiza el estado del arte y cómo DataQual se posiciona respecto a las alternativas existentes.

### Great Expectations

Great Expectations es una biblioteca de Python de código abierto que permite definir, documentar y validar "expectativas" (reglas de calidad) sobre datasets. Es probablemente la herramienta más popular en su categoría.

**Fortalezas:** ecosistema maduro, amplia comunidad, integración con múltiples backends (Pandas, Spark, SQL), generación automática de documentación de datos ("Data Docs").

**Limitaciones:** enfoque exclusivamente code-first (requiere Python), sin interfaz gráfica integrada, sin Quality Gates como concepto nativo, sin rastreo de evolución de issues entre ejecuciones, curva de aprendizaje pronunciada para usuarios no técnicos.

### Apache Deequ

Deequ es una biblioteca desarrollada por Amazon para verificación de calidad de datos a gran escala, construida sobre Apache Spark.

**Fortalezas:** escalabilidad masiva, integración nativa con AWS, verificación de restricciones declarativas, detección de anomalías basada en series temporales.

**Limitaciones:** requiere ecosistema JVM y Apache Spark, no tiene interfaz web, orientado a big data (sobredimensionado para datasets medianos), sin soporte para métricas específicas de ML como equilibrio de clases.

### DQOps

DQOps es una herramienta de código abierto que adopta un enfoque inspirado en SonarQube para la calidad de datos, con soporte para Quality Gates y rastreo de issues.

**Fortalezas:** filosofía similar a DataQual, soporte para múltiples fuentes de datos (BigQuery, Snowflake, PostgreSQL, etc.), interfaz web, alertas automatizadas.

**Limitaciones:** enfocado a bases de datos (no a archivos/datasets), configuración compleja, no diseñado específicamente para el contexto de IA/ML, sin métricas como equilibrio de clases o detección de outliers.

### Trifacta / Alteryx / Talend

Herramientas comerciales de preparación y calidad de datos con interfaces visuales avanzadas.

**Fortalezas:** interfaces muy pulidas, capacidades de transformación de datos, soporte empresarial.

**Limitaciones:** coste de licencia elevado, soluciones cerradas (vendor lock-in), orientadas a data wrangling más que a evaluación de calidad para IA, sin soberanía de datos (muchas son SaaS).

### Tabla comparativa

| Característica | DataQual | Great Expectations | Apache Deequ | DQOps |
|---------------|----------|-------------------|--------------|-------|
| Interfaz web integrada | Si | No | No | Si |
| Requiere programación | No (tiene API) | Si (Python) | Si (Scala/Python) | Parcial |
| Métricas predefinidas | 7 | Extensible (define tú) | ~15 | ~150+ |
| Auto-detección de tipos | Si | No | No | Parcial |
| Quality Gates | Si (PASSED/WARNING/FAILED) | No nativo | No | Si |
| Fingerprinting de issues | Si (SHA-256) | No | No | Si (parcial) |
| Comparación entre ejecuciones | Si (new/fixed/recurrent) | No | Parcial | Si |
| Equilibrio de clases (ML) | Si (Shannon entropy) | No | No | No |
| Detección de outliers | Si (IQR + Z-score) | Parcial | Si | Si |
| Enmascaramiento PII | Si (columnas sensibles) | No | No | No |
| Versionado de datasets | Si (parent-child) | No | No | No |
| Procesamiento asíncrono | Si (Celery) | No | Si (Spark) | Si |
| Self-hosted (Docker) | Si | Si | Si | Si |
| Específico para IA/ML | Si | No | No | No |
| Coste | Gratuito (open source) | Gratuito (core) | Gratuito | Gratuito (core) |

## 2.4 Diferenciación de DataQual

DataQual se diferencia de las alternativas existentes en varios aspectos clave:

1. **Solución full-stack con UI integrada.** A diferencia de Great Expectations o Deequ, DataQual proporciona una interfaz web completa que permite a usuarios no técnicos configurar métricas, lanzar evaluaciones y consultar resultados sin escribir código. La API RESTful coexiste para integraciones programáticas.

2. **Diseño centrado en IA/ML.** DataQual incluye métricas específicas para el contexto de inteligencia artificial que no están presentes en herramientas generalistas: el equilibrio de clases (basado en entropía de Shannon) detecta desequilibrios que sesgan los modelos, y la actualidad (currentness) alerta cuando los datos de entrenamiento han quedado obsoletos.

3. **Sistema de fingerprinting para trazabilidad.** Cada issue detectado recibe un fingerprint SHA-256 determinista que permite rastrearlo entre ejecuciones. Esta capacidad —inspirada en cómo SonarQube rastrea issues de código— permite visualizar la evolución de la calidad: qué problemas son nuevos, cuáles persisten y cuáles se han corregido.

4. **Quality Gates como punto de decisión.** Los Quality Gates proporcionan una señal binaria clara ("este dataset está listo" / "este dataset no cumple los mínimos") que puede integrarse en pipelines de CI/CD para bloquear automáticamente el uso de datasets de baja calidad.

5. **Protección de datos sensibles integrada.** El enmascaramiento de columnas sensibles (PII) está integrado en todas las métricas del sistema, no como una capa adicional sino como comportamiento nativo. Esto permite evaluar la calidad de datos que contienen información personal sin exponerla en los informes.

6. **Arquitectura extensible.** El sistema de métricas basado en plugins (clase abstracta `BaseMetric` + registro `METRIC_REGISTRY`) permite añadir nuevas métricas con solo 4 pasos, sin modificar el núcleo del sistema.

7. **Self-hosted y soberanía de datos.** Todo el stack se ejecuta en la infraestructura del usuario mediante Docker Compose. Los datos nunca abandonan el entorno controlado, cumpliendo con requisitos de soberanía de datos y RGPD.

## 2.5 Justificación académica

Este proyecto constituye un Trabajo Fin de Estudios apropiado para el Grado en Ingeniería Informática porque integra múltiples áreas de conocimiento del plan de estudios:

- **Ingeniería del Software:** arquitectura de software (microservicios, patrón factoría, MVC), patrones de diseño (Abstract Factory para métricas, Observer para notificaciones), control de versiones, metodologías ágiles.

- **Sistemas distribuidos:** procesamiento asíncrono con colas de mensajes (Celery/Redis), orquestación de servicios (Docker Compose), healthchecks y watchdogs para resiliencia.

- **Bases de datos:** diseño de esquemas relacionales con PostgreSQL, uso de campos JSONB para esquemas flexibles, migraciones de bases de datos, almacenamiento de objetos (MinIO/S3).

- **Desarrollo web:** desarrollo full-stack con tecnologías modernas de frontend (React, Next.js, TypeScript) y backend (Flask, Python), comunicación cliente-servidor vía API REST, autenticación JWT.

- **Análisis de datos y estadística:** implementación de métricas estadísticas (IQR, Z-score, entropía de Shannon), análisis exploratorio de datos (histogramas, boxplots, matrices de correlación), detección de anomalías.

- **Seguridad informática:** autenticación y autorización (JWT, RBAC), hashing de contraseñas (PBKDF2), protección contra inyección (validación de entrada, tokens prohibidos), protección de datos personales (enmascaramiento PII).

- **DevOps:** contenedorización con Docker, orquestación con Docker Compose, monitorización (Flower), gestión de configuración por variables de entorno.

---

# 3. Objetivos del Proyecto

## 3.1 Objetivo general

El objetivo general de este Trabajo Fin de Estudios consiste en **desarrollar una plataforma web interactiva y una API RESTful que permitan evaluar de forma automatizada la calidad de los datos empleados en proyectos de inteligencia artificial, aprendizaje automático y minería de datos**, proporcionando métricas, visualizaciones y mecanismos de diagnóstico que faciliten la identificación y corrección de problemas de calidad en los datasets.

## 3.2 Objetivos específicos

Los objetivos específicos del proyecto son:

### OE1. Módulo de ingesta y almacenamiento

**Enunciado:** Desarrollar un módulo de ingesta y almacenamiento que permita la carga, validación de formato y persistencia segura de datasets.

**Implementación en DataQual:**
- Soporte para múltiples formatos: CSV, XLSX, XLS, JSON, Parquet.
- Parseo robusto de CSV con matriz de fallback: 4 codificaciones (UTF-8, UTF-8-BOM, CP1252, Latin-1) × 3 separadores (coma, punto y coma, tabulador, pipe) × 2 motores (Python, C).
- Almacenamiento binario en MinIO (S3-compatible) para los archivos originales.
- Almacenamiento de metadatos (esquema, estadísticas, conteos) en PostgreSQL.
- Validación de formato y tamaño (máximo 100 MB configurable).
- Extracción automática de esquema: nombres de columna, tipos de dato, estadísticas descriptivas (media, mediana, desviación estándar, mínimo, máximo, histogramas).

### OE2. Motor de evaluación con métricas parametrizables

**Enunciado:** Implementar un motor de evaluación que calcule métricas de calidad estándar sobre los datasets cargados, permitiendo su parametrización según la tipología del proyecto.

**Implementación en DataQual:**
- 7 métricas implementadas como plugins independientes heredando de `BaseMetric`.
- Registro dinámico en `METRIC_REGISTRY` para instanciación por nombre.
- Parámetros configurables por métrica: umbrales, columnas objetivo, métodos de detección, pesos.
- Sistema de pesos (0.0–1.0) para ponderar la contribución de cada métrica al score global.
- Plantillas de métricas (`MetricTemplate`) para reutilizar configuraciones entre proyectos.
- Ejecución asíncrona vía Celery con tracking de progreso (0–100%).

### OE3. API RESTful documentada

**Enunciado:** Diseñar e implementar una API RESTful documentada que exponga endpoints para la carga de datos, configuración de evaluaciones, ejecución de análisis y consulta de resultados, permitiendo la integración con flujos de trabajo externos.

**Implementación en DataQual:**
- 6 módulos de API organizados en Blueprints de Flask: auth, projects, datasets, metrics, evaluations, admin.
- Endpoints para todo el ciclo de vida: registro/login, CRUD de proyectos, upload de datasets, configuración de métricas, lanzamiento de evaluaciones, consulta de resultados y issues.
- Formato de respuesta estandarizado: `{ success: bool, data: {...}, message: str }`.
- Paginación en listados (`page`, `per_page`, metadatos de paginación).
- Autenticación JWT en todos los endpoints protegidos.
- Endpoint de health check para monitorización.

### OE4. Aplicación web con dashboards interactivos

**Enunciado:** Desarrollar una aplicación web para la gestión de proyectos y datasets, que permita configurar evaluaciones y umbrales de calidad personalizados, consultar el historial de evaluaciones realizadas y visualizar las métricas obtenidas mediante dashboards interactivos.

**Implementación en DataQual:**
- 20 rutas/páginas cubriendo todo el flujo de trabajo.
- Dashboard principal con resumen de proyectos, datasets y distribución de Quality Gates.
- Página de detalle de proyecto con pestañas: datasets, configuración, historial, Quality Gate.
- Página de resultados de evaluación con gauge de quality score, pestañas por métrica y lista de issues.
- Profiling de datos interactivo: histogramas, boxplots, bar charts, matrices de correlación (Pearson y Spearman), detección de outliers con factor IQR configurable.
- Gráficos de tendencia de calidad a lo largo del tiempo.
- Badges visuales de Quality Gate (PASSED verde, WARNING amarillo, FAILED rojo).
- Diseño responsive con soporte para móvil, tablet y escritorio.

### OE5. Mecanismos de identificación de problemas

**Enunciado:** Desarrollar mecanismos de identificación y sugerencia de corrección de problemas de calidad que permitan localizar registros defectuosos en los datasets y proponer acciones correctivas para resolver las incidencias detectadas.

**Implementación en DataQual:**
- Sistema de issues con 4 niveles de severidad: critical, high, medium, low.
- Fingerprinting SHA-256 para identificación única de cada issue.
- Comparación con baseline: clasificación de issues como nuevos, recurrentes o corregidos.
- Muestras de datos afectados (hasta 5 filas de ejemplo por issue, con PII enmascarada).
- Columnas afectadas identificadas para cada issue.
- Severidad dinámica calculada según la distancia al umbral y el tipo de métrica.
- Quality Gates como mecanismo de decisión: PASSED (cumple todos los umbrales), WARNING (margen estrecho), FAILED (al menos un umbral incumplido).

## 3.3 Objetivos transversales

Además de los objetivos específicos funcionales, el proyecto persigue objetivos transversales de calidad del software:

- **Seguridad:** autenticación JWT con tokens de acceso y refresco, hashing PBKDF2 de contraseñas, rate limiting, validación de entrada, protección contra inyección de código en reglas de consistencia lógica, enmascaramiento de PII.

- **Escalabilidad:** procesamiento asíncrono con Celery workers que pueden escalarse horizontalmente, separación de responsabilidades entre servicios, colas de mensajes Redis.

- **Mantenibilidad:** arquitectura modular (blueprints, services, models), sistema de métricas extensible por plugins, migraciones de base de datos versionadas, separación frontend/backend.

- **Usabilidad:** interfaz Material Design responsiva, formularios con validación en tiempo real, notificaciones toast, breadcrumbs de navegación, estados de carga y error claros.

- **Portabilidad:** stack completo contenedorizado con Docker Compose, configuración por variables de entorno, sin dependencias de servicios cloud propietarios.

---

# 4. Arquitectura Técnica

## 4.1 Vista general de la arquitectura

DataQual sigue una arquitectura de servicios orquestados mediante Docker Compose. Los 8 servicios se comunican a través de una red interna (`app-network`, driver bridge) y exponen únicamente los puertos necesarios al host.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Compose                            │
│                                                                  │
│  ┌──────────┐     HTTP/JSON      ┌──────────┐                  │
│  │ Frontend │ ──────────────────► │ Backend  │                  │
│  │ (Next.js)│ :3000    /api/*    │ (Flask)  │ :5000            │
│  └──────────┘                    └────┬─────┘                  │
│                                       │                          │
│                    ┌──────────────────┼──────────────────┐       │
│                    │                  │                  │       │
│                    ▼                  ▼                  ▼       │
│             ┌──────────┐      ┌──────────┐      ┌──────────┐   │
│             │PostgreSQL│      │  MinIO   │      │  Redis   │   │
│             │          │:5432 │ (S3)     │:9000 │          │:6379│
│             └──────────┘      └──────────┘:9001 └────┬─────┘   │
│                                                       │         │
│                                          ┌────────────┼────┐    │
│                                          │            │    │    │
│                                          ▼            ▼    ▼    │
│                                   ┌──────────┐ ┌─────┐ ┌─────┐ │
│                                   │  Celery  │ │Beat │ │Flower│ │
│                                   │  Worker  │ │     │ │:5555 │ │
│                                   └──────────┘ └─────┘ └─────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Flujo de comunicación:**
1. El **Frontend** (Next.js) realiza peticiones HTTP a la API del **Backend** (Flask). Las rutas `/api/*` se reescriben internamente al backend.
2. El **Backend** lee y escribe en **PostgreSQL** (datos relacionales), **MinIO** (archivos binarios) y **Redis** (caché y broker).
3. Cuando se lanza una evaluación, el Backend encola una tarea en **Redis**, que es consumida por el **Celery Worker**.
4. El Worker ejecuta la evaluación, actualiza el progreso en PostgreSQL y almacena los resultados.
5. **Celery Beat** gestiona tareas programadas.
6. **Flower** proporciona un dashboard de monitorización de los workers.

## 4.2 Servicios Docker

| Servicio | Imagen/Build | Puerto(s) | Propósito | Dependencias |
|----------|-------------|-----------|-----------|-------------|
| `frontend` | `./frontend/Dockerfile` (Node 18-alpine) | 3000 | Interfaz de usuario Next.js + React | backend |
| `backend` | `./backend/Dockerfile` (Python 3.10-slim) | 5000 | API REST Flask + Gunicorn | postgres, minio, redis |
| `celery-worker` | (mismo que backend) | — | Ejecución asíncrona de evaluaciones | backend, redis, postgres |
| `celery-beat` | (mismo que backend) | — | Programación de tareas periódicas | celery-worker, redis |
| `flower` | `./backend/Dockerfile.flower` | 5555 | Dashboard de monitorización Celery | celery-worker, redis |
| `postgres` | `postgres:14` | 5432 | Base de datos relacional | — |
| `minio` | `minio/minio` | 9000, 9001 | Almacenamiento de objetos S3 | — |
| `redis` | `redis:6` | 6379 | Broker de mensajes + caché | — |

Todos los servicios tienen política `restart: unless-stopped` y los servicios de infraestructura (PostgreSQL, MinIO, Redis) incluyen healthchecks para garantizar que están operativos antes de que arranquen los servicios dependientes.

Los datos persistentes se almacenan en volúmenes nombrados de Docker: `postgres-data`, `minio-data` y `redis-data`.

## 4.3 Arquitectura del Backend

El backend sigue una arquitectura en capas con separación clara de responsabilidades:

### Capa de entrada: Blueprints de Flask

La aplicación Flask se crea mediante el patrón factoría (`create_app()` en `app.py`), que inicializa las extensiones, registra los blueprints y configura el middleware.

Los 6 blueprints de API se montan bajo el prefijo `/api`:

```
/api/auth/         → Autenticación (login, registro, refresh, perfil)
/api/projects/     → CRUD de proyectos + configuración de métricas
/api/datasets/     → Upload, consulta, versionado de datasets
/api/metrics/      → Consulta de métricas y gestión de plantillas
/api/evaluations/  → Lanzamiento y consulta de evaluaciones
/api/admin/        → Rendimiento del sistema y health check
```

### Capa de servicio

- **EvaluationService** (`services/evaluation_service.py`): orquesta todo el flujo de evaluación, desde la descarga del dataset hasta el cálculo del Quality Score y la comparación con baseline.
- **DatasetService** (`services/dataset_service.py`): parseo robusto de archivos, extracción de esquema y estadísticas.
- **MinioService** (`services/minio_service.py`): abstracción sobre el cliente MinIO para upload, download y gestión de archivos.
- **Motor de métricas** (`services/metrics/`): paquete modular con BaseMetric, 7 implementaciones y el registro.

### Capa de modelo

Los modelos SQLAlchemy definen el esquema de base de datos. El sistema mantiene una **arquitectura dual** por razones de evolución:

- **Modelo Legacy:** `Evaluation` + `Issue` — el diseño original, mantenido por compatibilidad.
- **Modelo Sonar-Lite:** `AnalysisRun` + `DataQualityIssue` + `QualityGate` — el diseño nuevo, inspirado en SonarQube, con soporte para fingerprinting, Quality Gates y comparación con baseline.

Ambos modelos se actualizan en paralelo durante cada evaluación para garantizar retrocompatibilidad.

### Middleware

El backend incluye 4 capas de middleware:

1. **Request Middleware:** genera X-Request-ID único, registra inicio/fin de petición, añade cabeceras de seguridad.
2. **Error Handlers:** manejo centralizado de errores HTTP (400, 401, 403, 404, 405, 429) y errores de base de datos.
3. **Performance Monitor:** recoge métricas de rendimiento por endpoint (count, avg_ms, min_ms, max_ms), detecta peticiones lentas (>500ms).
4. **Evaluation Watchdog:** hilo daemon que detecta evaluaciones atascadas (>5 min sin progreso) y las marca como fallidas.

### Extensiones Flask

| Extensión | Propósito |
|-----------|-----------|
| Flask-SQLAlchemy | ORM para PostgreSQL |
| Flask-Migrate | Migraciones de base de datos (Alembic) |
| Flask-JWT-Extended | Autenticación JWT (tokens de acceso y refresco) |
| Flask-CORS | Cross-Origin Resource Sharing |
| Flask-Limiter | Rate limiting (100 req/min por defecto) |
| Gunicorn | Servidor WSGI de producción |

## 4.4 Arquitectura del Frontend

### Framework y estructura

El frontend utiliza **Next.js 13.3** con el enrutador de páginas (pages router) y **React 18** con TypeScript. La estructura de archivos sigue las convenciones de Next.js:

```
frontend/src/
├── pages/              ← Rutas (file-based routing)
│   ├── auth.tsx        ← Login/Registro (con fondo 3D de partículas)
│   ├── dashboard.tsx   ← Dashboard principal
│   ├── projects/       ← CRUD de proyectos
│   ├── datasets/       ← Gestión de datasets
│   ├── evaluations/    ← Resultados de evaluaciones
│   ├── metrics/        ← Configuración de métricas
│   └── settings/       ← Gestión de plantillas
├── components/         ← 40+ componentes reutilizables
│   ├── layout/         ← MainLayout, Sidebar, Breadcrumbs
│   ├── evaluations/    ← Detalle por métrica, gauge, issues
│   ├── metrics/        ← Diálogos de configuración, editor de reglas
│   ├── dashboard/      ← Gráficos del dashboard
│   └── gl/             ← Fondo 3D con Three.js
├── services/           ← Cliente API (Axios)
├── contexts/           ← Contextos React (Auth, Notification, Sidebar)
├── types/              ← Interfaces TypeScript
└── utils/              ← Utilidades (colores, fechas)
```

### Gestión de estado

El frontend utiliza **React Context API** (sin Redux) con 3 contextos globales:

- **AuthContext:** estado de autenticación (token JWT, datos de usuario), funciones login/logout/register/updateProfile. Token almacenado en localStorage con caché de 5 minutos para el perfil de usuario.
- **NotificationContext:** sistema de notificaciones toast (success, error, warning, info) con duración configurable.
- **SidebarContext:** estado de la barra lateral (abierta/cerrada/colapsada), persistido en localStorage.

### Cliente API

El servicio API (`services/api.ts`, ~810 líneas) implementa:

- **Instancia Axios** con interceptores para inyección automática del token JWT.
- **Deduplicación de peticiones GET:** previene peticiones duplicadas cancelando las anteriores si son idénticas y tienen más de 100ms.
- **Manejo de errores centralizado:** redirección a `/auth` en caso de 401, fallback a arrays vacíos en caso de 404.
- **Timeouts configurables:** 8-30 segundos según la operación.
- **6 módulos de API:** authAPI, projectsAPI, datasetsAPI, metricsAPI, analysisAPI, evaluationsAPI.

### Visualizaciones

| Librería | Uso |
|----------|-----|
| Chart.js + react-chartjs-2 | Histogramas, bar charts, scatter plots, doughnut charts, line charts |
| Three.js + @react-three/fiber | Fondo de partículas 3D en la página de autenticación |

## 4.5 Base de datos

PostgreSQL 14 almacena todos los datos relacionales y metadatos del sistema. El esquema incluye ~9 tablas con uso extensivo de campos **JSONB** para almacenar datos semi-estructurados (configuraciones de métricas, resultados de evaluaciones, esquemas de datasets).

### Diagrama Entidad-Relación

```
┌──────────┐     1:N     ┌──────────┐     1:N     ┌──────────────┐
│  users   │────────────►│ projects │────────────►│   datasets   │
│          │             │          │             │              │
│ id (PK)  │             │ id (PK)  │             │ id (PK)      │
│ username │             │ name     │             │ name         │
│ email    │             │ descript.│             │ project_id   │
│ pass_hash│             │ owner_id │             │ file_path    │
│ role     │             │ metrics_ │             │ schema (JSON)│
│          │             │ config   │             │ sensitive_   │
│          │             │ (JSONB)  │             │ columns(JSON)│
└──────────┘             └────┬─────┘             │ parent_id(FK)│
                              │                   │ version      │
                              │                   │ is_latest    │
                              │ 1:N               └──────┬───────┘
                              │                          │ 1:N
                         ┌────▼──────┐             ┌─────▼───────┐
                         │ analysis_ │             │ evaluations │
                         │ runs      │             │ (legacy)    │
                         │           │             │             │
                         │ id (PK)   │             │ id (PK)     │
                         │ project_id│             │ dataset_id  │
                         │ dataset_id│             │ status      │
                         │ status    │             │ results(JSON│
                         │ quality_  │             │ quality_    │
                         │ score     │             │ score       │
                         │ quality_  │             │ task_id     │
                         │ gate_stat.│             │ progress    │
                         │ baseline_ │             └─────┬───────┘
                         │ analysis_ │                   │ 1:N
                         │ id (FK)   │             ┌─────▼───────┐
                         │ new_issues│             │   issues    │
                         │ fixed_iss.│             │  (legacy)   │
                         │ results   │             │             │
                         │ (JSONB)   │             │ fingerprint │
                         └────┬──────┘             │ severity    │
                              │ 1:N               │ description │
                         ┌────▼──────┐             └─────────────┘
                         │data_qual_ │
                         │issues     │
                         │           │
                         │ id (PK)   │
                         │ analysis_ │        ┌──────────────┐
                         │ run_id    │        │quality_gates │
                         │ fingerpr. │        │              │
                         │ severity  │        │ id (PK)      │
                         │ is_new    │        │ project_id   │
                         │ issue_type│        │ thresholds   │
                         │ descript. │        │ (JSONB)      │
                         │ affected_ │        │ is_active    │
                         │ columns   │        └──────────────┘
                         └───────────┘

                    ┌──────────────────┐
                    │ metric_templates │
                    │                  │
                    │ id (PK)          │
                    │ name             │
                    │ metrics (JSONB)  │
                    │ owner_id (FK)    │
                    │ is_system        │
                    └──────────────────┘
```

### Campos JSONB destacados

| Tabla | Campo | Contenido |
|-------|-------|-----------|
| `projects` | `metrics_config` | Array de configuraciones de métricas: `[{id, parameters, weight}]` |
| `datasets` | `schema` | Array de columnas con estadísticas: `[{name, type, mean, median, std, min, max, histogram}]` |
| `datasets` | `sensitive_columns` | Lista de nombres de columnas sensibles: `["email", "dni"]` |
| `analysis_runs` | `results` | Resultados completos de la evaluación por métrica |
| `quality_gates` | `thresholds` | Configuración: `{min_score, max_critical_issues, max_new_issues}` |
| `data_quality_issues` | `affected_columns` | Columnas afectadas con detalles específicos del issue |
| `data_quality_issues` | `affected_rows` | Filas afectadas con muestras (PII enmascarada) |

## 4.6 Almacenamiento de objetos (MinIO)

MinIO proporciona almacenamiento S3-compatible para los archivos de datasets originales. La separación entre almacenamiento de archivos binarios (MinIO) y metadatos relacionales (PostgreSQL) sigue el principio de responsabilidad única y optimiza cada sistema para su caso de uso.

**Configuración:**
- Bucket principal: `datasets`
- Los archivos se almacenan con nombres UUID para evitar colisiones.
- La referencia al archivo se guarda en el campo `file_path` de la tabla `datasets`.
- Se soportan URLs pre-firmadas para acceso temporal directo (expiración configurable, por defecto 1 hora).

**Operaciones disponibles via MinioService:**
- `upload_file()` / `upload_bytes()` — subida de archivos
- `download_file()` — descarga de archivos
- `delete_file()` — eliminación de archivos
- `get_presigned_url()` — generación de URL temporal de acceso

## 4.7 Procesamiento asíncrono

Las evaluaciones de calidad pueden ser costosas computacionalmente (especialmente para datasets grandes con múltiples métricas). DataQual utiliza **Celery** como sistema de colas de tareas para ejecutar evaluaciones de forma asíncrona sin bloquear la API.

### Configuración de Celery

```
Broker:            Redis (redis://redis:6379/0)
Backend:           Redis (misma instancia)
Serialización:     JSON
Zona horaria:      Europe/Madrid
Límite de tiempo:  3600 segundos (1 hora por tarea)
Concurrencia:      4 workers
Tareas por child:  200 (previene memory leaks)
Reintentos:        3 (con delay de 60 segundos)
Acknowledgement:   Late (tras completar, no al recibir)
```

### Tarea principal: `run_evaluation`

La tarea `run_evaluation` es un `@shared_task` con `bind=True` que:
1. Crea un contexto de aplicación Flask.
2. Actualiza el estado a "processing".
3. Crea un `AnalysisRun` con estado PENDING → RUNNING.
4. Invoca `EvaluationService.run_evaluation()`.
5. Actualiza progreso (0–100%) con descripciones de paso.
6. Al completar: actualiza tanto `Evaluation` como `AnalysisRun`.
7. En caso de error: marca como FAILED con `error_message`.

### Evaluation Watchdog

Un hilo daemon en el backend detecta evaluaciones que se han quedado atascadas (sin actualización de progreso durante más de 5 minutos) y las marca automáticamente como fallidas. Esto previene que evaluaciones colgadas bloqueen indefinidamente los recursos.

### Flower

Flower (`localhost:5555`) proporciona un dashboard web para monitorizar en tiempo real:
- Estado de los workers
- Cola de tareas pendientes
- Historial de ejecuciones
- Estadísticas de rendimiento

## 4.8 Comunicación entre componentes

| Origen | Destino | Protocolo | Mecanismo |
|--------|---------|-----------|-----------|
| Frontend | Backend | HTTP/JSON | API REST via Axios (rewrite `/api/*`) |
| Backend | PostgreSQL | TCP | SQLAlchemy ORM (pool de 10 conexiones) |
| Backend | MinIO | HTTP/S3 | Cliente MinIO Python (`minio` library) |
| Backend | Redis | TCP | Celery broker + Flask-Limiter storage |
| Celery Worker | Redis | TCP | Consume tareas del broker |
| Celery Worker | PostgreSQL | TCP | Actualiza progreso y resultados |
| Celery Worker | MinIO | HTTP/S3 | Descarga datasets para evaluación |

La autenticación entre Frontend y Backend se realiza mediante tokens JWT enviados en la cabecera `Authorization: Bearer <token>`. Los servicios internos (Worker → PostgreSQL/MinIO) utilizan credenciales configuradas por variables de entorno.

---

# 5. Motor de Métricas de Calidad

## 5.1 Arquitectura del motor

El motor de métricas de DataQual sigue una arquitectura de **plugins** que permite añadir nuevas métricas sin modificar el código existente. La arquitectura se compone de tres elementos:

### BaseMetric (clase abstracta)

```python
# backend/services/metrics/base.py

class BaseMetric(ABC):
    log_prefix: str = "METRIC"

    @abstractmethod
    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map) -> MetricResult:
        """Evalúa la métrica sobre el DataFrame proporcionado."""

    @staticmethod
    def calculate_dynamic_severity(actual_value, threshold, metric_type, higher_is_better):
        """Calcula la severidad de un issue según su distancia al umbral."""

    @staticmethod
    def generate_histogram(series, bins=10):
        """Genera datos de histograma para una serie numérica."""

    @staticmethod
    def infer_column_type(series, column_name):
        """Infiere el tipo semántico: ID, categorical, numeric, text."""

    @staticmethod
    def mask_sensitive(value, column, sensitive_columns):
        """Enmascara un valor si la columna es sensible."""
```

### MetricResult (dataclass)

```python
@dataclass
class MetricResult:
    metric_id: str            # Identificador de la métrica ("completeness", "uniqueness", etc.)
    score: Optional[float]    # Puntuación 0.0-1.0 (None si no se pudo calcular)
    results: dict             # Datos detallados para almacenar en AnalysisRun.results
    issues: list[dict]        # Lista de issues detectados
```

### METRIC_REGISTRY (registro)

Un diccionario que mapea identificadores de métrica a clases:

```python
METRIC_REGISTRY = {
    "completeness":        CompletenessMetric,
    "uniqueness":          UniquenessMetric,
    "syntactic_accuracy":  SyntacticAccuracyMetric,
    "logical_consistency": LogicalConsistencyMetric,
    "class_balance":       ClassBalanceMetric,
    "currentness":          currentnessMetric,
}
```

> **Nota:** `OutliersMetric` **no está en el registro**. La clase existe en
> `outliers.py` y se instancia directamente desde el pipeline de Data Profiling,
> pero no es una métrica puntuable (ISO/IEC 5259).

**Para añadir una nueva métrica** solo se necesitan 4 pasos:
1. Crear una clase que herede de `BaseMetric` e implemente `evaluate()`.
2. Registrarla en `METRIC_REGISTRY`.
3. Añadir la función de fingerprint en `fingerprint_utils.py`.
4. Documentarla en `docs/metricas/`.

## 5.2 Sistema de severidad dinámica

El método `calculate_dynamic_severity()` determina la severidad de cada issue basándose en la distancia entre el valor real y el umbral esperado. Existen 4 escalas según el tipo de métrica:

### Escala "higher is better" (completitud, unicidad, conformidad)

| Condición | Severidad |
|-----------|-----------|
| `valor ≥ umbral` | `low` (no hay problema real) |
| `valor < 0.50` | `critical` |
| `valor < 0.70` | `high` |
| `umbral - valor > 0.15` | `high` |
| `umbral - valor > 0.05` | `medium` |
| otro caso | `low` |

### Escala de outliers (proporción de valores atípicos)

| Proporción outliers | Severidad |
|---------------------|-----------|
| `≥ 20%` | `critical` |
| `≥ 10%` | `high` |
| `≥ 5%` | `medium` |
| `< 5%` | `low` |

### Escala de balance de clases (proporción de clase dominante)

| Proporción dominante | Severidad |
|----------------------|-----------|
| `≥ 99%` | `critical` |
| `≥ 95%` | `high` |
| `≥ 90%` | `medium` |

### Escala de actualidad (ratio antigüedad/umbral)

| Ratio (age/threshold) | Severidad |
|------------------------|-----------|
| `≥ 10` | `critical` |
| `≥ 3` | `high` |
| `≥ 1` | `medium` |
| `< 1` | `low` |

## 5.3 Métrica: Completitud (Completeness)

**Archivo:** `backend/services/metrics/completeness.py`
**ID:** `completeness`

### Fundamento teórico

La completitud es la dimensión de calidad más básica según ISO/IEC 25012. Mide el grado en que los datos esperados están realmente presentes en el dataset. Un valor nulo (NULL, NaN) representa información ausente que puede distorsionar cálculos estadísticos, provocar errores en modelos de ML o conducir a decisiones basadas en información parcial.

### Algoritmo

**Score global:**
- Si se especifican columnas: `completeness = media([1 - ratio_nulos(col) para col en columns])`
- Si no: `completeness = 1 - df.isna().mean().mean()` (media de las medias de nulos de todas las columnas)

**Issues generados:**
1. **Issue global:** si `completeness < threshold` (default 0.95). Lista las columnas con más nulos que el umbral.
2. **Issues por columna:** para cada columna con completitud < 98% (umbral fijo), se genera un issue individual.

**Parámetros:** `columns` (list), `threshold` (float, default 0.95), `weight` (float, default 1.0).

## 5.4 Métrica: Unicidad (Uniqueness)

**Archivo:** `backend/services/metrics/uniqueness.py`
**ID:** `uniqueness`

### Fundamento teórico

La unicidad mide la ausencia de duplicados en el dataset. Opera en dos niveles: filas completas (duplicados exactos) y variabilidad por columna (columnas con demasiado pocos valores distintos). Los duplicados inflan conteos, sesgan distribuciones y pueden causar data leakage en modelos de ML si los mismos registros aparecen en train y test.

### Algoritmo

**Unicidad de filas:** `row_uniqueness = filas_únicas / total_filas`

**Variabilidad por columna** con umbrales adaptativos según el tipo semántico:
- Columnas de ID (detectadas por patrón: `*_id`, `*_uuid`, `*_key`): umbral 0.95
- Columnas categóricas (≤20 valores únicos, no numérica): umbral 0.05
- Resto: umbral 0.30

**Issues generados:**
1. Baja variabilidad en columna (type `low_variability`)
2. Filas duplicadas (type `duplicate_rows`, con muestra de hasta 5 filas, PII enmascarada)
3. Columna de identificador no única (type `non_unique_identifier`, para columnas especificadas en `columns`)

**Parámetros:** `threshold` (float, default 1.0), `columns` (list de columnas que deben ser únicas), `weight`.

## 5.5 Herramienta de perfilado: Detección de Outliers

**Archivo:** `backend/services/metrics/outliers.py`
**ID:** `outliers` (solo perfilado — **no registrada en METRIC_REGISTRY**)

> **No es una métrica evaluable.** Según ISO/IEC 5259, la detección de outliers
> no constituye una dimensión de calidad de datos. La clase `OutliersMetric`
> existe como herramienta de diagnóstico y se invoca exclusivamente desde el
> pipeline de Data Profiling. No produce puntuación (`score = None`) ni
> contribuye al Quality Score.

### Fundamento técnico

Los outliers son observaciones que se desvían significativamente del resto del conjunto de datos. Pueden deberse a errores de medición, errores de entrada o eventos excepcionales reales. El sistema implementa dos métodos estadísticos clásicos:

**Método IQR (Rango Intercuartílico):**
```
Q1 = percentil 25
Q3 = percentil 75
IQR = Q3 - Q1
lower_bound = Q1 - factor × IQR
upper_bound = Q3 + factor × IQR
outlier = valor < lower_bound OR valor > upper_bound
```

**Método Z-Score:**
```
z = (valor - media) / desviación_estándar
outlier = |z| > factor
```

### Resultado

La clase genera issues informativos (uno por columna con al menos un valor atípico), con severidad dinámica según la proporción de outliers en esa columna. No se calcula ningún score.

**Parámetros:** `method` ("iqr"|"zscore", default "iqr"), `factor` (float, default 1.5), `columns` (list, default: todas las numéricas).

## 5.6 Métrica: Exactitud Sintáctica (Syntactic Accuracy)

**Archivo:** `backend/services/metrics/syntactic_accuracy.py`
**ID:** `syntactic_accuracy`

### Fundamento teórico

La exactitud sintáctica mide si los valores de cada columna respetan el formato esperado para su tipo de dato. Es una validación estructural: no evalúa si el valor es semánticamente correcto, sino si cumple el patrón formal esperado (por ejemplo, que un email tenga formato `usuario@dominio.tld`).

### Catálogo de 13 tipos predefinidos

| Tipo | Ejemplo |
|------|---------|
| `email` | usuario@dominio.com |
| `url` | https://ejemplo.com |
| `phone_es` | 612345678, +34612345678 |
| `phone_intl` | +1 800 555-1234 |
| `dni_es` | 12345678A |
| `date_iso` | 2024-03-15 |
| `date_eu` | 15/03/2024 |
| `integer` | 42, -100 |
| `decimal` | 3.14, 2,50 |
| `uuid` | 550e8400-e29b-41d4-... |
| `ip_v4` | 192.168.1.1 |
| `postal_code_es` | 28001 |
| `credit_card` | 4111 1111 1111 1111 |

### Auto-detección de tipos

Para columnas de tipo `object` sin configuración explícita, la métrica toma una muestra de hasta 100 valores y prueba todos los 13 patrones. Se asigna el tipo con mayor tasa de coincidencia si supera el **60%**.

**Parámetros:** `columns` (list de {column, expected_type, pattern}), `custom_patterns` (dict), `auto_detect_types` (bool, default true), `threshold` (float, default 0.95), `weight`.

## 5.7 Métrica: Consistencia Lógica (Logical Consistency)

**Archivo:** `backend/services/metrics/logical_consistency.py`
**ID:** `logical_consistency`

### Fundamento teórico

La consistencia lógica valida reglas de negocio que establecen relaciones entre columnas. Son restricciones semánticas del dominio que ninguna otra métrica puede capturar: "si el estado es 'pagado', la fecha de pago no puede ser nula", "el precio de venta siempre debe superar al coste", etc.

### Tipos de reglas

**IF-THEN:** condición → aserción. Se parsea automáticamente desde expresiones con formato `IF condición THEN aserción` (también soporta `Si ... Entonces`, `WHEN ... THEN`, `Cuando ... Entonces`).

```python
# Ejemplo: IF status == 'active' THEN end_date == end_date  (no null)
cond_rows = df.query(condition)
passing = cond_rows.query(assertion)
violations = len(cond_rows) - len(passing)
compliance = 1 - (violations / total_rows)
```

**Violación directa:** expresión pandas query que selecciona filas que violan la regla.

### Seguridad

Antes de ejecutar cualquier regla, se verifica que no contenga tokens peligrosos que podrían permitir inyección de código:

```python
FORBIDDEN_TOKENS = [
    "import", "__", "exec", "eval", "compile",
    "globals", "locals", "getattr", "setattr", "delattr",
    "open", "os.", "sys.", "subprocess", "shutil",
    "lambda", "def ", "class ",
]
```

Las reglas con tokens prohibidos se bloquean y generan un issue de severidad `high`.

**Parámetros:** `rules` (list de {name, type, expression, condition, assertion}), `weight`.

## 5.8 Métrica: Equilibrio de Clases (Class Balance)

**Archivo:** `backend/services/metrics/class_balance.py`
**ID:** `class_balance`

### Fundamento teórico

El equilibrio de clases es una métrica específica para proyectos de aprendizaje automático supervisado. Un dataset con clases muy desequilibradas produce modelos sesgados que predicen siempre la clase mayoritaria, obteniendo una precisión artificialmente alta sin aprender patrones reales de la clase minoritaria.

La métrica utiliza la **entropía de Shannon** como medida de equilibrio:

```
H = -Σ(p_i × log₂(p_i))        (entropía)
H_max = log₂(n_clases)          (entropía máxima: distribución uniforme)
Balance Index = (H / H_max) × 100    (0 = desequilibrio total, 100 = equilibrio perfecto)
```

### Auto-detección de columnas categóricas

Si `auto_detect=True`, se analizan automáticamente las columnas que cumplan:
- Tipo `object` o `category`, con ≤ `max_cardinality` valores únicos (default 50).
- Tipo entero con ≤ 20 valores únicos.
- Más de 1 valor único.

### Issues generados

1. **Clase dominante:** si la proporción de la clase más frecuente `≥ imbalance_threshold_high` (default 0.90).
2. **Clase minoritaria:** si la proporción de la clase menos frecuente `≤ imbalance_threshold_low` (default 0.05).

**Parámetros:** `columns` (list), `auto_detect` (bool, default true), `max_cardinality` (int, default 50), `imbalance_threshold_high` (float, default 0.90), `imbalance_threshold_low` (float, default 0.05), `weight`.

## 5.9 Métrica: Actualidad (currentness)

**Archivo:** `backend/services/metrics/currentness.py`
**ID:** `currentness`

### Fundamento teórico

La actualidad mide la frescura de los datos: cuánto tiempo ha pasado desde el valor de fecha más reciente de cada columna temporal. Un dataset puede ser completo, único y consistente pero estar obsoleto, lo que lo hace inadecuado para tomar decisiones o entrenar modelos sobre la situación actual.

### Algoritmo de frescura

```
age_days = (now - max_date).days

if age_days ≤ staleness_threshold:
    freshness = 1.0
else:
    freshness = max(0.0, 1.0 - (age_days - threshold) / threshold)
```

La degradación es **lineal** entre el umbral y 2× el umbral:
- 0 días → 1.0 (perfecto)
- Exactamente el umbral → 1.0
- 1.5× el umbral → 0.5
- 2× el umbral → 0.0 (máxima penalización)

### Auto-detección de columnas de fecha

Si `auto_detect=True`:
- Columnas con dtype `datetime64` se incluyen directamente.
- Columnas de tipo `object`: se parsea una muestra de 50 valores; si ≥50% se parsea como fecha, se incluye.

### Issue adicional: baja tasa de parseo

Si menos del 80% de los valores de una columna se parsean correctamente como fechas, se genera un issue de severidad `low` advirtiendo que algunos valores pueden no ser fechas válidas.

**Parámetros:** `columns` (list), `auto_detect` (bool, default true), `staleness_threshold_days` (int, default 30), `weight`.

## 5.10 Fórmula del Quality Score

El Quality Score es la puntuación global que resume la calidad del dataset en una sola cifra (0–100 en la interfaz, 0.0–1.0 internamente).

```
base_score = media(score_métrica_i × peso_i  para cada métrica evaluada)

penalización = (nº issues HIGH × 0.05)
             + (nº issues MEDIUM × 0.025)
             + (nº issues LOW × 0.01)

quality_score = max(0.0, min(1.0, base_score − penalización))
```

El sistema de **pesos** permite que cada métrica contribuya proporcionalmente al score global. Por defecto, todas las métricas tienen peso 1.0. Si una métrica devuelve `score=None` (por ejemplo, consistencia lógica sin reglas configuradas), se excluye de la media.

La **penalización por issues** reduce el score después de calcular la media base. Esto significa que un dataset puede tener buenas puntuaciones en todas las métricas pero recibir una penalización si genera muchos issues de severidad media o alta.

## 5.11 Sistema de fingerprints

Cada issue detectado recibe un **fingerprint**: un hash SHA-256 truncado a 16 caracteres hexadecimales, generado a partir de los atributos que definen la identidad del issue.

### Componentes del fingerprint

```python
fingerprint = sha256(
    issue_type + "|" +
    column_name + "|" +
    row_identifier + "|" +
    rule_key + "|" +
    sorted(extra_params)
)[:16]
```

El fingerprint es **determinista**: el mismo problema en el mismo dataset con la misma configuración siempre genera el mismo hash. Esto permite rastrear issues entre ejecuciones.

### Funciones especializadas

| Tipo de issue | Función | Componentes |
|---------------|---------|-------------|
| Completitud | `generate_column_issue_fingerprint()` | tipo + columna + umbral |
| Unicidad | `generate_duplicate_issue_fingerprint()` | tipo + nivel (fila/columna) |
| Variabilidad | `generate_issue_fingerprint()` | tipo + columna + umbral adaptativo |
| Outliers | `generate_outlier_issue_fingerprint()` | columna + método + factor |
| Exactitud sintáctica | `generate_syntactic_accuracy_fingerprint()` | columna + tipo esperado + patrón |
| Consistencia lógica | `generate_logical_consistency_fingerprint()` | expresión + nombre de regla |
| Balance de clases | `generate_class_balance_fingerprint()` | columna + tipo de desequilibrio |
| Actualidad | `generate_currentness_fingerprint()` | columna + umbral de staleness |

## 5.12 Comparación con baseline

Al finalizar cada evaluación, el servicio compara los fingerprints actuales con los de la **evaluación baseline** (la ejecución anterior completada para el mismo proyecto).

```
fingerprints_actuales = {fp1, fp2, fp3, fp4, fp5}
fingerprints_baseline = {fp1, fp3, fp6, fp7}

issues_nuevos     = actuales - baseline = {fp2, fp4, fp5}     → 3
issues_corregidos = baseline - actuales = {fp6, fp7}           → 2
issues_recurrentes = actuales ∩ baseline = {fp1, fp3}          → 2
```

Cada issue en el `AnalysisRun` actual se marca con `is_new=True` si su fingerprint no existía en el baseline, o `is_new=False` si es recurrente.

Los contadores `new_issues_count`, `fixed_issues_count` y `recurrent_issues_count` se almacenan en el `AnalysisRun` y se muestran en la interfaz con badges visuales.

---

# 6. Funcionalidades Clave

## 6.1 Gestión de proyectos

Los proyectos son la unidad organizativa principal de DataQual. Cada proyecto agrupa datasets, configuraciones de métricas, historial de evaluaciones y un Quality Gate.

**Operaciones:**
- Crear proyecto (nombre, descripción, configuración inicial de métricas).
- Consultar lista de proyectos del usuario con conteo de datasets y score de última evaluación.
- Editar nombre, descripción y configuración de métricas.
- Eliminar proyecto (cascade: elimina datasets, evaluaciones e issues asociados).

**Aislamiento:** cada proyecto pertenece a un usuario (`owner_id`). Las operaciones verifican que el usuario autenticado sea el propietario del proyecto.

## 6.2 Gestión de datasets

### Upload de archivos

Los usuarios pueden subir archivos en los formatos CSV, XLSX, XLS, JSON y Parquet con un límite de 100 MB (configurable).

### Parseo robusto de CSV

El servicio `DatasetService._read_csv_robust()` implementa una estrategia de fallback múltiple para parsear archivos CSV con diferentes codificaciones y delimitadores:

1. Detección de formato: rechaza archivos XLSX y gzipped mislabeled como CSV.
2. Detección de delimitador: usa `csv.Sniffer` sobre las primeras 5000 bytes.
3. Matriz de fallback: prueba combinaciones de:
   - **Codificaciones:** UTF-8, UTF-8-BOM, CP1252, Latin-1
   - **Separadores:** detectado, coma, punto y coma, tabulador, pipe
   - **Motores pandas:** Python, C

### Extracción de esquema

Al subir un dataset, se extrae automáticamente:
- Nombre y tipo de cada columna.
- Estadísticas descriptivas: media, mediana, desviación estándar, mínimo, máximo.
- Conteos: filas totales, columnas totales, valores faltantes por columna.
- Histogramas para columnas numéricas.

### Marcado de columnas sensibles

Los usuarios pueden marcar columnas como sensibles (PII). Esta información se almacena en el campo JSONB `sensitive_columns` del dataset y es respetada por todas las métricas del sistema, que enmascaran los valores con `"***"` en sus resultados.

## 6.3 Versionado de datasets

DataQual implementa un sistema de versionado para rastrear la evolución de un dataset a lo largo del tiempo:

- Cada dataset tiene un `parent_dataset_id` opcional que apunta a su versión anterior.
- El campo `version` (entero) se incrementa automáticamente.
- El flag `is_latest` indica cuál es la versión más reciente.
- Se soportan `version_tag` para etiquetar versiones específicas.

**Métodos de navegación:**
- `get_version_history()`: devuelve todas las versiones ordenadas cronológicamente.
- `get_latest_version()`: obtiene la versión más reciente.
- `get_root_dataset()`: navega hasta la versión original.
- `get_previous_version()`: obtiene la versión anterior.

La interfaz permite comparar dos versiones lado a lado mediante la página `/datasets/compare`.

## 6.4 Configuración de métricas

### Estructura de configuración

La configuración de métricas se almacena como JSONB en el proyecto y se copia a cada evaluación:

```json
{
  "metrics": [
    {
      "id": "completeness",
      "parameters": { "threshold": 0.98, "columns": ["email", "nombre"] },
      "weight": 1.0
    },
    {
      "id": "outliers",
      "parameters": { "method": "iqr", "factor": 1.5 },
      "weight": 0.8
    },
    {
      "id": "class_balance",
      "parameters": { "imbalance_threshold_high": 0.90 },
      "weight": 1.0
    }
  ]
}
```

### Plantillas de métricas

Las plantillas (`MetricTemplate`) permiten guardar y reutilizar configuraciones:
- **Plantillas del sistema** (`is_system=true`): predefinidas, disponibles para todos los usuarios.
- **Plantillas de usuario** (`owner_id` asignado): personales, solo visibles para su creador.

### Interfaz de configuración

La página de configuración (`/metrics/configure/[id]`) ofrece:
- Selector de plantillas para carga rápida.
- Formularios dinámicos por métrica con controles adaptados al tipo de parámetro (sliders para umbrales, checkboxes para booleanos, listas para arrays).
- Editor especializado para reglas de consistencia lógica.
- Validación de configuración antes de guardar.

## 6.5 Ejecución de evaluaciones

### Flujo asíncrono

1. El usuario lanza una evaluación desde la interfaz o vía API.
2. Se crea un registro `Evaluation` con estado `pending` y un `AnalysisRun` con estado `PENDING`.
3. Se encola una tarea Celery (`run_evaluation`).
4. El worker procesa la evaluación actualizando el progreso (0-100%).
5. El frontend consulta el estado periódicamente (polling) y muestra una barra de progreso.
6. Al completar, se muestran los resultados en la interfaz.

### Fallback síncrono

Si Celery no está disponible, el `HybridEvaluationService` ejecuta la evaluación de forma síncrona en el mismo proceso del backend, garantizando que la funcionalidad esté disponible incluso sin workers.

## 6.6 Quality Gates

Los Quality Gates son puntos de decisión configurables que determinan si un dataset cumple los requisitos mínimos de calidad para su uso.

### Configuración

Cada proyecto puede tener un Quality Gate con umbrales:

| Umbral | Default | Descripción |
|--------|---------|-------------|
| `min_score` | 70 | Quality Score mínimo (escala 0-100) |
| `max_critical_issues` | 0 | Máximo de issues con severidad critical |
| `max_new_issues` | 10 | Máximo de issues nuevos respecto al baseline |

### Evaluación

Al finalizar cada análisis, el sistema evalúa el Quality Gate:

```
Si critical_issues_count > max_critical_issues → FAILED
Si quality_score < min_score → FAILED
Si cumple todo pero algún criterio está al límite → WARNING
Si cumple todo con margen → PASSED
```

### Visualización

El resultado del Quality Gate se muestra como un badge visual prominente:
- **PASSED** (verde): el dataset cumple todos los umbrales.
- **WARNING** (amarillo): cumple pero con margen estrecho.
- **FAILED** (rojo): al menos un umbral incumplido.

## 6.7 Dashboards y visualizaciones

### Dashboard principal (`/dashboard`)

- Tarjetas resumen: número de proyectos, datasets y media de calidad.
- Gráfico doughnut de distribución de Quality Gates (PASSED/WARNING/FAILED/Sin análisis).
- Top 5 proyectos que necesitan atención (ordenados por score más bajo).

### Resultados de evaluación (`/evaluations/[id]`)

- **Quality Score Gauge:** medidor circular de 0 a 100.
- **Pestañas por métrica:** componentes especializados para cada tipo de métrica:
  - CompletenessDetail, UniquenessDetail, OutlierDetail, SyntacticAccuracyDetail, LogicalConsistencyDetail, ClassBalanceDetail, currentnessDetail.
- **Tabla de métricas por columna:** completitud, unicidad, estadísticas descriptivas.
- **Lista de issues:** con severidad, descripción, columnas y filas afectadas.

### Profiling de datos (`/datasets/[id]` → tab Profiling)

El componente `DataProfilingTab` (~1955 líneas) proporciona un análisis exploratorio completo:
- Resumen del dataset (filas, columnas, % datos faltantes, duplicados).
- Tipo de datos por columna (numérico vs categórico).
- Para columnas numéricas: histograma, boxplot, estadísticas (media, mediana, std, min, max, Q1, Q3, IQR, asimetría, curtosis).
- Para columnas categóricas: bar chart de frecuencias, moda.
- Matrices de correlación: Pearson y Spearman, con selector.
- Detección de outliers con factor IQR configurable interactivamente.

### Gráficos de tendencia

- **QualityTrendChart:** evolución del Quality Score a lo largo del tiempo.
- **VersionEvolutionChart:** evolución de métricas entre versiones del dataset.
- **AnalysisHistory:** timeline de ejecuciones pasadas con estados.

## 6.8 Comparación entre ejecuciones

El sistema de fingerprinting permite comparar dos ejecuciones consecutivas y visualizar:

- **Issues nuevos:** aparecen por primera vez (badge verde "new").
- **Issues corregidos:** estaban en el baseline pero ya no (badge gris "fixed").
- **Issues recurrentes:** persisten entre ejecuciones.
- **Contadores:** `new_issues_count`, `fixed_issues_count`, `recurrent_issues_count` en cada AnalysisRun.

La selección del baseline es automática (última ejecución completada del mismo proyecto) o explícita (vía `baseline_analysis_id`).

## 6.9 Gestión de datos sensibles

La protección de datos personales identificables (PII) está integrada en el núcleo del sistema:

**Marcado:** el usuario marca columnas como sensibles durante el upload o edición del dataset.

**Comportamiento en métricas:** cada una de las 7 métricas respeta la lista de columnas sensibles:
- Los valores de ejemplo en issues se reemplazan por `"***"`.
- Los duplicados muestran `"***"` en las columnas sensibles de la muestra.
- Los outliers no muestran valores de muestra ni estadísticas detalladas.
- El balance de clases muestra `"***"` en nombres de clases y tabla de frecuencias.
- La consistencia lógica enmascara columnas sensibles en las filas de violación.

**Comportamiento en esquema:** el endpoint de dataset redacta las estadísticas de columnas sensibles (media, mediana, std, histograma, etc.).

---

# 7. Pila Tecnológica y Justificación

## 7.1 Frontend

| Tecnología | Versión | Justificación |
|-----------|---------|---------------|
| **Next.js** | 13.3 | Framework React con SSR, file-based routing, API rewrites para proxy al backend, optimización automática, modo standalone para Docker. |
| **React** | 18 | Biblioteca estándar para interfaces de usuario. Hooks y Context API eliminan la necesidad de Redux. Concurrent features para mejor rendimiento. |
| **TypeScript** | 5.0 | Tipado estático que detecta errores en compilación. Esencial para mantener un frontend de 40+ componentes y 300+ líneas de interfaces. |
| **Material UI (MUI)** | 5.12 | Biblioteca de componentes completa con theming, responsive design y accesibilidad. Reduce el tiempo de desarrollo de la UI significativamente. |
| **Chart.js** | 4.2 | Librería de gráficos ligera con soporte para histogramas, scatter, doughnut, line. `react-chartjs-2` como wrapper React. |
| **Three.js** | 0.160 | Renderizado 3D para el fondo de partículas en la página de autenticación. Diferenciación visual de la plataforma. |
| **Axios** | 1.3 | Cliente HTTP con interceptores para inyección automática de JWT, manejo de errores centralizado y timeouts configurables. |
| **react-hook-form** | 7.43 | Gestión de formularios con validación, rendimiento optimizado (sin re-renders innecesarios). |
| **react-dropzone** | 14.2 | Componente de upload drag-and-drop para la carga de datasets. |
| **SWR** | 2.1 | Fetching de datos con caché stale-while-revalidate para mejor experiencia de usuario. |

## 7.2 Backend

| Tecnología | Versión | Justificación |
|-----------|---------|---------------|
| **Flask** | 2.2 | Framework web minimalista y flexible. Ideal para APIs REST. Extenso ecosistema de plugins. No impone estructura, permitiendo una arquitectura a medida. |
| **Python** | 3.10 | Lenguaje estándar en ciencia de datos e IA. Excelente integración con pandas, numpy y scikit-learn para cálculos de métricas. |
| **SQLAlchemy** | 2.0 | ORM maduro con soporte completo para PostgreSQL (JSONB, enums, cascades). Previene inyección SQL. Pool de conexiones integrado. |
| **Flask-JWT-Extended** | 4.4 | Autenticación JWT con tokens de acceso y refresco, blacklisting, manejo de errores personalizado. |
| **Flask-Migrate** | 4.0 | Migraciones de BD versionadas con Alembic. Permite evolucionar el esquema de forma controlada. |
| **Flask-Limiter** | 3.3 | Rate limiting para protección contra abuso. Backend Redis para entornos distribuidos. |
| **Pandas** | 1.5 | Manipulación de datos tabular. Usado para leer datasets, calcular métricas y generar estadísticas. |
| **NumPy** | 1.24 | Cálculos numéricos eficientes. Histogramas, percentiles, operaciones vectoriales. |
| **Gunicorn** | 20.1 | Servidor WSGI de producción. Multi-proceso para manejar concurrencia. |
| **Marshmallow** | 3.19 | Validación y serialización de datos de entrada en la API. |
| **structlog** | 23.1 | Logging estructurado para mejor observabilidad y depuración. |

## 7.3 Base de datos

| Tecnología | Versión | Justificación |
|-----------|---------|---------------|
| **PostgreSQL** | 14 | SGBD relacional maduro con soporte nativo para JSONB (esquemas flexibles), tipos ENUM (estados), índices avanzados, ACID compliance. Ideal para combinar datos estructurados (relaciones entre entidades) con datos semi-estructurados (configuraciones, resultados). |

**Uso de JSONB:** PostgreSQL permite almacenar y consultar campos JSON con rendimiento nativo. DataQual usa JSONB para: configuraciones de métricas (flexibles por proyecto), resultados de evaluaciones (estructura variable por métrica), esquemas de datasets (número variable de columnas), y umbrales de Quality Gates.

## 7.4 Almacenamiento de objetos

| Tecnología | Versión | Justificación |
|-----------|---------|---------------|
| **MinIO** | latest | Almacenamiento S3-compatible, self-hosted. Separa archivos binarios de datos relacionales. Consola web en puerto 9001. Compatible con cualquier SDK S3. Garantiza soberanía de datos (sin dependencia cloud). |

## 7.5 Procesamiento asíncrono

| Tecnología | Versión | Justificación |
|-----------|---------|---------------|
| **Celery** | 5.2 | Cola de tareas distribuida, estándar en Python. Soporte para reintentos, timeouts, tracking de progreso. Escalable horizontalmente añadiendo workers. |
| **Redis** | 6 | Rol dual: broker de mensajes para Celery y storage para rate limiter. In-memory para baja latencia. |
| **Flower** | 1.2 | Dashboard web para monitorización en tiempo real de workers, tareas y colas. Esencial para diagnóstico en desarrollo y producción. |

## 7.6 Infraestructura

| Tecnología | Justificación |
|-----------|---------------|
| **Docker** | Contenedorización de cada servicio. Aislamiento de dependencias, portabilidad, reproducibilidad. |
| **Docker Compose** | Orquestación de los 8 servicios con healthchecks, volúmenes persistentes, red interna y variables de entorno. Un solo comando (`docker-compose up`) levanta todo el stack. |

---

# 8. Seguridad

## 8.1 Autenticación JWT

DataQual implementa autenticación basada en JSON Web Tokens (JWT) con dos tipos de token:

- **Access Token:** duración de 24 horas (3600 segundos configurable). Se envía en cada petición protegida via cabecera `Authorization: Bearer <token>`.
- **Refresh Token:** duración de 30 días (2.592.000 segundos). Permite obtener un nuevo access token sin re-autenticarse.

**Blacklisting:** el sistema mantiene un conjunto en memoria de JTI (JWT ID) revocados para invalidar tokens antes de su expiración (por ejemplo, al hacer logout).

**Flujo de autenticación:**
1. Usuario envía credenciales a `POST /api/auth/login`.
2. Backend verifica contraseña con `check_password_hash()`.
3. Si es válido, genera access_token y refresh_token.
4. Frontend almacena el token en localStorage.
5. Axios interceptor inyecta el token en cada petición.
6. Si el token expira, frontend usa refresh_token para obtener uno nuevo.
7. Si el refresh_token también ha expirado, redirige a `/auth`.

## 8.2 Hashing de contraseñas

Las contraseñas se almacenan hasheadas con **PBKDF2-SHA256** (via Werkzeug):

```python
# Al registrar:
password_hash = generate_password_hash(password)  # PBKDF2 + salt aleatorio

# Al autenticar:
is_valid = check_password_hash(user.password_hash, password)
```

**Características:**
- Salt aleatorio por contraseña (previene ataques de rainbow table).
- Múltiples iteraciones de hash (computacionalmente costoso para prevenir fuerza bruta).
- Mínimo 6 caracteres de contraseña requerido.

## 8.3 Rate Limiting

Flask-Limiter protege la API contra abuso:

```
Límite por defecto: 100 peticiones por minuto por IP
Storage: Redis (para entornos con múltiples workers)
Respuesta al exceder: HTTP 429 Too Many Requests
```

## 8.4 CORS

Cross-Origin Resource Sharing configurado con:
- Orígenes permitidos via variable de entorno `CORS_ORIGINS` (default: `http://localhost:3000`).
- Credenciales habilitadas (necesarias para cookies JWT).
- Max-age de 600 segundos para preflight cache.

## 8.5 Cabeceras de seguridad

El middleware de peticiones añade cabeceras de seguridad a todas las respuestas:

| Cabecera | Valor | Propósito |
|----------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-Frame-Options` | `DENY` | Previene clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Activa protección XSS del navegador |
| `X-Request-ID` | UUID generado | Trazabilidad de peticiones |
| `X-Response-Time` | milisegundos | Monitorización de rendimiento |

## 8.6 Validación de entrada

- **Marshmallow schemas:** validación de estructura y tipos en payloads de API.
- **Validación de email:** verificación de formato (contiene `@`).
- **Validación de archivo:** extensiones permitidas (csv, xlsx, xls, json, parquet), tamaño máximo (100 MB).
- **Validación de metric_id:** solo se aceptan IDs registrados en `METRIC_REGISTRY`.
- **Detección de duplicados:** no se permiten métricas repetidas en la misma configuración.

## 8.7 Ocultación de datos sensibles (PII)

Las columnas marcadas como sensibles reciben protección en múltiples capas:

1. **En métricas:** todos los valores de muestra se reemplazan por `"***"`. Las estadísticas detalladas se omiten.
2. **En esquema:** los endpoints de dataset redactan estadísticas de columnas sensibles.
3. **En el modelo:** `User.to_dict(include_sensitive=False)` excluye datos sensibles del usuario por defecto.
4. **En serialización:** contraseñas, tokens y datos internos nunca aparecen en respuestas de API.

## 8.8 Seguridad en consistencia lógica

Las reglas de consistencia lógica se ejecutan mediante `pandas.DataFrame.query()`, que interpreta expresiones Python. Para prevenir inyección de código, se implementa una lista de tokens prohibidos:

```python
FORBIDDEN_TOKENS = [
    "import", "__", "exec", "eval", "compile",
    "globals", "locals", "getattr", "setattr", "delattr",
    "open", "os.", "sys.", "subprocess", "shutil",
    "lambda", "def ", "class ",
]
```

Si una regla contiene cualquiera de estos tokens, se bloquea su ejecución y se genera un issue de severidad `high` informando del bloqueo.

## 8.9 Seguridad de infraestructura

- **Variables de entorno:** secrets (JWT_SECRET_KEY, DB credentials, MinIO keys) se configuran via variables de entorno, nunca hardcodeados.
- **Red Docker aislada:** los servicios se comunican a través de `app-network` (bridge), sin exponer puertos internos innecesariamente.
- **Healthchecks:** PostgreSQL, MinIO y Redis incluyen healthchecks que verifican su disponibilidad antes de iniciar servicios dependientes.
- **Pool de conexiones:** SQLAlchemy configura pool_size=10, pool_recycle=3600 y pool_pre_ping=True para prevenir conexiones stale.

---

# 9. Flujo de Datos y Evaluación End-to-End

## 9.1 Flujo de subida de dataset

```
Usuario                Frontend              Backend API           MinIO           PostgreSQL
  │                      │                      │                   │                │
  │  Selecciona archivo  │                      │                   │                │
  │─────────────────────►│                      │                   │                │
  │                      │  POST /api/projects/ │                   │                │
  │                      │  {id}/datasets       │                   │                │
  │                      │  (multipart/form)    │                   │                │
  │                      │─────────────────────►│                   │                │
  │                      │                      │  upload_file()    │                │
  │                      │                      │──────────────────►│                │
  │                      │                      │  ◄── object_name  │                │
  │                      │                      │                   │                │
  │                      │                      │  Parsea CSV/XLSX  │                │
  │                      │                      │  Extrae esquema   │                │
  │                      │                      │  Cuenta filas/cols│                │
  │                      │                      │                   │                │
  │                      │                      │  INSERT dataset   │                │
  │                      │                      │──────────────────────────────────►│
  │                      │                      │  ◄──────────────── dataset_id     │
  │                      │                      │                   │                │
  │                      │  ◄── { dataset }     │                   │                │
  │  ◄── Vista dataset   │                      │                   │                │
```

## 9.2 Flujo de configuración de métricas

```
Usuario                Frontend                   Backend API        PostgreSQL
  │                      │                           │                  │
  │  Abre /metrics/      │                           │                  │
  │  configure/[id]      │                           │                  │
  │─────────────────────►│                           │                  │
  │                      │  GET /api/projects/{id}/  │                  │
  │                      │  metrics/config           │                  │
  │                      │──────────────────────────►│                  │
  │                      │                           │  SELECT project  │
  │                      │                           │─────────────────►│
  │                      │  ◄── metrics_config       │                  │
  │                      │                           │                  │
  │  Ajusta parámetros,  │                           │                  │
  │  selecciona métricas │                           │                  │
  │─────────────────────►│                           │                  │
  │                      │  POST /api/projects/{id}/ │                  │
  │                      │  metrics/config           │                  │
  │                      │  { metrics: [...] }       │                  │
  │                      │──────────────────────────►│                  │
  │                      │                           │  UPDATE project  │
  │                      │                           │  SET metrics_    │
  │                      │                           │  config = ...    │
  │                      │                           │─────────────────►│
  │                      │  ◄── { success }          │                  │
```

## 9.3 Flujo de evaluación asíncrona

```
Usuario      Frontend        Backend API      Redis/Celery      Worker           PostgreSQL    MinIO
  │            │                │                │                │                  │            │
  │  Lanza     │                │                │                │                  │            │
  │  evaluación│                │                │                │                  │            │
  │───────────►│                │                │                │                  │            │
  │            │ POST /api/     │                │                │                  │            │
  │            │ evaluations/   │                │                │                  │            │
  │            │───────────────►│                │                │                  │            │
  │            │                │ INSERT eval    │                │                  │            │
  │            │                │ (pending)      │                │                  │            │
  │            │                │────────────────────────────────────────────────────►            │
  │            │                │                │                │                  │            │
  │            │                │ Encola tarea   │                │                  │            │
  │            │                │───────────────►│                │                  │            │
  │            │ ◄── {eval_id,  │                │                │                  │            │
  │            │      task_id}  │                │                │                  │            │
  │            │                │                │  Consume tarea │                  │            │
  │            │                │                │───────────────►│                  │            │
  │            │                │                │                │                  │            │
  │            │                │                │                │  5% Inicializa   │            │
  │            │                │                │                │─────────────────►│            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 10% Download     │            │
  │            │                │                │                │  dataset         │            │
  │            │                │                │                │─────────────────────────────►│
  │            │                │                │                │ ◄── bytes        │            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 20% Read CSV     │            │
  │            │                │                │                │                  │            │
  │  Polling   │                │                │                │ 25-70% Ejecuta   │            │
  │  status    │                │                │                │ cada métrica     │            │
  │───────────►│ GET /api/      │                │                │                  │            │
  │            │ evaluations/   │                │                │                  │            │
  │            │ {id}/status    │                │                │                  │            │
  │            │───────────────►│                │                │                  │            │
  │            │ ◄── {progress: │                │                │                  │            │
  │            │      45%}      │                │                │                  │            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 75-90% Métricas  │            │
  │            │                │                │                │ por columna      │            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 92% Quality Score│            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 95% Guarda issues│            │
  │            │                │                │                │─────────────────►│            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 98% Quality Gate │            │
  │            │                │                │                │                  │            │
  │            │                │                │                │ 100% Finaliza    │            │
  │            │                │                │                │─────────────────►│            │
  │            │                │                │                │                  │            │
  │  Polling   │ GET status     │                │                │                  │            │
  │───────────►│───────────────►│                │                │                  │            │
  │            │ ◄── {status:   │                │                │                  │            │
  │            │  completed,    │                │                │                  │            │
  │            │  score: 85}    │                │                │                  │            │
  │            │                │                │                │                  │            │
  │ ◄── Muestra│                │                │                │                  │            │
  │  resultados│                │                │                │                  │            │
```

### Tabla de progreso detallada

| Progreso | Paso | Descripción |
|----------|------|-------------|
| 5% | Inicialización | Crea AnalysisRun, valida configuración |
| 10% | Descarga | Descarga archivo del dataset desde MinIO |
| 20% | Lectura | Parsea el archivo a DataFrame de pandas |
| 25–70% | Evaluación | Ejecuta cada métrica configurada (distribuido proporcionalmente) |
| 75–90% | Métricas columna | Calcula completitud, unicidad y estadísticas por columna |
| 92% | Quality Score | Calcula base_score, penalización e issues |
| 95% | Persistencia | Guarda issues en la tabla data_quality_issues |
| 98% | Quality Gate | Evalúa umbrales del Quality Gate |
| 100% | Finalización | Compara con baseline, marca como COMPLETED |

## 9.4 Flujo de comparación con baseline

```
Al finalizar la evaluación:

1. Buscar baseline:
   - Si analysis_run.baseline_analysis_id está definido → usar ese
   - Si no → buscar el AnalysisRun más reciente COMPLETED del mismo proyecto

2. Si existe baseline:
   fingerprints_actuales = {issues actuales}.fingerprint
   fingerprints_baseline = {issues del baseline}.fingerprint

   new_issues     = actuales - baseline
   fixed_issues   = baseline - actuales
   recurrent      = actuales ∩ baseline

3. Marcar cada issue actual:
   issue.is_new = (issue.fingerprint NOT IN fingerprints_baseline)

4. Actualizar AnalysisRun:
   analysis_run.new_issues_count = len(new_issues)
   analysis_run.fixed_issues_count = len(fixed_issues)
   analysis_run.recurrent_issues_count = len(recurrent)
```

## 9.5 Flujo del Quality Gate

```
Entrada:
  quality_score = 85.3  (escala 0-100)
  critical_issues_count = 0
  new_issues_count = 3
  thresholds = { min_score: 70, max_critical_issues: 0, max_new_issues: 10 }

Evaluación:
  ¿critical_issues_count (0) > max_critical_issues (0)?  → NO
  ¿quality_score (85.3) < min_score (70)?                → NO
  ¿new_issues_count (3) > max_new_issues (10)?           → NO

Resultado: PASSED
```

## 9.6 Flujo de visualización

Una vez que la evaluación se completa, el frontend solicita los resultados completos:

1. `GET /api/evaluations/{id}` → resultados completos con métricas, score y issues.
2. Los componentes React renderizan:
   - `QualityScoreGauge`: medidor circular con el score.
   - `QualityGateBadge`: badge PASSED/WARNING/FAILED.
   - `MetricDetailsTabs`: una pestaña por métrica con visualización específica.
   - `ColumnMetricsTable`: tabla con métricas por columna.
   - `IssuesSummary` / `IssuesList`: resumen y detalle de issues.
3. Los datos se cachean en el estado del componente para navegación rápida entre pestañas.

---

# 10. Resultados y Discusión

## 10.1 Resultados alcanzados

DataQual es una plataforma funcional end-to-end que cumple con los 5 objetivos específicos definidos en el anteproyecto:

**Cuantitativamente:**

| Dimensión | Cantidad |
|-----------|----------|
| Métricas de calidad implementadas | 7 |
| Servicios Docker | 8 |
| Rutas/páginas del frontend | 20 |
| Componentes React reutilizables | 40+ |
| Módulos de API (blueprints) | 6 |
| Tablas en base de datos | ~9 |
| Patrones de formato predefinidos | 13 (syntactic accuracy) |
| Tipos de issue | 10+ (por métrica y subtipo) |
| Migraciones de base de datos | 8+ |
| Tests automatizados | 3 suites (quality gate, versioning, API) |

**Cualitativamente:**

- El motor de métricas es extensible: añadir una nueva métrica requiere solo crear una clase, registrarla y documentarla.
- El sistema de fingerprinting permite rastrear la evolución de la calidad entre ejecuciones, una capacidad que pocas herramientas de código abierto ofrecen.
- Los Quality Gates proporcionan una señal binaria clara que puede integrarse en pipelines automatizados.
- El profiling de datos interactivo (histogramas, boxplots, correlaciones) ofrece un análisis exploratorio completo sin salir de la plataforma.
- La protección de PII está integrada en todas las métricas, no como un añadido posterior.

## 10.2 Fortalezas de la plataforma

1. **Arquitectura extensible por plugins.** El patrón BaseMetric + Registry permite añadir métricas sin tocar código existente. Los 4 pasos para añadir una métrica están documentados.

2. **Fingerprinting para trazabilidad.** La capacidad de rastrear el mismo issue entre ejecuciones (nuevo/recurrente/corregido) es única entre herramientas open-source de este nicho.

3. **Quality Gates inspirados en SonarQube.** Trasladan un concepto probado en calidad de código al dominio de calidad de datos.

4. **Full-stack self-hosted.** Todo el stack se ejecuta con un solo `docker-compose up`. No hay dependencias de servicios cloud propietarios. Los datos permanecen en la infraestructura del usuario.

5. **PII handling nativo.** La protección de datos sensibles no es una capa opcional sino un comportamiento integrado en cada métrica y cada endpoint.

6. **Parseo robusto de CSV.** La matriz de fallback (codificaciones × separadores × motores) maneja archivos CSV "del mundo real" que fallan con parsers estándar.

7. **Métricas específicas para ML.** Class balance (entropía de Shannon) y currentness no están presentes en la mayoría de herramientas de calidad de datos generalistas.

8. **Procesamiento asíncrono con resiliencia.** Celery con reintentos, watchdog para tareas atascadas y fallback síncrono garantizan que las evaluaciones siempre se completen.

## 10.3 Limitaciones actuales

1. **Autenticación limitada.** Solo JWT básico (usuario/contraseña). No hay soporte para OAuth 2.0, SSO (SAML/LDAP), ni autenticación multi-factor.

2. **Sin exportación de informes.** No se pueden exportar resultados a PDF, Excel o formatos de informe formal.

3. **Sin documentación Swagger/OpenAPI.** La API no tiene documentación interactiva generada automáticamente (previsto en el anteproyecto).

4. **Polling en lugar de WebSockets.** El frontend consulta el estado de las evaluaciones periódicamente en lugar de recibir notificaciones push, lo que introduce latencia y carga innecesaria.

5. **Escalabilidad limitada a un nodo.** Aunque Celery soporta escalado horizontal teóricamente, no se ha probado con múltiples workers distribuidos.

6. **Datasets en memoria.** Pandas carga el dataset completo en memoria. Datasets mayores que la RAM disponible no pueden procesarse. No hay soporte para streaming o procesamiento chunk-based.

7. **Sin detección de anomalías basada en ML.** Solo métodos estadísticos clásicos (IQR, Z-score). No hay detección basada en Isolation Forest, DBSCAN u otros algoritmos de ML.

8. **Componente monolítico de profiling.** `DataProfilingTab.tsx` tiene ~1.955 líneas, lo que dificulta su mantenimiento y testing.

9. **Tests limitados.** Solo 3 suites de tests cubriendo quality gates y versionado. Sin tests de integración para el flujo completo de evaluación.

## 10.4 Comparación con herramientas existentes

| Criterio | DataQual | Great Expectations | Apache Deequ | DQOps |
|----------|----------|-------------------|--------------|-------|
| **Enfoque** | Full-stack web para IA | Librería Python | Librería Spark | Plataforma web |
| **Requiere código** | No (UI) + Sí (API) | Sí (Python) | Sí (Scala/PySpark) | Parcial |
| **UI integrada** | Sí (Next.js) | No (solo Data Docs) | No | Sí |
| **Quality Gates** | Sí (3 criterios) | No nativo | No | Sí |
| **Issue tracking** | Fingerprints SHA-256 | No | No | Parcial |
| **Diff entre runs** | Sí (new/fixed/recurrent) | No | Parcial | Sí |
| **Métricas ML** | Sí (class balance, currentness) | No | Parcial | No |
| **PII masking** | Sí (nativo) | No | No | No |
| **Versionado datasets** | Sí (parent-child) | No | No | No |
| **Async** | Sí (Celery) | No | Sí (Spark) | Sí |
| **Self-hosted** | Sí (Docker) | Sí | Sí | Sí |
| **Escalabilidad** | Media (single-node) | Baja | Alta (Spark) | Media |
| **Madurez** | TFG / Prototipo | Producción | Producción | Producción |

**Conclusión de la comparación:** DataQual no compite directamente con herramientas maduras de producción como Great Expectations en escala o ecosistema, pero ofrece una combinación única de: interfaz web completa + métricas específicas para ML + fingerprinting + Quality Gates + PII handling, todo en un paquete self-hosted y sin necesidad de programar.

## 10.5 Líneas futuras de trabajo

1. **Documentación Swagger/OpenAPI** para la API RESTful, cumpliendo el objetivo del anteproyecto.
2. **Exportación de informes** a PDF y Excel para stakeholders no técnicos.
3. **WebSockets** para notificaciones push de progreso de evaluaciones.
4. **OAuth 2.0 y SSO** para integración con sistemas empresariales de identidad.
5. **Evaluaciones programadas** (Celery Beat) para monitorización continua de calidad.
6. **Detección de anomalías basada en ML** (Isolation Forest, Autoencoders) como métrica adicional.
7. **Procesamiento chunk-based** para datasets que excedan la memoria RAM.
8. **Integración con bases de datos** (PostgreSQL, MySQL, BigQuery) como fuente directa de datos.
9. **Colaboración en equipo** con roles y permisos granulares.
10. **Webhooks** para notificar a sistemas externos cuando una evaluación completa o un Quality Gate falla.
11. **Internacionalización (i18n)** completa de la interfaz.
12. **Dark mode** y personalización de tema.
13. **Sugerencias de corrección automatizadas** basadas en los issues detectados (cumpliendo el OE5 del anteproyecto).

---

# 11. Correspondencia con Secciones del TFG

Este documento está diseñado para servir como fuente principal de contenido para las secciones formales del TFG. La siguiente tabla establece la correspondencia entre las secciones de este documento y los capítulos estándar de un Trabajo Fin de Estudios:

| Capítulo del TFG | Secciones fuente de este documento | Notas |
|-------------------|------------------------------------|-------|
| **Introducción** | §1 (Visión General) + §2.1-2.2 (Contexto) | Motivación del problema, presentación de la solución, estructura del documento. |
| **Estado del Arte** | §2 completo (Contexto y Justificación) | Marco teórico (calidad de datos, data-centric AI), estándares ISO, análisis de herramientas existentes, diferenciación. |
| **Objetivos** | §3 (Objetivos del Proyecto) | Objetivo general + 5 específicos + transversales. Copiar/adaptar directamente. |
| **Metodología** | — (no cubierto explícitamente) | Describir: desarrollo iterativo, prototipado, selección tecnológica, entorno de desarrollo (Docker), testing. Consultar `docs/GUIA_PRUEBAS_MANUALES.md`. |
| **Desarrollo / Implementación** | §4 (Arquitectura) + §5 (Motor de Métricas) + §6 (Funcionalidades) + §7 (Pila Tecnológica) + §8 (Seguridad) | Este es el bloque principal del TFG. Arquitectura, diseño de métricas, funcionalidades implementadas, decisiones tecnológicas, seguridad. |
| **Resultados** | §9 (Flujo End-to-End) + capturas de pantalla | Demostrar que el sistema funciona end-to-end. Incluir capturas de: dashboard, resultados de evaluación, Quality Gate, profiling. |
| **Discusión** | §10 (Resultados y Discusión) | Fortalezas, limitaciones, comparación con alternativas. Reflexión crítica sobre lo conseguido. |
| **Conclusiones** | §10.1 (resumen de logros) + §10.5 (trabajo futuro) | Verificar cumplimiento de cada objetivo. Lecciones aprendidas. |
| **Trabajo Futuro** | §10.5 (Líneas futuras) | Extensiones posibles de la plataforma. |
| **Apéndices** | Documentación existente en `docs/` | A: Referencia de API (`docs/API_*.md`). B: Guía de pruebas manuales. C: Documentación de métricas (`docs/metricas/`). D: Esquema DDL de base de datos. |

### Recomendaciones para la redacción del TFG

1. **Introducción:** arrancar con el problema (§1.2), presentar la solución (§1.1) y cerrar con la estructura del documento. ~5-8 páginas.

2. **Estado del Arte:** es la sección más académica. Ampliar §2 con citas formales (IEEE, ACM). Incluir la tabla comparativa de §2.3 y la tabla de correspondencia ISO de §2.2. ~15-20 páginas.

3. **Objetivos:** sección corta y directa. Copiar los objetivos y añadir una frase que anticipe dónde se verifica cada uno. ~3-5 páginas.

4. **Metodología:** describir el proceso de desarrollo (ágil, iterativo), las herramientas usadas (VS Code, Git, Docker), y la estrategia de testing. ~5-8 páginas.

5. **Desarrollo:** la sección más extensa. Organizar por subsistemas (backend, frontend, métricas, seguridad). Incluir diagramas de arquitectura, fragmentos de código relevantes y capturas de pantalla. ~30-40 páginas.

6. **Resultados y Discusión:** demostrar el funcionamiento con un caso práctico (subir un dataset real, evaluar, interpretar resultados). Ser honesto con las limitaciones (§10.3). ~10-15 páginas.

7. **Conclusiones:** verificar cada objetivo del §3 contra lo implementado. ~3-5 páginas.

---

*Este documento ha sido generado como material base para el TFG "Creación de una Plataforma/API para la Evaluación de Calidad de Datos en Proyectos de IA" (DataQual). Curso académico 2025-2026, Universidad de Castilla-La Mancha.*
