# Plan de Implementación: Sistema de Versionado de Datasets

## 1. Resumen Ejecutivo

Este documento detalla el plan para implementar un sistema de versionado de datasets que permita:
- Rastrear la evolución de un mismo dataset a lo largo del tiempo
- Comparar métricas e issues entre versiones
- Mantener trazabilidad completa de cambios y correcciones
- Visualizar la evolución de calidad de un dataset específico

---

## 2. Análisis del Estado Actual

### 2.1 Modelo de Datos Actual

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Project   │ 1───N │   Dataset   │ 1───N │ AnalysisRun │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ name        │       │ name        │       │ project_id  │
│ owner_id    │       │ project_id  │       │ dataset_id  │
│ ...         │       │ file_path   │       │ quality_score│
└─────────────┘       │ row_count   │       │ baseline_id │
                      │ schema      │       │ new_issues  │
                      │ ...         │       │ fixed_issues│
                      └─────────────┘       └─────────────┘
```

### 2.2 Limitaciones Actuales

1. **Sin relación entre datasets**: Cada dataset es una entidad independiente
2. **Comparación confusa**: `baseline_analysis_id` compara runs del mismo dataset, pero el UI mezcla datasets diferentes
3. **Sin concepto de "versión"**: No hay forma de indicar que un dataset es evolución de otro
4. **Métricas mezcladas**: El historial de proyecto agrega análisis de datasets sin relación

---

## 3. Propuesta de Modelo de Versionado

### 3.1 Opción A: Versionado Explícito (Recomendada)

Añadir campos al modelo `Dataset` para establecer relaciones de versión:

```python
class Dataset(db.Model):
    # ... campos existentes ...
    
    # NUEVOS CAMPOS PARA VERSIONADO
    parent_dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=True)
    version = db.Column(db.Integer, default=1)
    version_tag = db.Column(db.String(50), nullable=True)  # e.g., "v1.0", "corregido", "final"
    is_latest = db.Column(db.Boolean, default=True)
    
    # Relación self-referential
    parent = db.relationship('Dataset', remote_side=[id], backref='versions')
```

**Ventajas:**
- ✅ Modelo claro y explícito
- ✅ Fácil de consultar versiones de un dataset
- ✅ Permite comparaciones directas entre versiones
- ✅ Compatible con el sistema actual (campos opcionales)

### 3.2 Opción B: Dataset Family (Agrupación)

Crear una entidad intermedia para agrupar datasets relacionados:

```python
class DatasetFamily(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'))
    description = db.Column(db.Text)
    
class Dataset(db.Model):
    # ... campos existentes ...
    family_id = db.Column(db.Integer, db.ForeignKey('dataset_families.id'), nullable=True)
    version = db.Column(db.Integer, default=1)
```

**Ventajas:**
- ✅ Separación clara de conceptos
- ✅ Permite metadatos a nivel de familia

**Desventajas:**
- ❌ Más complejidad en el modelo
- ❌ Requiere más cambios en la UI

### 3.3 Recomendación: Opción A

La **Opción A (Versionado Explícito)** es más simple, menos invasiva y suficiente para los casos de uso planteados.

---

## 4. Cambios Técnicos Necesarios

### 4.1 Backend - Modelo de Datos

#### 4.1.1 Migración de Base de Datos

```python
# migrations/add_dataset_versioning.py

def upgrade():
    # Añadir columnas de versionado
    op.add_column('datasets', sa.Column('parent_dataset_id', sa.Integer(), nullable=True))
    op.add_column('datasets', sa.Column('version', sa.Integer(), default=1))
    op.add_column('datasets', sa.Column('version_tag', sa.String(50), nullable=True))
    op.add_column('datasets', sa.Column('is_latest', sa.Boolean(), default=True))
    
    # Foreign key
    op.create_foreign_key(
        'fk_dataset_parent',
        'datasets', 'datasets',
        ['parent_dataset_id'], ['id']
    )
    
    # Índice para búsquedas rápidas
    op.create_index('ix_datasets_parent_id', 'datasets', ['parent_dataset_id'])
```

#### 4.1.2 Actualización del Modelo Dataset

```python
# models/dataset.py - Campos adicionales

class Dataset(db.Model):
    # ... campos existentes ...
    
    # Versionado
    parent_dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=True)
    version = db.Column(db.Integer, default=1)
    version_tag = db.Column(db.String(50), nullable=True)
    is_latest = db.Column(db.Boolean, default=True)
    
    # Relación
    parent = db.relationship(
        'Dataset',
        remote_side=[id],
        backref=db.backref('versions', lazy='dynamic')
    )
    
    def get_version_history(self):
        """Obtiene todas las versiones de este dataset (incluyendo ancestros y descendientes)"""
        root = self.get_root_dataset()
        return Dataset.query.filter(
            db.or_(
                Dataset.id == root.id,
                Dataset.parent_dataset_id == root.id
            )
        ).order_by(Dataset.version.asc()).all()
    
    def get_root_dataset(self):
        """Obtiene el dataset raíz (primera versión)"""
        current = self
        while current.parent:
            current = current.parent
        return current
    
    def to_dict(self):
        # ... existente ...
        result = {
            # ... campos existentes ...
            'parent_dataset_id': self.parent_dataset_id,
            'version': self.version,
            'version_tag': self.version_tag,
            'is_latest': self.is_latest,
        }
        return result
```

### 4.2 Backend - API Endpoints

#### 4.2.1 Nuevos Endpoints

```python
# api/datasets/routes.py

@project_datasets_bp.route('/<int:dataset_id>/versions', methods=['GET'])
@jwt_required()
def get_dataset_versions(project_id, dataset_id):
    """Obtiene todas las versiones de un dataset"""
    dataset = Dataset.query.get_or_404(dataset_id)
    versions = dataset.get_version_history()
    return jsonify({
        "success": True,
        "data": [v.to_dict() for v in versions]
    })

@project_datasets_bp.route('/<int:dataset_id>/new-version', methods=['POST'])
@jwt_required()
def upload_new_version(project_id, dataset_id):
    """Sube una nueva versión de un dataset existente"""
    parent_dataset = Dataset.query.get_or_404(dataset_id)
    
    # Marcar versión anterior como no-latest
    parent_dataset.is_latest = False
    
    # Procesar nuevo archivo
    file = request.files['file']
    dataset_info = dataset_service.process_dataset(file, project_id)
    
    # Calcular nueva versión
    max_version = db.session.query(db.func.max(Dataset.version)).filter(
        db.or_(
            Dataset.id == parent_dataset.get_root_dataset().id,
            Dataset.parent_dataset_id == parent_dataset.get_root_dataset().id
        )
    ).scalar() or 0
    
    new_dataset = Dataset(
        name=parent_dataset.name,  # Mantener nombre original
        description=request.form.get('description', ''),
        project_id=project_id,
        parent_dataset_id=parent_dataset.id,
        version=max_version + 1,
        version_tag=request.form.get('version_tag'),
        is_latest=True,
        # ... otros campos del dataset_info ...
    )
    
    db.session.add(new_dataset)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "data": new_dataset.to_dict()
    })

@project_datasets_bp.route('/<int:dataset_id>/compare/<int:other_dataset_id>', methods=['GET'])
@jwt_required()
def compare_dataset_versions(project_id, dataset_id, other_dataset_id):
    """Compara dos versiones de un dataset"""
    dataset_a = Dataset.query.get_or_404(dataset_id)
    dataset_b = Dataset.query.get_or_404(other_dataset_id)
    
    # Obtener últimos análisis de cada versión
    analysis_a = AnalysisRun.query.filter_by(
        dataset_id=dataset_id, 
        status='COMPLETED'
    ).order_by(AnalysisRun.completed_at.desc()).first()
    
    analysis_b = AnalysisRun.query.filter_by(
        dataset_id=other_dataset_id,
        status='COMPLETED'
    ).order_by(AnalysisRun.completed_at.desc()).first()
    
    comparison = {
        "version_a": {
            "dataset": dataset_a.to_dict(),
            "analysis": analysis_a.to_dict() if analysis_a else None
        },
        "version_b": {
            "dataset": dataset_b.to_dict(),
            "analysis": analysis_b.to_dict() if analysis_b else None
        },
        "diff": {
            "score_change": (analysis_b.quality_score - analysis_a.quality_score) if analysis_a and analysis_b else None,
            "issues_change": (analysis_b.total_issues_count - analysis_a.total_issues_count) if analysis_a and analysis_b else None,
        }
    }
    
    return jsonify({"success": True, "data": comparison})
```

### 4.3 Frontend - Cambios en UI

#### 4.3.1 Lista de Datasets (Proyecto)

```tsx
// Mostrar indicador de versión en la lista de datasets
<TableCell>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography>{dataset.name}</Typography>
    {dataset.version > 1 && (
      <Chip 
        label={dataset.version_tag || `v${dataset.version}`}
        size="small"
        color="primary"
        variant="outlined"
      />
    )}
    {dataset.is_latest && dataset.version > 1 && (
      <Chip label="Última" size="small" color="success" />
    )}
  </Box>
</TableCell>
```

#### 4.3.2 Nuevo Componente: DatasetVersionHistory

```tsx
// components/DatasetVersionHistory.tsx
interface DatasetVersionHistoryProps {
  datasetId: number;
  projectId: number;
}

const DatasetVersionHistory: React.FC<DatasetVersionHistoryProps> = ({ datasetId, projectId }) => {
  const [versions, setVersions] = useState<Dataset[]>([]);
  
  // Timeline vertical mostrando versiones
  return (
    <Timeline>
      {versions.map((version, index) => (
        <TimelineItem key={version.id}>
          <TimelineSeparator>
            <TimelineDot color={version.is_latest ? 'success' : 'grey'} />
            {index < versions.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Typography variant="h6">
              {version.version_tag || `Versión ${version.version}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(version.created_at)}
            </Typography>
            {/* Métricas del último análisis */}
            <Box sx={{ mt: 1 }}>
              <Chip label={`Score: ${version.lastAnalysis?.quality_score}%`} />
              <Chip label={`Issues: ${version.lastAnalysis?.total_issues_count}`} />
            </Box>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
};
```

#### 4.3.3 Botón "Subir Nueva Versión"

En la página de detalle del dataset, añadir:

```tsx
<Button
  variant="outlined"
  startIcon={<UpgradeIcon />}
  onClick={() => setUploadVersionDialogOpen(true)}
>
  Subir Nueva Versión
</Button>

<Dialog open={uploadVersionDialogOpen}>
  <DialogTitle>Subir Nueva Versión</DialogTitle>
  <DialogContent>
    <Typography variant="body2" sx={{ mb: 2 }}>
      Estás subiendo una nueva versión de "{dataset.name}"
    </Typography>
    <TextField
      label="Etiqueta de versión (opcional)"
      placeholder="ej: corregido, v2.0, final"
      value={versionTag}
      onChange={(e) => setVersionTag(e.target.value)}
    />
    <TextField
      label="Descripción de cambios"
      multiline
      rows={3}
    />
    <DropzoneArea />
  </DialogContent>
</Dialog>
```

#### 4.3.4 Gráfico de Evolución por Versión

```tsx
// Nuevo gráfico específico para comparar versiones
const VersionEvolutionChart: React.FC<{ versions: Dataset[] }> = ({ versions }) => {
  const data = {
    labels: versions.map(v => v.version_tag || `v${v.version}`),
    datasets: [
      {
        label: 'Quality Score',
        data: versions.map(v => v.lastAnalysis?.quality_score || 0),
        borderColor: GREEN,
        fill: false,
      },
      {
        label: 'Total Issues',
        data: versions.map(v => v.lastAnalysis?.total_issues_count || 0),
        borderColor: RED,
        fill: false,
      }
    ]
  };
  
  return <Line data={data} />;
};
```

---

## 5. Impacto en el Panel de Visualización Actual

### 5.1 Cambios en Historial de Análisis

| Antes | Después |
|-------|---------|
| Mezcla análisis de todos los datasets | Opción de filtrar por dataset/versión |
| Columnas Nuevos/Corregidos confusas | Solo mostrar diff cuando es misma familia |
| Sin contexto de versión | Indicador de versión en cada fila |

### 5.2 Cambios en Tendencias de Calidad

| Antes | Después |
|-------|---------|
| Gráfico único mezclando datasets | Selector de dataset/familia |
| Métricas agregadas sin sentido | Métricas por familia de datasets |
| Sin comparación de versiones | Gráfico de evolución por versión |

### 5.3 Nueva Sección: "Evolución de Dataset"

Añadir una nueva pestaña o sección en la página de proyecto:

```
┌─────────────────────────────────────────────────────────────┐
│  Datasets  │  Métricas  │  Historial  │  Evolución  │      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Seleccionar Dataset: [healthcare_data ▼]                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Timeline de Versiones                               │   │
│  │                                                      │   │
│  │  ● v1.0 (original) - 15/01/2026                     │   │
│  │  │  Score: 72% | Issues: 45                         │   │
│  │  │                                                   │   │
│  │  ● v1.1 (corregido) - 20/01/2026                    │   │
│  │  │  Score: 85% | Issues: 23 | -22 corregidos        │   │
│  │  │                                                   │   │
│  │  ● v2.0 (final) - 05/02/2026  ← ACTUAL              │   │
│  │     Score: 95% | Issues: 8 | -15 corregidos         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Comparar Versiones]  [Subir Nueva Versión]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Consideraciones de Trazabilidad

### 6.1 Auditoría de Cambios

- Cada versión mantiene referencia a su padre (`parent_dataset_id`)
- Los `AnalysisRun` mantienen `dataset_id` específico
- El `baseline_analysis_id` ahora tiene sentido: compara runs del mismo dataset o versiones relacionadas

### 6.2 Comparación entre Versiones

```python
# Lógica de comparación mejorada
def compare_versions(version_a_id, version_b_id):
    """
    Compara dos versiones de un dataset.
    Solo permite comparar datasets de la misma familia.
    """
    a = Dataset.query.get(version_a_id)
    b = Dataset.query.get(version_b_id)
    
    # Verificar que son de la misma familia
    if a.get_root_dataset().id != b.get_root_dataset().id:
        raise ValueError("Solo se pueden comparar versiones del mismo dataset")
    
    # Obtener análisis más recientes
    analysis_a = a.analysis_runs.filter_by(status='COMPLETED').order_by(...).first()
    analysis_b = b.analysis_runs.filter_by(status='COMPLETED').order_by(...).first()
    
    # Comparar issues por fingerprint
    issues_a = set(i.fingerprint for i in analysis_a.issues)
    issues_b = set(i.fingerprint for i in analysis_b.issues)
    
    return {
        "new_issues": issues_b - issues_a,
        "fixed_issues": issues_a - issues_b,
        "persistent_issues": issues_a & issues_b,
        "score_change": analysis_b.quality_score - analysis_a.quality_score
    }
```

---

## 7. Hoja de Ruta de Implementación

### Fase 1: Fundamentos (1-2 semanas) ✅ COMPLETADA
- [x] Crear migración de base de datos
- [x] Actualizar modelo `Dataset` con campos de versionado
- [x] Actualizar `to_dict()` para incluir nuevos campos
- [x] Tests unitarios del modelo

### Fase 2: API Backend (1 semana) ✅ COMPLETADA
- [x] Endpoint GET `/datasets/{id}/versions`
- [x] Endpoint POST `/datasets/{id}/new-version`
- [x] Endpoint GET `/datasets/{id}/compare/{other_id}`
- [x] Actualizar tipos en frontend para versionado
- [ ] Tests de integración de API (pendiente)

### Fase 3: Frontend - Básico (1-2 semanas) ✅ COMPLETADA
- [x] Mostrar versión en lista de datasets (columna Version con chips)
- [x] Botón "Subir Nueva Versión" en detalle de dataset
- [x] Formulario de upload con campos de versión (version_tag)
- [x] Indicadores visuales de versión (chips "Latest", badges de versión)

### Fase 4: Frontend - Visualización (1-2 semanas) ✅ COMPLETADA
- [x] Componente `DatasetVersionHistory` (timeline visual)
- [x] Componente `VersionEvolutionChart` (gráfico de evolución)
- [x] Nueva pestaña "Versiones" en página de dataset
- [ ] Filtros por dataset/versión en historial de análisis (pendiente)

### Fase 5: Comparación Avanzada (1 semana) ✅ COMPLETADA
- [x] Vista de comparación lado a lado (`/datasets/compare`)
- [x] Diff de issues entre versiones (resueltos/nuevos)
- [ ] Exportación de reporte de evolución (pendiente)

### Fase 6: Refinamiento (1 semana) ✅ COMPLETADA
- [x] Optimización de queries (eager loading en endpoint de versiones)
- [ ] Caché de versiones (pendiente - opcional)
- [x] Documentación de usuario (`docs/GUIA_VERSIONADO_DATASETS.md`)
- [x] Tests de integración (`backend/tests/test_dataset_versioning_api.py`)

---

## 8. Estimación de Esfuerzo

| Fase | Duración | Complejidad |
|------|----------|-------------|
| Fase 1: Fundamentos | 1-2 semanas | Media |
| Fase 2: API Backend | 1 semana | Media |
| Fase 3: Frontend Básico | 1-2 semanas | Media |
| Fase 4: Visualización | 1-2 semanas | Alta |
| Fase 5: Comparación | 1 semana | Media |
| Fase 6: Refinamiento | 1 semana | Baja |

**Total estimado: 6-9 semanas**

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migración de datos existentes | Media | Alto | Script de migración con rollback |
| Performance con muchas versiones | Baja | Medio | Índices y paginación |
| Confusión de usuarios | Media | Medio | UI clara y documentación |
| Incompatibilidad con análisis existentes | Baja | Alto | Campos opcionales, backwards compatible |

---

## 10. Próximos Pasos

1. **Revisar y aprobar este plan**
2. **Priorizar fases** según necesidades del proyecto
3. **Comenzar con Fase 1** (migración y modelo)
4. **Iterar** basándose en feedback

---

*Documento generado el 05/02/2026*
*Versión del plan: 1.0*
