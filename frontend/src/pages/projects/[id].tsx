import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Drawer,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Description as DatasetIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import AnalysisHistory from '../../components/AnalysisHistory';
import DatasetSelector from '../../components/DatasetSelector';
import AnalysisDashboardPanel from '../../components/AnalysisDashboardPanel';
import QualityGateSettings from '../../components/QualityGateSettings';
import { projectsAPI, datasetsAPI, metricsAPI, analysisAPI } from '../../services/api';
import { GREEN, GREEN_HOVER, ORANGE, RED, getMetricMeta, formatParamValue, DEFAULT_METRIC_META } from '../../utils/metricColors';
import type { AnalysisRun } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface ParamHelp { label: string; description: string; unit?: string; }
const PARAM_HELP: Record<string, Record<string, ParamHelp>> = {
  completeness: {
    threshold:    { label: 'Umbral mínimo',      unit: '0 – 1',  description: 'Proporción mínima de valores no nulos exigida. Si la completitud real es inferior, se genera un issue.' },
    columns:      { label: 'Columnas',                           description: 'Columnas a evaluar. Vacío = todas las columnas del dataset.' },
    weight:       { label: 'Peso en puntuación', unit: '0 – 1',  description: 'Influencia de esta métrica en el Quality Score global. Mayor peso = mayor impacto.' },
  },
  uniqueness: {
    threshold:    { label: 'Umbral de unicidad', unit: '0 – 1',  description: 'Proporción mínima de filas únicas exigida. 1.0 = ningún duplicado permitido.' },
    columns:      { label: 'Columnas clave',                     description: 'Columnas cuya combinación debe ser única (p.ej. identificadores). Vacío = filas completas.' },
    weight:       { label: 'Peso en puntuación', unit: '0 – 1',  description: 'Influencia de esta métrica en el Quality Score global.' },
  },
  outliers: {
    method:       { label: 'Método de detección',               description: 'IQR es robusto ante distribuciones asimétricas. Z-Score asume distribución normal y es más sensible a extremos.' },
    factor:       { label: 'Factor de sensibilidad', unit: '> 0', description: 'Multiplicador de tolerancia. Más bajo = más estricto (más outliers detectados). 1.5 es el estándar; 3.0 es permisivo.' },
    columns:      { label: 'Columnas numéricas',                 description: 'Columnas numéricas a analizar. Vacío = todas las columnas numéricas detectadas.' },
    weight:       { label: 'Peso en puntuación', unit: '0 – 1',  description: 'Influencia de esta métrica en el Quality Score global.' },
  },
  syntactic_accuracy: {
    auto_detect_types: { label: 'Detección automática',         description: 'Detecta formatos comunes (email, teléfono, fecha…) sin configuración manual. Si está desactivado, solo se evalúan las reglas de "columns".' },
    threshold:         { label: 'Umbral de conformidad', unit: '0 – 1', description: 'Porcentaje mínimo de valores que deben cumplir el formato en cada columna analizada.' },
    columns:           { label: 'Reglas de formato',            description: 'Lista de columnas con su tipo esperado (email, phone_es, date_iso, dni_es, url…). Complementa o reemplaza la detección automática.' },
    weight:            { label: 'Peso en puntuación', unit: '0 – 1', description: 'Influencia de esta métrica en el Quality Score global.' },
  },
  class_balance: {
    auto_detect:               { label: 'Detección automática',       description: 'Detecta automáticamente columnas categóricas según el umbral de cardinalidad.' },
    columns:                   { label: 'Columnas a analizar',         description: 'Columnas categóricas específicas. Vacío = todas las detectadas automáticamente.' },
    max_cardinality:           { label: 'Cardinalidad máxima', unit: 'entero', description: 'Nº máximo de valores únicos para considerar una columna como categórica. Columnas con más valores serán ignoradas.' },
    imbalance_threshold_high:  { label: 'Umbral de dominancia', unit: '0 – 1', description: 'Porcentaje máximo que puede ocupar una clase. Superarlo genera un issue de desequilibrio.' },
    imbalance_threshold_low:   { label: 'Umbral de minoría',   unit: '0 – 1', description: 'Porcentaje mínimo que debe tener cualquier clase. Por debajo = infrarepresentada.' },
    weight:                    { label: 'Peso en puntuación',  unit: '0 – 1', description: 'Influencia de esta métrica en el Quality Score global.' },
  },
  currentness: {
    auto_detect:              { label: 'Detección automática',           description: 'Detecta automáticamente columnas de tipo fecha, timestamp o datetime.' },
    columns:                  { label: 'Columnas de fecha',              description: 'Columnas de fecha específicas. Vacío = todas las detectadas automáticamente.' },
    staleness_threshold_days: { label: 'Umbral de obsolescencia', unit: 'días', description: 'Días sin actualización a partir de los cuales un registro se considera desactualizado.' },
    weight:                   { label: 'Peso en puntuación', unit: '0 – 1', description: 'Influencia de esta métrica en el Quality Score global.' },
  },
  logical_consistency: {
    rules:  { label: 'Reglas de negocio', description: 'Lista de reglas que los datos deben cumplir. "violation": expresión que selecciona filas inválidas. "if_then": si se cumple la condición, la aserción debe ser verdadera.' },
    weight: { label: 'Peso en puntuación', unit: '0 – 1', description: 'Influencia de esta métrica en el Quality Score global.' },
  },
};

const ProjectDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  // Estados
  const [project, setProject] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [drawerMetric, setDrawerMetric] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [qualityGateThreshold, setQualityGateThreshold] = useState<number>(70);
  const fetchedRef = useRef(false);

  // Cargar datos del proyecto
  useEffect(() => {
    const fetchProjectData = async () => {
      // Verificar que el ID del proyecto sea válido
      if (projectId === undefined || isNaN(projectId)) {
        console.error('ID de proyecto inválido:', projectId);
        setLoading(false);
        setError('ID de proyecto inválido o no especificado.');
        return;
      }

      // Evitar doble fetch en modo desarrollo (React Strict Mode)
      if (fetchedRef.current) {
        return;
      }
      fetchedRef.current = true;

      setLoading(true);
      setError(null);

      try {
        console.log('Cargando proyecto con ID:', projectId);
        
        // Cargar datos del proyecto
        const projectResponse = await projectsAPI.getProject(projectId);
        
        // Verificar respuesta válida
        if (!projectResponse?.data) {
          console.error('No se recibieron datos para el proyecto:', projectId);
          setError('No se pudo cargar la información del proyecto.');
          setLoading(false);
          return;
        }
        
        // Normalizar el objeto proyecto
        const raw = projectResponse?.data?.data ?? projectResponse?.data ?? {};
        const normalized = {
          id: raw.id,
          name: raw.name || 'Proyecto sin nombre',
          description: raw.description || '',
          created_at: raw.created_at || new Date().toISOString(),
          updated_at: raw.updated_at || new Date().toISOString(),
          owner_id: raw.owner_id || raw.ownerId || 1,
          metrics_config: raw.metrics_config || [],
        };
        
        setProject(normalized);

        // Función para normalizar métricas a un formato amigable para la UI
        const normalizeMetrics = (arr: any[]) => (arr || []).map((m: any, idx: number) => {
          // Preservar el nombre original de la métrica si existe
          let metricName = m.name;
          let metricDescription = m.description;
          
          // Identificar el tipo de métrica basado en el ID o nombre
          const metricId = m.metric_id ?? m.id ?? idx;
          const metricType = typeof m.type === 'string' ? m.type : '';
          
          // Si no hay nombre, intentar determinar el nombre basado en el tipo o ID
          if (!metricName) {
            // Nombres de métricas conocidas
            const knownMetrics: Record<string, {name: string, description: string}> = {
              'currentness': {
                name: 'currentness',
                description: 'Assesses if data is up-to-date (Currentness, ISO 5259-2 Cur-ML-1)'
              },
              'class_balance': {
                name: 'class_balance',
                description: 'Evaluates balance of target classes for classification tasks'
              },
              'feature_correlation': {
                name: 'feature_correlation',
                description: 'Measures correlation between features'
              }
            };
            
            // Buscar por ID o nombre en métricas conocidas
            const metricKey = String(metricId).toLowerCase();
            if (knownMetrics[metricKey]) {
              metricName = knownMetrics[metricKey].name;
              metricDescription = knownMetrics[metricKey].description;
            } else if (m.parameters) {
              // Si no es una métrica conocida, intentar determinar por parámetros
              if (m.parameters.threshold) {
                metricName = `${metricType || 'Completitud'} (${m.parameters.threshold})`;
                metricDescription = `Mide el porcentaje de valores no nulos en el dataset con un umbral de ${m.parameters.threshold}`;
              } else if (m.parameters.columns && Array.isArray(m.parameters.columns)) {
                metricName = metricType || 'Unicidad de Columnas';
                metricDescription = `Verifica la unicidad de valores en columnas seleccionadas`;
              } else if (m.parameters.method) {
                metricName = `${metricType || m.parameters.method}`;
                metricDescription = `Análisis usando el método ${m.parameters.method}`;
              } else {
                // Si no hay suficiente información, usar un nombre genérico
                metricName = `Métrica ${metricId}`;
              }
            } else {
              // Si no hay parámetros, usar un nombre genérico
              metricName = `Métrica ${metricId}`;
            }
          }
          
          return {
            id: m.id ?? m.metric_id ?? idx,
            metric_id: m.metric_id ?? m.id ?? idx,
            name: metricName,
            description: metricDescription ?? 'Sin descripción',
            parameters: m.parameters ?? {},
            category: m.category ?? 'general',
            created_at: m.created_at ?? new Date().toISOString(),
            updated_at: m.updated_at ?? new Date().toISOString(),
            type: m.type || metricType || 'general'
          };
        });

        // Cargar datasets asociados al proyecto
        try {
          const datasetsResponse = await datasetsAPI.getDatasets(projectId);
          // Asegurar que datasetsResponse es un objeto con propiedad data
          const datasetsData = datasetsResponse && typeof datasetsResponse === 'object' && 'data' in datasetsResponse
            ? (datasetsResponse.data as any)?.data ?? datasetsResponse.data ?? []
            : [];
          setDatasets(Array.isArray(datasetsData) ? datasetsData : []);
        } catch (datasetsError: any) {
          console.warn('Error al cargar datasets:', datasetsError);
          // Si es un error 404, simplemente consideramos que no hay datasets
          if (datasetsError?.response?.status === 404) {
            console.log('No se encontró el endpoint de datasets, tratando como array vacío');
            setDatasets([]);
          } else {
            console.error('Error al cargar datasets:', datasetsError?.message);
          }
        }

        // Cargar todas las métricas disponibles primero para tener la información completa
        let availableMetrics: any[] = [];
        try {
          console.log('Cargando catálogo completo de métricas');
          const allMetricsResponse = await metricsAPI.getMetrics();
          if (allMetricsResponse && allMetricsResponse.data) {
            if (Array.isArray(allMetricsResponse.data)) {
              availableMetrics = allMetricsResponse.data;
            } else if (allMetricsResponse.data.metrics && Array.isArray(allMetricsResponse.data.metrics)) {
              availableMetrics = allMetricsResponse.data.metrics;
            }
            // Outliers is profiling-only (ISO/IEC 5259): hide from metric catalog UI.
            availableMetrics = availableMetrics.filter(
              (m: any) => m?.name?.toLowerCase() !== 'outliers'
            );
            console.log('Catálogo de métricas cargado:', availableMetrics);
          }
        } catch (error) {
          console.warn('Error al cargar el catálogo de métricas:', error);
        }

        // Cargar métricas configuradas para el proyecto
        try {
          console.log('Solicitando métricas para el proyecto:', projectId);
          const metricsResponse = await metricsAPI.getProjectMetricConfigs(projectId);
          console.log('Respuesta de métricas recibida:', metricsResponse);
          
          // Obtener datos crudos de la API
          const rawMetrics = metricsResponse && typeof metricsResponse === 'object' && 'data' in metricsResponse
            ? (metricsResponse.data as any)?.data ?? metricsResponse.data ?? []
            : [];
          
          console.log('Datos de métricas procesados:', rawMetrics);
          
          // Enriquecer las métricas del proyecto con información del catálogo completo
          const enrichedMetrics = Array.isArray(rawMetrics) ? rawMetrics.map(metric => {
            const metricId = metric.metric_id ?? metric.id;
            // Buscar la métrica en el catálogo completo
            // Si metricId es string ("completeness"), comparar con el nombre de la métrica en el catálogo
            const fullMetricInfo = availableMetrics.find(m => {
              if (typeof metricId === 'string') {
                // Comparar el id (string) con el nombre de la métrica del catálogo
                return m.name && m.name.toLowerCase() === metricId.toLowerCase();
              }
              // Si es numérico, comparar con el id
              return m.id === metricId || m.metric_id === metricId;
            });
            
            // Combinar la información, fusionando parámetros del catálogo con los del proyecto
            const catalogParams = fullMetricInfo?.parameters || {};
            const projectParams = metric.parameters || {};
            return {
              ...metric,
              name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
              description: fullMetricInfo?.description || metric.description || 'Sin descripción',
              category: fullMetricInfo?.category || metric.category || 'general',
              parameters: { ...catalogParams, ...projectParams },
            };
          }) : [];
          
          // Si no hay métricas enriquecidas, intentar usar las del proyecto
          if (enrichedMetrics.length === 0 && Array.isArray(normalized.metrics_config) && normalized.metrics_config.length > 0) {
            console.log('Usando métricas del objeto proyecto:', normalized.metrics_config);
            const projectMetrics = normalized.metrics_config.map(metric => {
              const metricId = metric.metric_id ?? metric.id;
              // Buscar la métrica en el catálogo completo
              const fullMetricInfo = availableMetrics.find(m => {
                if (typeof metricId === 'string') {
                  return m.name && m.name.toLowerCase() === metricId.toLowerCase();
                }
                return m.id === metricId || m.metric_id === metricId;
              });
              
              // Combinar la información, fusionando parámetros del catálogo con los del proyecto
              const catalogParams = fullMetricInfo?.parameters || {};
              const projectParams = metric.parameters || {};
              return {
                ...metric,
                name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
                description: fullMetricInfo?.description || metric.description || 'Sin descripción',
                category: fullMetricInfo?.category || metric.category || 'general',
                parameters: { ...catalogParams, ...projectParams },
              };
            });
            setMetrics(projectMetrics);
          } else {
            console.log('Métricas enriquecidas:', enrichedMetrics);
            setMetrics(enrichedMetrics);
          }
        } catch (metricsError: any) {
          console.warn('Error al cargar métricas:', metricsError);
          // Si hay error, intentar usar las métricas del proyecto como fallback
          if (Array.isArray(normalized.metrics_config) && normalized.metrics_config.length > 0) {
            console.log('Usando métricas del objeto proyecto como fallback:', normalized.metrics_config);
            const projectMetrics = normalized.metrics_config.map(metric => {
              const metricId = metric.metric_id ?? metric.id;
              // Buscar la métrica en el catálogo completo
              const fullMetricInfo = availableMetrics.find(m => {
                if (typeof metricId === 'string') {
                  return m.name && m.name.toLowerCase() === metricId.toLowerCase();
                }
                return m.id === metricId || m.metric_id === metricId;
              });
              
              // Combinar la información, fusionando parámetros del catálogo con los del proyecto
              const catalogParams = fullMetricInfo?.parameters || {};
              const projectParams = metric.parameters || {};
              return {
                ...metric,
                name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
                description: fullMetricInfo?.description || metric.description || 'Sin descripción',
                category: fullMetricInfo?.category || metric.category || 'general',
                parameters: { ...catalogParams, ...projectParams },
              };
            });
            setMetrics(projectMetrics);
          } else {
            console.log('No se encontraron métricas en el proyecto ni en la API');
            setMetrics([]);
          }
        }

        setLoading(false);
        
        // Cargar historial de análisis del proyecto (Sonar-Lite)
        setAnalysisLoading(true);
        try {
          const runsResponse = await analysisAPI.getProjectAnalysisRuns(projectId);
          // Extract analysis_runs from response: { data: { data: { analysis_runs: [...] } } }
          const runsData = runsResponse.data?.data?.analysis_runs || 
                          runsResponse.data?.analysis_runs || 
                          [];
          setAnalysisRuns(Array.isArray(runsData) ? runsData : []);
        } catch (runsError) {
          console.warn('Error al cargar historial de análisis:', runsError);
          setAnalysisRuns([]);
        }
        setAnalysisLoading(false);
      } catch (error: any) {
        console.error('Error al cargar datos del proyecto:', error);
        setError(error.response?.data?.message || 'Error al cargar datos del proyecto. Inténtelo de nuevo.');
        setLoading(false);
      }
    };

    // Solo cargar si el router está listo y tenemos un ID
    if (router.isReady && projectId !== undefined) {
      fetchProjectData();
    } else if (router.isReady && (projectId === undefined || isNaN(projectId))) {
      // Si el router está listo pero el ID no es válido, mostrar error
      setLoading(false);
      setError('ID de proyecto inválido o no especificado.');
    }
  }, [projectId, router.isReady]);

  // Manejadores de eventos
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!project) return;
    
    setDeleteLoading(true);
    setError(null);
    
    try {
      await projectsAPI.deleteProject(project.id);
      
      // Redireccionar a la lista de proyectos
      router.push('/projects');
    } catch (error: any) {
      console.error('Error al eliminar el proyecto:', error);
      setError(error.response?.data?.message || 'Error al eliminar el proyecto. Inténtelo de nuevo.');
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleConfigureMetrics = () => {
    // Guardar el ID del proyecto en localStorage para evitar problemas de navegación
    if (project?.id) {
      localStorage.setItem('currentProjectId', project.id.toString());
    }
    router.push(`/metrics/configure/${project?.id}`);
  };

  const handleAddDataset = () => {
    // Guardar el ID del proyecto en localStorage para la página de carga
    if (project?.id) {
      localStorage.setItem('currentProjectId', project.id.toString());
    }
    router.push(`/datasets/upload?projectId=${project?.id}`);
  };

  // Renderizado para estado de carga
  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  // Renderizado para estado de error
  if (error || !project) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Proyecto no encontrado
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Proyecto no encontrado'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: GREEN,
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: GREEN_HOVER,
              },
            }}
          >
            Volver a Proyectos
          </Button>
        </Box>
      </MainLayout>
    );
  }

  // Renderizado principal
  return (
    <MainLayout currentPage={project.name}>
      <Box sx={{ mb: 4 }}>
        {/* Cabecera */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/projects')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {project.name}
            </Typography>
            {project.description && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {project.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              sx={{
                borderColor: RED,
                color: RED,
                '&:hover': {
                  borderColor: '#D03E43',
                  backgroundColor: 'rgba(229, 72, 77, 0.04)',
                },
              }}
            >
              Eliminar
            </Button>
          </Box>
        </Box>

        {/* Panel de información del proyecto */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            backgroundColor: '#FAFAFA',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500, color: '#1A1A1A' }}>
            Información del proyecto
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Fecha de creación
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {project.created_at ? new Date(project.created_at).toLocaleDateString() : '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Última actualización
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Datasets
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {datasets.length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Métricas aplicadas
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {metrics.length}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Pestañas */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="project tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
              },
              '& .Mui-selected': {
                color: GREEN,
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: GREEN,
              },
            }}
          >
            <Tab label="Datasets" id="project-tab-0" aria-controls="project-tabpanel-0" />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Métricas
                  {metrics.length > 0 && (
                    <Box component="span" sx={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 18, height: 18, px: 0.5,
                      borderRadius: '9px', fontSize: '0.65rem', fontWeight: 700,
                      backgroundColor: tabValue === 1 ? GREEN : 'rgba(0,179,126,0.15)',
                      color: tabValue === 1 ? '#fff' : GREEN,
                      lineHeight: 1,
                    }}>
                      {metrics.length}
                    </Box>
                  )}
                </Box>
              }
              id="project-tab-1" aria-controls="project-tabpanel-1"
            />
            <Tab label="Historial de análisis" id="project-tab-2" aria-controls="project-tabpanel-2" />
            <Tab label="Quality Gate" id="project-tab-3" aria-controls="project-tabpanel-3" />
          </Tabs>
        </Box>

        {/* Pestaña de Datasets */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Datasets del proyecto
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddDataset}
              sx={{
                backgroundColor: GREEN,
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: GREEN_HOVER,
                },
              }}
            >
              Añadir dataset
            </Button>
          </Box>

          {datasets.length > 0 ? (
            <TableContainer component={Paper} sx={{ boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' }}>
              <Table aria-label="datasets table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Versión</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Filas</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Columnas</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha de creación</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DatasetIcon sx={{ color: GREEN }} />
                          <Typography variant="body2">
                            {dataset.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`v${dataset.version || 1}`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(0, 179, 126, 0.1)',
                            color: GREEN,
                            fontWeight: 500,
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>
                      <TableCell>{typeof dataset.row_count === 'number' ? dataset.row_count.toLocaleString() : '—'}</TableCell>
                      <TableCell>{typeof dataset.column_count === 'number' ? dataset.column_count : '—'}</TableCell>
                      <TableCell>{dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => router.push(`/datasets/${dataset.id}`)}
                          sx={{
                            borderColor: GREEN,
                            color: GREEN,
                            '&:hover': {
                              borderColor: GREEN_HOVER,
                              backgroundColor: 'rgba(0, 179, 126, 0.04)',
                            },
                          }}
                        >
                          Ver detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box 
              sx={{ 
                p: 4, 
                textAlign: 'center', 
                borderRadius: 2, 
                border: '2px dashed #E0E0E0',
                backgroundColor: '#FAFAFA',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 2,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 179, 126, 0.1)',
                  mb: 2,
                }}
              >
                <DatasetIcon sx={{ fontSize: 40, color: GREEN }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: '#1A1A1A' }}>
                Aún no hay datasets
              </Typography>
              <Typography variant="body2" sx={{ color: '#666666' }}>
                Comienza añadiendo tu primer dataset
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Pestaña de Métricas */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Métricas configuradas
            </Typography>
            <Button
              variant="contained"
              startIcon={<SettingsIcon />}
              onClick={handleConfigureMetrics}
              sx={{
                backgroundColor: GREEN,
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: GREEN_HOVER,
                },
              }}
            >
              Configurar métricas
            </Button>
          </Box>

          {metrics.length > 0 ? (
            <>
              {/* ── Grid de tarjetas fijas ── */}
              <Grid container spacing={2}>
                {metrics.map((metric) => {
                  const meta = getMetricMeta(metric.name);
                  const IconComponent = meta.icon;
                  const cardId = metric.id || metric.metric_id;
                  const isSelected = drawerMetric?.id === cardId || drawerMetric?.metric_id === cardId;

                  return (
                    <Grid item xs={12} sm={6} md={4} key={cardId}>
                      <Card
                        onClick={() => setDrawerMetric(metric)}
                        sx={{
                          cursor: 'pointer',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 2,
                          border: `1px solid ${isSelected ? meta.color + '66' : '#EEEEEE'}`,
                          borderLeft: `4px solid ${meta.color}`,
                          boxShadow: isSelected
                            ? `0 0 0 2px ${meta.color}33, 0px 4px 16px rgba(0,0,0,0.10)`
                            : '0px 1px 4px rgba(0,0,0,0.06)',
                          transition: 'box-shadow 0.2s, border-color 0.2s',
                          '&:hover': {
                            boxShadow: `0px 4px 16px rgba(0,0,0,0.10)`,
                            borderColor: meta.color + '66',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2.5, flexGrow: 1, '&:last-child': { pb: 2.5 } }}>
                          {/* Cabecera: icono + nombre + badge */}
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                            <Box sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 38, height: 38, borderRadius: '9px',
                              backgroundColor: meta.bg, flexShrink: 0,
                            }}>
                              <IconComponent size={19} color={meta.color} strokeWidth={1.8} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: '#1A1A1A', lineHeight: 1.2, mb: 0.4 }}>
                                {metric.name || `Métrica ${cardId}`}
                              </Typography>
                              <Chip
                                label={meta.category}
                                size="small"
                                sx={{
                                  height: 17, fontSize: '0.65rem', fontWeight: 600,
                                  color: meta.color, backgroundColor: meta.bg,
                                  border: `1px solid ${meta.color}33`,
                                }}
                              />
                            </Box>
                            <ChevronRightIcon sx={{ color: '#CCC', fontSize: 18, flexShrink: 0, mt: 0.3 }} />
                          </Box>

                          {/* Descripción truncada */}
                          <Typography variant="body2" color="text.secondary" sx={{
                            fontSize: '0.8rem', lineHeight: 1.5,
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {metric.description || 'Sin descripción'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              {/* ── Drawer lateral de parámetros ── */}
              <Drawer
                anchor="right"
                open={Boolean(drawerMetric)}
                onClose={() => setDrawerMetric(null)}
                PaperProps={{
                  sx: {
                    width: { xs: '100%', sm: 400 },
                    borderLeft: drawerMetric ? `4px solid ${getMetricMeta(drawerMetric.name).color}` : 'none',
                  },
                }}
              >
                {drawerMetric && (() => {
                  const metricKey = (drawerMetric.name || '').toLowerCase().replace(/ /g, '_');
                  const meta = getMetricMeta(drawerMetric.name);
                  const IconComponent = meta.icon;
                  const params = drawerMetric.parameters ? Object.entries(drawerMetric.parameters) : [];
                  const paramHelp = PARAM_HELP[metricKey] ?? {};

                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* ── Header ── */}
                      <Box sx={{
                        px: 3, py: 2.5,
                        borderBottom: '1px solid #EEEEEE',
                        flexShrink: 0,
                      }}>
                        {/* Top row: icon + close */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 44, height: 44, borderRadius: '12px',
                            backgroundColor: meta.bg, flexShrink: 0,
                          }}>
                            <IconComponent size={22} color={meta.color} strokeWidth={1.8} />
                          </Box>
                          <IconButton size="small" onClick={() => setDrawerMetric(null)} sx={{ mt: -0.5, mr: -0.5 }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* Metric title (human-readable label) */}
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2, mb: 0.5 }}>
                          {meta.label}
                        </Typography>

                        {/* Category chip */}
                        <Chip
                          label={meta.category}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem', fontWeight: 600,
                            color: meta.color, backgroundColor: meta.bg,
                            border: `1px solid ${meta.color}33`,
                          }}
                        />
                      </Box>

                      {/* ── Contenido scrollable ── */}
                      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 3, py: 2.5 }}>

                        {/* Descripción de la métrica */}
                        <Typography variant="caption" sx={{
                          fontWeight: 700, color: '#999', textTransform: 'uppercase',
                          letterSpacing: '0.07em', display: 'block', mb: 1,
                        }}>
                          ¿Qué mide?
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.65, color: '#444', mb: 3 }}>
                          {meta.description || drawerMetric.description || 'Sin descripción disponible.'}
                        </Typography>

                        {/* Parámetros */}
                        {params.length > 0 ? (
                          <>
                            <Typography variant="caption" sx={{
                              fontWeight: 700, color: '#999', textTransform: 'uppercase',
                              letterSpacing: '0.07em', display: 'block', mb: 1.5,
                            }}>
                              Parámetros configurados
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {params.map(([key, value]) => {
                                const help = paramHelp[key];
                                return (
                                  <Box key={key} sx={{
                                    borderRadius: 2,
                                    border: '1px solid #EEEEEE',
                                    overflow: 'hidden',
                                  }}>
                                    {/* Param header: label + value */}
                                    <Box sx={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      px: 1.5, py: 1,
                                      backgroundColor: '#F8F9FA',
                                      borderBottom: help ? '1px solid #EEEEEE' : 'none',
                                    }}>
                                      <Box>
                                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#333' }}>
                                          {help?.label ?? key}
                                        </Typography>
                                        {help?.unit && (
                                          <Typography sx={{ fontSize: '0.68rem', color: '#AAA', lineHeight: 1 }}>
                                            {help.unit}
                                          </Typography>
                                        )}
                                      </Box>
                                      <Typography sx={{
                                        fontSize: '0.8rem', fontWeight: 700,
                                        color: meta.color,
                                        textAlign: 'right', wordBreak: 'break-word',
                                        maxWidth: '55%', ml: 1,
                                      }}>
                                        {formatParamValue(value)}
                                      </Typography>
                                    </Box>

                                    {/* Param description */}
                                    {help?.description && (
                                      <Box sx={{ px: 1.5, py: 0.75, backgroundColor: '#FFFFFF' }}>
                                        <Typography sx={{ fontSize: '0.76rem', color: '#777', lineHeight: 1.55 }}>
                                          {help.description}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                );
                              })}
                            </Box>
                          </>
                        ) : (
                          <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#F8F9FA', border: '1px solid #EEEEEE' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#888' }}>
                              No hay parámetros configurados. Se usarán los valores por defecto.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })()}
              </Drawer>
            </>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 70, height: 70, borderRadius: '50%',
                  backgroundColor: 'rgba(0, 179, 126, 0.1)', mb: 2,
                }}
              >
                <DEFAULT_METRIC_META.icon size={40} color={GREEN} strokeWidth={1.5} />
              </Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: '#1A1A1A' }}>
                No hay métricas configuradas
              </Typography>
              <Typography variant="body2" sx={{ color: '#666666' }}>
                Configura métricas para evaluar la calidad de tus datasets.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Pestaña de Historial de análisis */}
        <TabPanel value={tabValue} index={2}>
          {projectId && (
            <Box>
              {/* Zona A — Selector de dataset */}
              <DatasetSelector
                runs={analysisRuns}
                datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version, parent_dataset_id: d.parent_dataset_id }))}
                selectedDatasetId={selectedDatasetId}
                onSelect={(id) => setSelectedDatasetId(id)}
                qualityGateThreshold={qualityGateThreshold}
              />

              {/* Zona B — KPIs + gráfica unificada */}
              <AnalysisDashboardPanel
                projectId={projectId}
                runs={analysisRuns}
                datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version, parent_dataset_id: d.parent_dataset_id }))}
                selectedDatasetId={selectedDatasetId}
                qualityGateThreshold={qualityGateThreshold}
              />

              {/* Zona C — Tabla de análisis */}
              <AnalysisHistory
                runs={selectedDatasetId
                  ? (() => {
                      const findRoot = (dsId: number): number => {
                        const ds = datasets.find((d: any) => d.id === dsId);
                        if (!ds || !ds.parent_dataset_id) return dsId;
                        return findRoot(ds.parent_dataset_id);
                      };
                      const rootId = findRoot(selectedDatasetId);
                      const chainIds = datasets
                        .filter((d: any) => findRoot(d.id) === rootId)
                        .map((d: any) => d.id);
                      return analysisRuns.filter((r: AnalysisRun) => chainIds.includes(r.dataset_id));
                    })()
                  : analysisRuns
                }
                projectId={projectId}
                loading={analysisLoading}
                datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version }))}
                selectedDatasetId={selectedDatasetId}
              />
            </Box>
          )}
        </TabPanel>

        {/* Pestaña de Quality Gate */}
        <TabPanel value={tabValue} index={3}>
          {projectId && (
            <QualityGateSettings
              projectId={projectId}
              onThresholdsLoaded={(t) => setQualityGateThreshold(t.min_score)}
            />
          )}
        </TabPanel>

      </Box>

      {/* Diálogo de confirmación de eliminación */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"¿Eliminar Proyecto?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            ¿Estás seguro de que deseas eliminar el proyecto "{project.name}"? Esta acción no se puede deshacer y eliminará todos los datasets y evaluaciones asociados.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            autoFocus
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default ProjectDetail;
