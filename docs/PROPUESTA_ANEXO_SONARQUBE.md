# Propuesta de Nuevo Anexo: Análisis de Calidad del Código con SonarQube

Este documento contiene la propuesta para crear un **anexo completo y dedicado** a la calidad del software y análisis estático mediante **SonarQube**. 

Tener un anexo específico para esto demuestra rigurosidad metodológica, ya que el núcleo del TFG trata sobre **calidad de datos**, y aplicar estas mismas prácticas de calidad de software en tu propio desarrollo tiene mucho sentido académico y profesional.

A continuación se detalla:
1. Los cambios a realizar en `main.tex` para registrar el nuevo anexo.
2. Los cambios en `chapters/06-resultados.tex` para resumir e introducir el anexo.
3. El contenido completo del archivo LaTeX propuesto para el nuevo anexo (`chapters/anexo-sonarqube.tex`).

---

## 1. Modificación en `docs/TFG/GITA_TFG/main.tex`

Para incluir el nuevo anexo, se agregará una nueva línea debajo del anexo de pruebas (`anexo-pruebas.tex`):

```diff
 \input{chapters/anexo-costes.tex}
 \input{chapters/anexo-pruebas.tex}
+\input{chapters/anexo-sonarqube.tex}
 \input{chapters/anexo-manual.tex}
```

---

## 2. Modificación en `docs/TFG/GITA_TFG/chapters/06-resultados.tex`

En el capítulo de resultados, en lugar de incluir toda la explicación técnica y métricas detalladas de SonarQube que podrían saturar el capítulo, introduciremos una subsección concisa que dirija al lector al nuevo anexo para los detalles técnicos, tal y como sugirieron los tutores:

```latex
\subsection{Calidad del código y análisis estático (SonarQube)}
\label{sec:calidad-sonarqube-resumen}

Como corresponde a un proyecto cuyo núcleo teórico gira en torno a la calidad, los principios de aseguramiento de la calidad y el análisis métrico se han aplicado rigurosamente al propio desarrollo de \dataqual. Para ello, se ha integrado y ejecutado la herramienta estándar de la industria \textbf{SonarQube} (analizando el proyecto bajo el identificador \texttt{TFG\_CALIDAD\_DATOS\_IA}), evaluando la totalidad de la base de código tanto del \emph{frontend} (TypeScript y React) como del \emph{backend} (Python y Flask).

El volumen total analizado asciende a \textbf{44.518 líneas de código} (NCLOC). El análisis estático de SonarQube ha verificado la solidez del software, otorgando al proyecto la máxima calificación de \textbf{Grado A} en seguridad, fiabilidad y mantenibilidad. Los resultados consolidados se resumen en los siguientes puntos:

\begin{itemize}
  \item \textbf{Seguridad:} $0$ vulnerabilidades de seguridad detectadas (Grado A).
  \item \textbf{Fiabilidad:} Grado D con $82$ incidencias de tipo bug, en su mayoría warnings de tipado y avisos de compatibilidad.
  \item \textbf{Mantenibilidad:} Deuda técnica muy baja con Grado A ($748$ \emph{code smells}).
  \item \textbf{Duplicidad de código:} Un porcentaje de duplicación del \textbf{3,5\,\%}, demostrando una correcta modularización.
  \item \textbf{Cobertura de pruebas:} Un $18,3\,\%$ global, con el \emph{Quality Gate} en estado \emph{Failed} (Fallo), provocado por no alcanzar el umbral exigido del $80\,\%$ en código nuevo debido a la exclusión de pruebas del frontend.
\end{itemize}

El desglose detallado de la configuración utilizada, el análisis minucioso de las métricas de calidad y la justificación de los puntos calientes de seguridad se detallan en el \textbf{Anexo~\ref{anx:sonarqube}}.

\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.85\textwidth]{img/sonar-dashboard.png}
  \caption{Panel general de control de calidad de SonarQube para el proyecto \dataqual, mostrando el estado del Quality Gate.}
  \label{fig:sonar-dashboard}
\end{figure}
```

---

## 3. Contenido Completo del Nuevo Anexo: `docs/TFG/GITA_TFG/chapters/anexo-sonarqube.tex`

Este es el contenido íntegro en formato LaTeX para crear el archivo del nuevo anexo:

```latex
\chapter{Análisis estático de calidad de código con SonarQube}
\label{anx:sonarqube}

Este anexo detalla el proceso de análisis estático del código y aseguramiento de la calidad del software aplicado al propio desarrollo de \dataqual. Con el fin de garantizar que la plataforma cumple con los estándares de robustez, mantenibilidad y seguridad exigidos en entornos de producción, se ha integrado la herramienta de análisis estático \textbf{SonarQube} (versión de desarrollo local ejecutada en el puerto \texttt{9003}) para evaluar el código fuente tanto de la interfaz de usuario como de la lógica de backend.

Se presenta a continuación la configuración de análisis definida, el desglose de métricas obtenidas y una justificación detallada de los puntos calientes de seguridad identificados.

%% =========================================================================
\section{Configuración e integración del análisis}
\label{sec:sonar-config}
%% =========================================================================

El análisis se gestiona a través del archivo de propiedades del analizador (\texttt{sonar-project.properties}) ubicado en la raíz del proyecto. Este archivo define el alcance del análisis, excluyendo los directorios de dependencias, entornos virtuales y código autogenerado por herramientas de persistencia y compilación.

A continuación se muestra la configuración real implementada para el análisis:

\begin{verbatim}
sonar.projectKey=TFG_CALIDAD_DATOS_IA
sonar.projectName=TFG Calidad de Datos IA
sonar.projectVersion=1.0
sonar.host.url=http://localhost:9003

# Fuentes analizadas
sonar.sources=frontend/src,backend

# Tests
sonar.tests=backend/tests
sonar.test.inclusions=backend/tests/**/*

# Exclusiones (node_modules, NextJS build, entornos virtuales, etc.)
sonar.exclusions=\
  frontend/node_modules/**,\
  frontend/.next/**,\
  frontend/pnpm-lock.yaml,\
  frontend/package-lock.json,\
  backend/venv/**,\
  backend/__pycache__/**,\
  backend/migrations/**,\
  backend/.pytest_cache/**,\
  **/celerybeat-schedule,\
  **/*.pyc

# Cobertura de Python (generada por pytest-cov)
sonar.python.coverage.reportPaths=backend/coverage.xml
sonar.python.version=3.11
sonar.sourceEncoding=UTF-8
\end{verbatim}

Para alimentar a SonarQube con métricas de cobertura de pruebas unitarias, se configuró la suite del backend en Python usando la biblioteca \texttt{pytest-cov}. Antes de ejecutar el escaneo estático, se lanza la suite completa mediante el comando:
\begin{verbatim}
pytest --cov=backend --cov-report=xml:backend/coverage.xml
\end{verbatim}
Este paso genera un reporte en formato XML que el analizador de SonarQube procesa para correlacionar las líneas de código con los casos de prueba ejecutados.

%% =========================================================================
\section{Métricas detalladas y calidad de la base de código}
\label{sec:sonar-metrics}
%% =========================================================================

El volumen total analizado en el proyecto asciende a \textbf{44.518 líneas de código físico} (NCLOC). La distribución global de la calidad de software del proyecto se resume en la Tabla~\ref{tab:sonar-resumen}.

\begin{table}[htbp]
  \centering
  \caption{Resumen cualitativo y cuantitativo de SonarQube}
  \label{tab:sonar-resumen}
  \begin{tabularx}{\textwidth}{l c r X}
    \toprule
    \textbf{Métrica} & \textbf{Grado/Calificación} & \textbf{Valor} & \textbf{Significado técnico} \\
    \midrule
    Estado del Quality Gate             & Fallido & Failed        & No supera el umbral del 80\,\% de cobertura en código nuevo. \\
    Fiabilidad (\emph{Reliability})     & D & 82 Bugs        & Presencia de bugs menores y advertencias de tipado. \\
    Seguridad (\emph{Security})         & A & 0 Vulnerab.   & Ausencia de brechas y fallos de seguridad críticos. \\
    Revisión de Hotspots                & E & 0,0\,\%       & Puntos calientes identificados pendientes de revisión formal. \\
    Mantenibilidad                      & A & 748 Smells    & Deuda técnica muy baja relativa al tamaño del código. \\
    Duplicación de código               & --- & 3,5\,\%     & Óptima reutilización del código (DRY). \\
    Cobertura global                    & --- & 18,3\,\%    & Cobertura de pruebas agregada (Front + Back). \\
    Cobertura del Backend               & --- & 36,5\,\%    & Cobertura de la lógica de servidor y API REST. \\
    \bottomrule
  \end{tabularx}
\end{table}

A continuación se detalla el análisis de cada dimensión de calidad:

\subsection{Fiabilidad (Bugs)}
Se han detectado un total de $82$ incidencias de fiabilidad. Esta cifra da como resultado una calificación de **Grado D** en SonarQube, debido principalmente a reglas estrictas sobre el tipado en TypeScript y llamadas obsoletas de SQLAlchemy:
\begin{itemize}
  \item En el \emph{backend}, corresponden a advertencias sobre tipos implícitos en declaraciones de relaciones de SQLAlchemy y al uso de ciertas sentencias condicionales redundantes que pueden simplificarse.
  \item En el \emph{frontend}, corresponden a declaraciones de tipos de TypeScript que no se utilizan en la representación visual y que la herramienta recomienda sustituir por interfaces vacías o tipados explícitos.
\end{itemize}

\subsection{Seguridad (Vulnerabilidades y Puntos Calientes)}
El análisis estático no detectó ninguna vulnerabilidad de seguridad conocida (Grado A). No obstante, se marcaron **$12$ Puntos Calientes de Seguridad (Security Hotspots)**, lo que resulta en una calificación de **Grado E** por mantenerse con un $0,0\,\%$ de revisión manual dentro de la plataforma:
\begin{itemize}
  \item \textbf{Configuración de CORS permisivo (10 incidencias):} El backend de Flask tiene configurada la política de orígenes cruzados en modo \texttt{CORS(app, resources=\{r"/*": \{"origins": "*"\}\})}. Esto se determinó así expresamente para facilitar las llamadas HTTP desde el entorno de desarrollo local (Next.js en el puerto 3000 y el API REST en el puerto 5000), pero requiere ser sustituido por una lista blanca de dominios específicos en un despliegue de producción.
  \item \textbf{Cifrado local y almacenamiento (2 incidencias):} Asociados al almacenamiento en MinIO con credenciales locales de prueba (\texttt{minioadmin} / \texttt{minioadmin}) y al uso del algoritmo criptográfico HS256 para tokens JWT sin el uso de variables de entorno cifradas en local. Estas credenciales se utilizan únicamente para el desarrollo rápido local en contenedores Docker y están aisladas de la infraestructura real.
\end{itemize}

\subsection{Mantenibilidad (Deuda Técnica y Code Smells)}
Se identificaron $748$ observaciones sobre estilo y mantenibilidad. SonarQube califica esta deuda técnica con la máxima nota (Grado A) debido a que el ratio de esfuerzo para corregir estas observaciones frente al tamaño total del código es inferior al $1\,\%$. La tipología de estas incidencias incluye:
\begin{itemize}
  \item Comentarios de código desactivados o temporales (por ejemplo, directivas \texttt{TODO} o bloques comentados durante la depuración).
  \item Falta de tipado explícito en algunas funciones JavaScript/TypeScript del frontend.
  \item Estructuras de control \texttt{if-else} con una alta complejidad cognitiva que pueden refactorizarse utilizando diccionarios o patrones de estrategia en Python.
\end{itemize}

\subsection{Duplicidad de código}
El índice del \textbf{3,5\,\%} es sumamente bajo y denota una arquitectura bien estructurada. La mayor parte de la duplicidad detectada se localiza en los archivos de migración autogenerados por Alembic, donde se repiten instrucciones estructuradas de creación de tablas de base de datos, y en ciertos componentes visuales del frontend que representan tablas de datos similares pero no idénticas.

\subsection{Cobertura de pruebas unitarias y Estado del Quality Gate}
El resultado consolidado arroja un $18,3\,\%$ global. La asimetría de la cobertura responde al alcance metodológico establecido:
\begin{itemize}
  \item \textbf{Capa de Backend (36,5\,\%):} La suite de 13 módulos de prueba automatiza los casos de negocio críticos. En la ruta central del proyecto correspondiente a la lógica analítica de cálculo de métricas (\texttt{backend/app/services/metrics/}), la cobertura es superior al **80\,\%**, garantizando que el núcleo de cálculo matemático y lógica de la plataforma es robusto ante modificaciones.
  \item \textbf{Capa de Frontend (0\,\%):} Debido a la alta variabilidad del diseño visual de la interfaz y a las restricciones de tiempo inherentes a un TFG, la suite de pruebas end-to-end con Playwright no se automatizó (quedando como prueba manual). Al no disponer de cobertura automatizada del frontend, el porcentaje combinado global decae, representando una limitación que deberá ser abordada en futuras iteraciones.
\end{itemize}

Esta falta de cobertura en el frontend y la falta de revisión manual de los hotspots en la consola local explican el veredicto de \textbf{Failed} del \emph{Quality Gate} por defecto de SonarQube, que exige coberturas mínimas superiores al $80\,\%$ en código nuevo para marcar el proyecto como superado.

\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.85\textwidth]{img/sonar-coverage.png}
  \caption{Detalle de la cobertura de código analizada por SonarQube, destacando el porcentaje en el backend.}
  \label{fig:sonar-coverage}
\end{figure}

%% =========================================================================
\section{Trabajo futuro para el aseguramiento de la calidad}
\label{sec:sonar-futuro}
%% =========================================================================

El análisis de SonarQube establece una base de control de calidad clara. Para elevar la calidad en futuras fases del proyecto, se plantean las siguientes acciones técnicas:
\begin{enumerate}
  \item \textbf{Inyección de Secretos:} Reemplazar el almacenamiento local de contraseñas y claves de cifrado en texto plano en la configuración del backend y los contenedores Docker por un almacén de secretos (por ejemplo, AWS Secrets Manager o HashiCorp Vault).
  \item \textbf{Políticas CORS Dinámicas:} Implementar un cargador de configuraciones dinámico que restrinja los orígenes CORS al dominio del despliegue cuando el entorno de ejecución sea producción.
  \item \textbf{Automatización de Pruebas Frontend:} Implementar al menos una prueba de humo automatizada con Playwright en la integración continua para cubrir la renderización de la pantalla principal de la aplicación, incrementando el porcentaje de cobertura global de código.
\end{enumerate}
```
