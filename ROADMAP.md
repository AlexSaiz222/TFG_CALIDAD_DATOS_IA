# 🗺️ DataQual - Roadmap de desarrollo

Este documento describe las fases de desarrollo planificadas para la plataforma DataQual y el estado actual unificado de implementación.

---

## 📊 Estado actual

La plataforma cuenta con las siguientes funcionalidades implementadas:

### ✅ Funcionalidades core
- **Autenticación**: login, registro, gestión de sesión con JWT
- **Proyectos**: crear, listar, ver detalle, configurar
- **Datasets**: subir CSV, versionado, comparar versiones, vista previa
- **Análisis de calidad**: Quality Gate (PASSED/WARNING/FAILED), Quality Score, detección de issues
- **Métricas**: completeness, uniqueness, outliers
- **Visualización**: dashboard, gráficos de evolución, historial de análisis
- **Quality Gate Configurable**: modelo de BD, API (lectura y escritura), e integración en UI (Pestaña "Quality Gate" en el panel del proyecto).
- **Detalle de Evaluaciones**: página dedicada (`/evaluations/[id]`), componentes visuales (indicadores, resúmenes, tablas de métricas).

### ✅ Infraestructura
- Docker Compose con todos los servicios
- PostgreSQL, MinIO, Redis
- API RESTful

---

## 🚀 Fases de desarrollo

### Fase 1: Mejoras inmediatas (1-2 semanas)

Mejoras de UX/UI que no requieren cambios en el backend.

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 1.1 | **Consistencia de idioma** | Unificar toda la interfaz en español | ✅ Completado |
| 1.2 | **Breadcrumbs** | Añadir navegación con migas de pan | ✅ Completado |
| 1.3 | **Sistema de notificaciones** | Feedback de acciones (éxito, error, info) | ✅ Completado |
| 1.4 | **Mejorar empty states** | Mensajes más útiles cuando no hay datos | ✅ Completado |
| 1.5 | **Confirmar acciones destructivas**| Modal de confirmación antes de eliminar | ✅ Completado |

---

### Fase 2: Funcionalidades core (2-4 semanas)

Nuevas funcionalidades que mejoran significativamente la plataforma.

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 2.1 | **Quality Gate configurable** | Permitir configurar umbrales por proyecto | ✅ Completado |
| 2.2 | **Más métricas de calidad** | Validez de formato, consistencia, duplicados fuzzy | ⏳ Pendiente |
| 2.3 | **Análisis programados** | Cron jobs para análisis automáticos | ⏳ Pendiente |
| 2.4 | **Exportación de reportes** | PDF con resumen ejecutivo, Excel con datos | ⏳ Pendiente |
| 2.5 | **Webhooks** | Notificar a sistemas externos cambios de estado | ⏳ Pendiente |

---

### Fase 3: Funcionalidades avanzadas (1-2 meses)

Funcionalidades enterprise y de integración.

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 3.1 | **Integración con DBs remotas** | Conexión directa a BD, APIs, cloud storage | ⏳ Pendiente |
| 3.2 | **ML Detección de anomalías** | Detección automática de patrones anómalos | ⏳ Pendiente |
| 3.3 | **Colaboración en equipo** | Roles, permisos, asignación de issues | ⏳ Pendiente |
| 3.4 | **API pública documentada** | Swagger/OpenAPI, SDKs | ⏳ Pendiente |
| 3.5 | **Alertas por email/Slack** | Notificaciones cuando falla un análisis | ⏳ Pendiente |

---

### Fase 4: Mejoras de experiencia (continuo)

Mejoras incrementales de UX.

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 4.1 | **Dark mode** | Tema oscuro para la interfaz | ⏳ Pendiente |
| 4.2 | **Internacionalización** | Soporte multi-idioma completo | ⏳ Pendiente |
| 4.3 | **Atajos de teclado** | Navegación rápida con teclado | ⏳ Pendiente |
| 4.4 | **Favoritos** | Marcar proyectos/datasets favoritos | ⏳ Pendiente |
| 4.5 | **Onboarding** | Tutorial interactivo para nuevos usuarios | ⏳ Pendiente |

---

## 📝 Notas de implementación pendientes

- **Conexión de navegación en Frontend:** Asegurar que desde la tabla general de evaluaciones (en `pages/datasets/[id].tsx` y `/evaluations/index.tsx`) se navegue correctamente a la vista en detalle `/evaluations/[id]`.
- **Nuevas Métricas**: Considerar añadir Histogramas o distribuciones más ricas en `ColumnMetricsTable`.

---

## 🔄 Historial de cambios

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-08 | 1.0.0 | Documento inicial con roadmap |
| 2026-03-13 | 1.1.0 | Unificación de planes: Quality Gate y Evaluaciones marcados como completados. Eliminación de planes intermedios obsoletos. |

---

## 📞 Contacto

Para sugerencias o preguntas sobre el roadmap, contactar al equipo de desarrollo.
