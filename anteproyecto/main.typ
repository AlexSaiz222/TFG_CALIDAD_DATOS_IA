// ============================================================================
// Anteproyecto TFG — Typst
// Grado en Ingeniería Informática
// Facultad de Ciencias Sociales de Talavera — UCLM
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// COLORES Y CONFIGURACIÓN DE DISEÑO
// ─────────────────────────────────────────────────────────────────────────────

#let color-uclm = rgb("#8B1A1A")       // Granate UCLM
#let color-accent = rgb("#000000")      // Negro (sustituido del azul)
#let color-light = rgb("#F5F5F5")       // Gris muy claro para fondos
#let color-rule = rgb("#CCCCCC")        // Gris para líneas decorativas

#set document(
  title: "Propuesta de Trabajo Fin de ESTUDIOS",
  author: "Alejandro Saiz",
)

#set text(
  font: "New Computer Modern",
  size: 12pt,
  lang: "es",
)

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
)

#set par(
  justify: true,
  leading: 0.65em,
)

// Encabezados con color y estilo
#set heading(numbering: "1.")
#show heading.where(level: 1): it => {
  v(0.5cm)
  block(width: 100%)[
    #text(fill: color-uclm, size: 16pt, weight: "bold")[
      #counter(heading).display("1.") #it.body
    ]
    #v(-0.2cm)
    #line(length: 100%, stroke: 1.5pt + color-uclm)
  ]
  v(0.3cm)
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTADA
// ─────────────────────────────────────────────────────────────────────────────

#page(numbering: none, margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2.5cm))[

  // Línea decorativa superior
  #align(center)[
    #line(length: 80%, stroke: 2pt + color-uclm)
  ]

  #v(0.8cm)

  #align(center)[
    // Logos lado a lado
    #grid(
      columns: (1fr, 1fr),
      gutter: 1.5cm,
      align(center + horizon)[
        #image("images/uclm_logo.jpg", width: 80%)
      ],
      align(center + horizon)[
        #image("images/facultad_logo.jpeg", width: 70%)
      ],
    )
  ]

  #v(1cm)

  #align(center)[
    #text(size: 15pt, weight: "bold", fill: color-uclm)[
      Universidad de Castilla-La Mancha
    ]

    #v(0.15cm)

    #text(size: 12pt, fill: color-accent)[
      Facultad de Ciencias Sociales de Talavera de la Reina
    ]

    #v(0.1cm)

    #text(size: 11pt, style: "italic")[
      Grado en Ingeniería Informática
    ]
  ]

  #v(1cm)

  // Línea separadora
  #align(center)[
    #line(length: 60%, stroke: 0.75pt + color-rule)
  ]

  #v(1cm)

  #align(center)[
    #text(size: 13pt, weight: "bold", fill: color-accent, tracking: 0.1em)[
      PROPUESTA DE TRABAJO FIN DE ESTUDIOS
    ]
  ]

  #v(0.8cm)

  // Título del proyecto
  #align(center)[
    #text(size: 16pt, weight: "bold", fill: color-uclm)[
      Creación de una Plataforma/API para la Evaluación \
      de Calidad de Datos en Proyectos de IA
    ]
  ]

  #v(2cm)

  // Datos del autor
  #align(center)[
    #grid(
      columns: (auto, auto),
      gutter: 0.5cm,
      align(right)[
        #text(weight: "bold", fill: color-accent)[Autor:]
      ],
      align(left)[Alejandro Manuel Saiz García],
      // Descomentar cuando se tenga tutor:
      // align(right)[
      //   #text(weight: "bold", fill: color-accent)[Tutor:]
      // ],
      // align(left)[Nombre del Tutor],
    )
  ]

  #v(1.5cm)

  #align(center)[
    #text(size: 11pt, style: "italic")[
      Curso académico 2025 – 2026
    ]
  ]

  #v(0.5cm)

  // Línea decorativa inferior
  #align(center)[
    #line(length: 80%, stroke: 2pt + color-uclm)
  ]
]

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE PÁGINAS DE CONTENIDO
// ─────────────────────────────────────────────────────────────────────────────

#set page(
  numbering: "1",
  header: align(right)[
    #text(size: 9pt, fill: color-rule)[
      Propuesta TFG — Evaluación de Calidad de Datos
    ]
  ],
  footer: align(center)[
    #text(size: 9pt, fill: color-accent)[
      #context counter(page).display("1")
    ]
  ],
)
#counter(page).update(1)

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN
// ─────────────────────────────────────────────────────────────────────────────

= Resumen

En los proyectos de inteligencia artificial y aprendizaje automático, la calidad y adecuación de los datos son factores determinantes. Cuando los datos están incompletos, son inconsistentes o presentan sesgos, los modelos pueden ofrecer resultados poco precisos y dar lugar a decisiones poco fiables. En este contexto, resulta especialmente relevante disponer de soluciones que permitan evaluar la calidad de un dataset de forma completa y adaptada al tipo de proyecto en el que se va a utilizar.

Este Trabajo Fin de Estudios propone el desarrollo de una plataforma interactiva y una API RESTful para la evaluación de la calidad de datos en proyectos de inteligencia artificial. La plataforma permitirá a los usuarios cargar sus datasets y obtener un diagnóstico detallado a través de dashboards interactivos que visualizan métricas de calidad predefinidas como completitud, consistencia, exactitud, unicidad y actualidad. Paralelamente, la API proporcionará endpoints que permitan a desarrolladores integrar estas evaluaciones en sus flujos de trabajo. La solución se orientará a distintas tipologías de proyectos de datos, incluyendo minería de datos, aprendizaje automático e inteligencia artificial, adaptando las métricas y umbrales a las necesidades de cada contexto. Contar con una documentación completa, que incluya la especificación Swagger, ayudará a que la herramienta sea fácil de utilizar.

// ─────────────────────────────────────────────────────────────────────────────
// OBJETIVO GENERAL
// ─────────────────────────────────────────────────────────────────────────────

= Objetivo general

El objetivo general de este Trabajo Fin de Estudios consiste en desarrollar una plataforma web interactiva y una API RESTful que permitan evaluar de forma automatizada la calidad de los datos empleados en proyectos de inteligencia artificial, aprendizaje automático y minería de datos, proporcionando métricas, visualizaciones y mecanismos de diagnóstico que faciliten la identificación y corrección de problemas de calidad en los datasets.

// ─────────────────────────────────────────────────────────────────────────────
// OBJETIVOS ESPECÍFICOS
// ─────────────────────────────────────────────────────────────────────────────

= Objetivos específicos

+ Desarrollar un módulo de ingesta y almacenamiento que permita la carga, validación de formato y persistencia segura de datasets.

+ Implementar un motor de evaluación que calcule métricas de calidad estándar sobre los datasets cargados, permitiendo su parametrización según la tipología del proyecto.

+ Diseñar e implementar una API RESTful documentada con Swagger que exponga endpoints para la carga de datos, configuración de evaluaciones, ejecución de análisis y consulta de resultados, permitiendo la integración con flujos de trabajo externos.

+ Desarrollar una aplicación web para la gestión de proyectos y datasets, que permita configurar evaluaciones y umbrales de calidad personalizados, consultar el historial de evaluaciones realizadas y visualizar las métricas obtenidas mediante dashboards interactivos.

+ Desarrollar mecanismos de identificación y sugerencia de corrección de problemas de calidad que permitan localizar registros defectuosos en los datasets y proponer acciones correctivas para resolver las incidencias detectadas.

