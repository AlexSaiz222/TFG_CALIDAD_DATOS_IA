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
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Dataset as DatasetIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import AnalysisHistory from '../../components/AnalysisHistory';
import QualityTrendChart from '../../components/QualityTrendChart';
import DatasetStatusSnapshot from '../../components/DatasetStatusSnapshot';
import QualityGateSettings from '../../components/QualityGateSettings';
import { projectsAPI, datasetsAPI, metricsAPI, analysisAPI } from '../../services/api';
import type { AnalysisRun } from '../../types';

// Colores consistentes con el resto de la aplicación
const GREEN = '#00B37E';
const GREEN_HOVER = '#00A070';
const ORANGE = '#FFB800';
const RED = '#E5484D';

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
              'timeliness': {
                name: 'timeliness',
                description: 'Assesses if data is up-to-date'
              },
              'class_balance': {
                name: 'class_balance',
                description: 'Evaluates balance of target classes for classification tasks'
              },
              'feature_correlation': {
                name: 'feature_correlation',
                description: 'Measures correlation between features'
              },
              'drift': {
                name: 'drift',
                description: 'Detects data drift between training and production data'
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
            const fullMetricInfo = availableMetrics.find(m => 
              (m.id === metricId || m.metric_id === metricId) || 
              (typeof m.name === 'string' && typeof metric.name === 'string' && 
               m.name.toLowerCase() === metric.name.toLowerCase())
            );
            
            // Combinar la información
            return {
              ...metric,
              name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
              description: fullMetricInfo?.description || metric.description || 'Sin descripción',
              category: fullMetricInfo?.category || metric.category || 'general',
            };
          }) : [];
          
          // Si no hay métricas enriquecidas, intentar usar las del proyecto
          if (enrichedMetrics.length === 0 && Array.isArray(normalized.metrics_config) && normalized.metrics_config.length > 0) {
            console.log('Usando métricas del objeto proyecto:', normalized.metrics_config);
            const projectMetrics = normalized.metrics_config.map(metric => {
              const metricId = metric.metric_id ?? metric.id;
              // Buscar la métrica en el catálogo completo
              const fullMetricInfo = availableMetrics.find(m => 
                (m.id === metricId || m.metric_id === metricId) || 
                (typeof m.name === 'string' && typeof metric.name === 'string' && 
                 m.name.toLowerCase() === metric.name.toLowerCase())
              );
              
              // Combinar la información
              return {
                ...metric,
                name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
                description: fullMetricInfo?.description || metric.description || 'Sin descripción',
                category: fullMetricInfo?.category || metric.category || 'general',
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
              const fullMetricInfo = availableMetrics.find(m => 
                (m.id === metricId || m.metric_id === metricId) || 
                (typeof m.name === 'string' && typeof metric.name === 'string' && 
                 m.name.toLowerCase() === metric.name.toLowerCase())
              );
              
              // Combinar la información
              return {
                ...metric,
                name: fullMetricInfo?.name || metric.name || `Métrica ${metricId}`,
                description: fullMetricInfo?.description || metric.description || 'Sin descripción',
                category: fullMetricInfo?.category || metric.category || 'general',
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
    <MainLayout>
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
            <Button
              variant="contained"
              startIcon={<SettingsIcon sx={{ color: '#FFFFFF' }} />}
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
            <Tab label="Métricas" id="project-tab-1" aria-controls="project-tabpanel-1" />
            <Tab label="Historial de Análisis" id="project-tab-2" aria-controls="project-tabpanel-2" />
            <Tab label="Quality Gate" id="project-tab-3" aria-controls="project-tabpanel-3" />
          </Tabs>
        </Box>

        {/* Pestaña de Datasets */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Datasets del Proyecto
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
              Añadir Dataset
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
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <DatasetIcon sx={{ fontSize: 60, color: ORANGE, opacity: 0.7, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                No hay datasets en este proyecto
              </Typography>
              <Typography variant="body1" sx={{ color: '#555555', mb: 3 }}>
                Añade un dataset para comenzar a evaluar la calidad de tus datos.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Pestaña de Métricas */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Métricas Configuradas
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
            <Grid container spacing={3}>
              {metrics.map((metric) => (
                <Grid item xs={12} sm={6} md={4} key={metric.id || metric.metric_id}>
                  <Card sx={{ height: '100%', boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AssessmentIcon sx={{ color: GREEN }} />
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                          {metric.name || `Métrica ${metric.metric_id || metric.id}`}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {metric.description || 'Sin descripción'}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                        Parámetros:
                      </Typography>
                      {metric.parameters && Object.keys(metric.parameters).length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {Object.entries(metric.parameters).map(([key, value]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${value}`}
                              size="small"
                              sx={{ backgroundColor: '#F0F0F0' }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No hay parámetros configurados
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <AssessmentIcon sx={{ fontSize: 60, color: ORANGE, opacity: 0.7, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                No hay métricas configuradas
              </Typography>
              <Typography variant="body1" sx={{ color: '#555555', mb: 3 }}>
                Configura métricas para evaluar la calidad de tus datasets.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Pestaña de Historial de Análisis */}
        <TabPanel value={tabValue} index={2}>
          {projectId && (
            <Box>
              {/* 1. Estado actual de los datasets (Snapshot) */}
              <Box sx={{ mb: 4 }}>
                <DatasetStatusSnapshot
                  runs={analysisRuns}
                  datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version, parent_dataset_id: d.parent_dataset_id }))}
                  selectedDatasetId={selectedDatasetId}
                  onSelectDataset={(datasetId: number) => setSelectedDatasetId(datasetId)}
                  qualityGateThreshold={qualityGateThreshold}
                />
              </Box>
              
              {/* 2. Evolución del dataset seleccionado */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                  Evolución del dataset seleccionado
                </Typography>
                <QualityTrendChart 
                  runs={analysisRuns} 
                  qualityGateThreshold={qualityGateThreshold}
                  selectedDatasetId={selectedDatasetId}
                  datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version, parent_dataset_id: d.parent_dataset_id }))}
                />
              </Box>
              
              {/* 3. Historial de análisis (filtrado por dataset si hay uno seleccionado) */}
              <AnalysisHistory
                runs={selectedDatasetId 
                  ? analysisRuns.filter((r: AnalysisRun) => {
                      // Incluir análisis del dataset seleccionado y todas sus versiones
                      const selectedDs = datasets.find((d: any) => d.id === selectedDatasetId);
                      if (!selectedDs) return r.dataset_id === selectedDatasetId;
                      
                      // Encontrar el root de la cadena de versiones
                      const findRoot = (ds: any): number => {
                        if (!ds.parent_dataset_id) return ds.id;
                        const parent = datasets.find((d: any) => d.id === ds.parent_dataset_id);
                        return parent ? findRoot(parent) : ds.id;
                      };
                      const rootId = findRoot(selectedDs);
                      
                      // Incluir todos los datasets que pertenecen a esta cadena
                      const chainIds = datasets
                        .filter((d: any) => findRoot(d) === rootId)
                        .map((d: any) => d.id);
                      
                      return chainIds.includes(r.dataset_id);
                    })
                  : analysisRuns
                }
                projectId={projectId}
                loading={analysisLoading}
                datasets={datasets.map((d: any) => ({ id: d.id, name: d.name, version: d.version }))}
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
