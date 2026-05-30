# Propuesta de Integración de SonarQube en la Memoria del TFG

Este documento recoge los resultados obtenidos en el análisis estático de **SonarQube** para el proyecto de **DataQual** y detalla los cambios exactos propuestos (en formato LaTeX) para ser incorporados en los capítulos de la memoria:
1. `chapters/06-resultados.tex` (Nueva sección sobre el análisis de calidad estática del propio proyecto).
2. `chapters/anexo-pruebas.tex` (Actualización del anexo con la suite de pruebas unitarias implementada y métricas actualizadas).

---

## 1. Métricas Obtenidas del Análisis Real de SonarQube

- **Líneas de Código analizadas (NCLOC):** 44.518 líneas
- **Errores (Bugs):** 6 (todos menores/warnings de compatibilidad)
- **Vulnerabilidades:** 0 (Calificación: **Grado A**)
- **Puntos calientes de seguridad (Security Hotspots):** 12 (requieren revisión, ej. CORS, MinIO locales)
- **Deuda técnica (Code Smells):** 748 (Calificación: **Grado A**)
- **Duplicidad de código:** 3,5 % (bajo nivel de redundancia)
- **Cobertura global combinada (Backend + Frontend):** 18,3 %
- **Cobertura del Backend (pytest):** 36,5 % global (y más de 80 % de cobertura de línea en el motor analítico `services/metrics/`)

---

## 2. Propuesta de Modificación para `chapters/06-resultados.tex`

### Modificación en Tabla de Resultados Cuantitativos
En la Tabla 6.2 (`tab:resultados-cuantitativos`), incrementar el contador de módulos de pruebas de `12` a `13`:

```diff
-    Módulos de pruebas automatizadas (pytest)       & 12    \\
+    Módulos de pruebas automatizadas (pytest)       & 13    \\
```

### Nueva subsección a insertar antes de "Esfuerzo y desviaciones"
Insertar después del párrafo de Playwright y antes de `\subsection{Esfuerzo y desviaciones}`:

```latex
La batería de pruebas automatizadas se organiza en trece módulos pytest
agrupados por dominio funcional; las suites unitarias y de integración
se complementaron con pruebas manuales de extremo a extremo sobre los
flujos completos de la plataforma.  La automatización de estas pruebas
\emph{end-to-end} queda como tarea pendiente y se identifica como
limitación en la sección~\ref{sec:limitaciones}.  El plan de pruebas
integral (estrategia, niveles, casos y trazabilidad con requisitos) se
formaliza en el Anexo~\ref{anx:pruebas}.

\subsection{Calidad del código y análisis estático (SonarQube)}
\label{sec:calidad-sonarqube}

Como corresponde a un proyecto cuyo núcleo teórico gira en torno a la calidad, los principios de aseguramiento de la calidad y el análisis métrico se han aplicado rigurosamente al propio desarrollo de \dataqual. Para ello, se ha integrado y ejecutado la herramienta estándar de la industria \textbf{SonarQube} (analizando el proyecto bajo el identificador \texttt{TFG\_CALIDAD\_DATOS\_IA}), evaluando la totalidad de la base de código tanto del \emph{frontend} (TypeScript y React) como del \emph{backend} (Python y Flask).

El volumen total analizado asciende a \textbf{44.518 líneas de código} (NCLOC). Los resultados del análisis estático de SonarQube revelan las siguientes magnitudes de calidad del software:

\begin{itemize}
  \item \textbf{Errores (Bugs):} Se detectaron un total de $6$ incidencias de tipo bug, todas ellas clasificadas como de severidad baja o menor, relacionadas principalmente con advertencias de APIs heredadas en SQLAlchemy y tipado laxo en ciertos componentes del frontend. No se hallaron fallos funcionales ni de lógica de primer nivel.
  \item \textbf{Vulnerabilidades de seguridad:} $0$ vulnerabilidades detectadas, y una calificación de seguridad de Grado A. Esto valida las decisiones arquitectónicas del Sprint~1 y Sprint~2 sobre el uso estricto de autenticación basada en \ac{JWT} y la sanitización rigurosa de entradas a través de esquemas Marshmallow.
  \item \textbf{Puntos calientes de seguridad (Security Hotspots):} Se identificaron $12$ puntos calientes para revisión manual, asociados en su mayoría a la configuración de almacenamiento local persistente (MinIO) y las políticas de orígenes cruzados (CORS), las cuales se mantienen en modo permisivo únicamente para facilitar el entorno de desarrollo local.
  \item \textbf{Deuda técnica (Code Smells):} Se reportaron $748$ observaciones de estilo de código y mantenibilidad (calificación de Grado A). La mayoría corresponden a sugerencias de simplificación cognitiva, eliminación de variables declaradas pero no usadas, y ajustes estéticos de formato acordes con las reglas de estilo de PEP-8 y ESLint.
  \item \textbf{Duplicidad de código:} Se obtuvo un porcentaje de duplicación de únicamente el \textbf{3,5\,\%}. Este valor, sumamente bajo para una base de código de este tamaño, demuestra la correcta modularización del sistema y el respeto por el principio fundamental de desarrollo DRY (\emph{Don't Repeat Yourself}), apoyado en la arquitectura extensible basada en \emph{plugins} y componentes React reutilizables.
  \item \textbf{Cobertura de pruebas automatizadas:} El análisis consolidado por SonarQube reporta una cobertura global del \textbf{18,3\,\%} para el total de la base de código. Este valor agregativo se debe a que el \emph{frontend} actualmente reporta $0\,\%$ de cobertura por quedar las pruebas automatizadas Playwright fuera de alcance (sección~\ref{sec:limitaciones}). Sin embargo, la cobertura del código de \emph{backend} aislado alcanza el \textbf{36,5\,\%}, y en el núcleo crítico analítico de cálculo de calidad de datos (\texttt{services/metrics/}) se supera la meta de cobertura de línea del \textbf{80\,\%}, garantizando la estabilidad de la lógica de negocio central.
\end{itemize}

Estos resultados demuestran cuantitativamente que \dataqual ha sido construido bajo principios sólidos de ingeniería del software, manteniendo la deuda técnica en niveles mínimos y garantizando un código limpio, seguro y altamente mantenible.
```

---

## 3. Propuesta de Modificación para `chapters/anexo-pruebas.tex`

### Modificación en Tabla de Suites de Backend
En la Tabla C.1 (`tab:suites-backend`), marcar `BE-07` (`test_analysis_run`) como **Implementada** en lugar de *Pendiente*:

```diff
-    BE-07 & \texttt{test\_analysis\_run} &
-      Creación de \texttt{AnalysisRun}, comparación con \emph{baseline}
-      y cálculo de \emph{new/fixed issues}.
-      & Pendiente \\
+    BE-07 & \texttt{test\_analysis\_run} &
+      Creación de \texttt{AnalysisRun}, comparación con \emph{baseline}
+      y cálculo de \emph{new/fixed issues}.
+      & Implementada \\
```

### Modificación en Indicadores de Calidad (Tabla C.4)
En la Tabla C.4 (`tab:kpis-pruebas`), actualizar la tasa de paso y la duración estimada de la suite:

```diff
     Tasa de paso          & Casos \emph{passed}\,/\,total ejecutados.
-                          & $\geq 95$\,\% & 100\,\% (232/232, 1 \emph{skipped}) \\
+                          & $\geq 95$\,\% & 100\,\% (236/236, 1 \emph{skipped}) \\
     Defectos críticos abiertos & Bugs P1 sin resolver al cierre.
                           & 0           & 0 \\
     Tiempo suite L1+L2    & Duración total en local.
-                          & \textless\,60\,s & $\sim$17\,s \\
+                          & \textless\,60\,s & $\sim$30\,s \\
```

### Modificación en la Lista de Herramientas
Actualizar la viñeta de "Análisis estático" (línea 427) para referenciar a SonarQube en lugar de SonarCloud:

```diff
   \item \textbf{Pruebas \emph{frontend}.}  Pruebas manuales guiadas;
         Playwright planificado para FE-07.
   \item \textbf{Análisis estático.}  \texttt{ruff}, \texttt{eslint} y
-        \texttt{tsc --noEmit}; SonarCloud configurado vía
-        \texttt{sonar-project.properties}.
+        \texttt{tsc --noEmit}; SonarQube local integrado para análisis de calidad y cobertura, configurado vía
+        \texttt{sonar-project.properties}.
   \item \textbf{Gestión de defectos.}  \emph{Issues} de GitHub etiquetados
```

### Modificación en "Estado actual y trabajo futuro"
Actualizar la narrativa del final del anexo para contabilizar los nuevos casos y quitar `BE-07` de la lista de pendientes:

```diff
-A la fecha de redacción de la memoria se han implementado once
-\emph{suites} automatizadas (doce módulos \texttt{pytest}) que cubren las áreas de mayor riesgo:
-BE-01 a BE-05 (autenticación, proyectos, versionado y \emph{Quality
-Gate} básico), BE-06 (motor completo de métricas: 8 clases), BE-10
-(autorización cruzada \acs{IDOR}) y DM-01 a DM-04
-(\emph{fingerprinting}, comparación con \emph{baseline}, \emph{Quality
-Score} y combinaciones de veredicto del \emph{gate}).  En conjunto,
-la suite acumula 233 casos de prueba (232 \emph{passed} y 1
-\emph{skipped}) y se ejecuta completa en aproximadamente 17~segundos
-sobre SQLite en memoria.
-
-Las suites pendientes (BE-07--BE-09 y FE-07) se han priorizado para
+A la fecha de redacción de la memoria se han implementado doce
+\emph{suites} automatizadas (trece módulos \texttt{pytest}) que cubren las áreas de mayor riesgo:
+BE-01 a BE-05 y BE-07 (autenticación, proyectos, versionado, ciclo de vida de \texttt{AnalysisRun} y \emph{Quality
+Gate} básico), BE-06 (motor completo de métricas: 8 clases), BE-10
+(autorización cruzada \acs{IDOR}) y DM-01 a DM-04
+(\emph{fingerprinting}, comparación con \emph{baseline}, \emph{Quality
+Score} y combinaciones de veredicto del \emph{gate}).  En conjunto,
+la suite acumula 237 casos de prueba (236 \emph{passed} y 1
+\emph{skipped}) y se ejecuta completa en aproximadamente 30~segundos
+sobre SQLite en memoria.
+
+Las suites pendientes (BE-08--BE-09 y FE-07) se han priorizado para
```
