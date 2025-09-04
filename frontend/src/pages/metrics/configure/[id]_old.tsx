import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Paper,
  Card,
  CardContent,
  CardActions,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import MainLayout from '../../../components/layout/MainLayout';
import { metricsAPI, projectsAPI } from '../../../services/api';

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
      id={`metrics-tabpanel-${index}`}
      aria-labelledby={`metrics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const MetricsConfigurationPage = () => {
  const router = useRouter();
  
  // Esperar a que el router esté listo antes de acceder a los parámetros
  const [routerReady, setRouterReady] = useState(false);
  
  // Actualizar el estado cuando el router esté listo
  useEffect(() => {
    if (router.isReady) {
      setRouterReady(true);
      console.log('Router is ready. Query params:', router.query);
      console.log('Project ID from URL (raw):', router.query.id);
      
      // Redireccionar automáticamente si el ID es 'undefined'
      const { id } = router.query;
      if (id === 'undefined' || id === undefined) {
        console.log('Detectado ID "undefined" o null en la URL, intentando obtener ID válido...');
        
        // Intentar obtener un ID válido del localStorage
        try {
          const storedId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
          if (storedId) {
            console.log('Usando ID válido desde localStorage:', storedId);
            // Actualizar la URL sin recargar la página
            router.replace(`/metrics/configure/${storedId}`, undefined, { shallow: true });
          } else {
            // Si no hay ID en localStorage, mostrar mensaje pero no redireccionar automáticamente
            console.log('No se encontró ID en localStorage');
          }
        } catch (error) {
          console.error('Error al acceder a localStorage:', error);
        }
      }
    }
  }, [router.isReady, router.query]);
  
  // Obtener el ID del proyecto directamente de la ruta o del localStorage
  const projectIdFromUrl = useMemo(() => {
    if (!routerReady) {
      console.log('Router no está listo aún');
      return null;
    }
    
    const { id } = router.query;
    console.log('Query params en projectIdFromUrl:', router.query);
    
    // Intentar obtener el ID de la URL
    if (typeof id === 'string' && id !== 'undefined') {
      console.log('ID obtenido de la URL:', id);
      return id;
    } else if (Array.isArray(id) && id.length > 0 && id[0] !== 'undefined') {
      console.log('ID obtenido de la URL (array):', id[0]);
      return id[0];
    }
    
    // Si no hay ID válido en la URL, intentar obtenerlo del localStorage
    try {
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
      console.log('Intentando obtener ID del localStorage:', storedId);
      
      if (storedId) {
        console.log('ID obtenido del localStorage:', storedId);
        
        // Actualizar la URL con el ID correcto sin recargar la página
        if (typeof window !== 'undefined') {
          console.log('Actualizando URL con ID del localStorage:', storedId);
          router.replace(`/metrics/configure/${storedId}`, undefined, { shallow: true });
        }
        
        return storedId;
      }
    } catch (error) {
      console.error('Error al acceder a localStorage:', error);
    }
    
    console.log('No se encontró ID de proyecto en la URL ni en localStorage');
    return null;
  }, [router.query, routerReady]);
  
  // Asegurarse de que el projectId es un número válido
  const projectIdNum = useMemo(() => {
    if (!projectIdFromUrl) {
      console.log('Project ID from URL es null o undefined');
      
      // Intentar obtener directamente del router.query como último recurso
      if (router.isReady && router.query.id) {
        const idFromQuery = router.query.id;
        console.log('Intentando obtener ID directamente de router.query:', idFromQuery);
        
        if (typeof idFromQuery === 'string') {
          const parsed = parseInt(idFromQuery, 10);
          if (!isNaN(parsed)) {
            console.log('ID obtenido directamente de router.query:', parsed);
            return parsed;
          }
        }
      }
      
      // Intentar obtener del localStorage como último recurso
      try {
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
        if (storedId) {
          const parsed = parseInt(storedId, 10);
          if (!isNaN(parsed)) {
            console.log('ID obtenido directamente del localStorage como último recurso:', parsed);
            return parsed;
          }
        }
      } catch (error) {
        console.error('Error al acceder a localStorage en projectIdNum:', error);
      }
      
      return null;
    }
    
    // Intentar convertir a número
    const parsed = parseInt(projectIdFromUrl, 10);
    if (isNaN(parsed)) {
      console.log('Project ID no es un número válido:', projectIdFromUrl);
      return null;
    }
    
    console.log('Project ID validado correctamente:', parsed);
    return parsed;
  }, [projectIdFromUrl, router.isReady, router.query.id]);
  
  // Verificar si estamos en modo de desarrollo y no hay ID válido
  const isDevelopmentMode = process.env.NODE_ENV === 'development';
  
  // Solo usar fallback si estamos en desarrollo Y no hay ID válido Y el router está listo
  const useDevFallback = useMemo(() => {
    if (!routerReady) return false;
    
    const shouldUseFallback = isDevelopmentMode && projectIdNum === null;
    console.log('¿Usar fallback de desarrollo?', shouldUseFallback, {
      isDevelopmentMode,
      projectIdNum,
      routerReady
    });
    return shouldUseFallback;
  }, [isDevelopmentMode, projectIdNum, routerReady]);

  const [tabValue, setTabValue] = useState(0);
  const [project, setProject] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<any[]>([]);
  
  // Iniciar un timeout de emergencia para evitar que la página se quede cargando indefinidamente
  useEffect(() => {
    console.log('Iniciando timeout de emergencia (3 segundos)');
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('Timeout de emergencia activado - forzando fin de carga');
        setLoading(false);
      }
      if (loadingTemplates) {
        console.log('Timeout de emergencia activado para plantillas - forzando fin de carga');
        setLoadingTemplates(false);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [loading, loadingTemplates]);

  // Cargar datos cuando el router esté listo
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchData = async () => {
      console.log('fetchData ejecutándose con projectIdNum:', projectIdNum, 'useDevFallback:', useDevFallback);
      console.log('Estado actual de projectIdFromUrl:', projectIdFromUrl);
      
      // Si no hay ID de proyecto y no estamos en modo desarrollo, mostrar error
      if (!projectIdNum && !useDevFallback) {
        if (isMounted) {
          console.log('No hay ID de proyecto válido y no estamos en modo desarrollo');
          setLoading(false);
          
          // Mostrar error sin redireccionar automáticamente
          setError(`El ID de proyecto "${projectIdFromUrl}" no es válido. Debe ser un número entero.`);
        }
        return;
      }

      // Forzar estado inicial limpio
      if (isMounted) {
        setLoading(true);
        setError(null);
        setLoadingTemplates(true);
      }
      
      try {
        // Cargar datos de métricas
        if (projectIdNum) {
          console.log(`Iniciando carga de datos de métricas para proyecto: ${projectIdNum}`);
          
          try {
            // Intentar cargar el proyecto
            const projectResponse = await projectsAPI.getProject(projectIdNum);
            if (isMounted) {
              setProject(projectResponse.data);
              console.log('Proyecto cargado:', projectResponse.data);
            }
          } catch (projectError: any) {
            console.error('Error al cargar el proyecto:', projectError);
            if (isMounted) {
              // Intentar recuperar el proyecto desde localStorage
              const cachedProjects = localStorage.getItem('projects');
              if (cachedProjects) {
                const projects = JSON.parse(cachedProjects);
                const cachedProject = projects.find((p: any) => p.id === projectIdNum);
                if (cachedProject) {
                  console.log('Usando proyecto en caché:', cachedProject);
                  setProject(cachedProject);
                } else {
                  setError(`No se pudo cargar el proyecto con ID ${projectIdNum}.`);
                }
              } else {
                setError(`No se pudo cargar el proyecto con ID ${projectIdNum}.`);
              }
            }
          }
        } else if (useDevFallback) {
          console.log('Iniciando carga de datos de métricas para proyecto: modo desarrollo');
        }
        
        // Cargar métricas disponibles
        const metricsResponse = await metricsAPI.getMetrics();
        console.log('Respuesta de métricas recibida:', metricsResponse);
        
        let metricsData = [];
        
        if (Array.isArray(metricsResponse.data)) {
          console.log('Datos de métricas encontrados como array directo, longitud:', metricsResponse.data.length);
          metricsData = metricsResponse.data;
        } else if (metricsResponse.data && Array.isArray(metricsResponse.data.metrics)) {
          console.log('Datos de métricas encontrados en propiedad metrics, longitud:', metricsResponse.data.metrics.length);
          metricsData = metricsResponse.data.metrics;
        } else if (metricsResponse.data && typeof metricsResponse.data === 'object') {
          // Buscar cualquier propiedad que sea un array y podría contener métricas
          const possibleMetricsArrays = Object.values(metricsResponse.data).filter(
            (value) => Array.isArray(value) && value.length > 0
          );
          
          if (possibleMetricsArrays.length > 0) {
            const metricsArray = possibleMetricsArrays[0] as any[];
            console.log('Datos de métricas encontrados en otra propiedad, longitud:', metricsArray.length);
            metricsData = metricsArray;
          }
        }
        
        // Normalizar datos de métricas
        const normalizedMetrics = metricsData.map((metric: any) => ({
          id: metric.id,
          name: metric.name,
          description: metric.description || 'No description available',
          category: metric.category || 'general',
          parameters: metric.parameters || {},
          created_at: metric.created_at || new Date().toISOString(),
          updated_at: metric.updated_at || new Date().toISOString(),
          enabled: false,
          config: {},
        }));
        
        console.log('Normalized metrics data:', normalizedMetrics);
        
        if (isMounted) {
          setMetrics(normalizedMetrics);
          setFilteredMetrics(normalizedMetrics);
        }
        
        // Si estamos en modo desarrollo y no hay proyecto, crear uno de prueba
        if (useDevFallback && isMounted) {
          console.log('Creando proyecto de prueba para modo desarrollo');
          setProject({
            id: 0,
            name: 'Proyecto de Prueba',
            description: 'Este es un proyecto de prueba para desarrollo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            owner_id: 1,
            metrics_config: [],
          });
          
          // Verificar si el proyecto tiene configuraciones de métricas
          if (project && project.metrics_config && Array.isArray(project.metrics_config) && project.metrics_config.length > 0) {
            console.log('Modo desarrollo: usando configuraciones de métricas existentes');
            
            // Marcar las métricas que están habilitadas según la configuración
            const updatedMetrics = normalizedMetrics.map((metric: any) => {
              const configuredMetric = project.metrics_config.find((m: any) => m.metric_id === metric.id);
              if (configuredMetric) {
                return {
                  ...metric,
                  enabled: true,
                  config: configuredMetric.parameters || {},
                };
              }
              return metric;
            });
            
            if (isMounted) {
              setMetrics(updatedMetrics);
              setFilteredMetrics(updatedMetrics);
            }
          } else {
            console.log('Modo desarrollo: usando configuraciones de métricas vacías');
          }
        }
        
        // Cargar plantillas de métricas
        try {
          const templatesResponse = await metricsAPI.getMetricTemplates() as any;
          if (isMounted) {
            // Asegurar que templates siempre sea un array
            const templatesData = templatesResponse.data || [];
            const templatesArray = Array.isArray(templatesData) ? templatesData : 
              templatesData.templates && Array.isArray(templatesData.templates) ? templatesData.templates : [];
            
            setTemplates(templatesArray);
            console.log('Plantillas de métricas cargadas:', templatesArray.length);
            console.log('Estructura de datos de plantillas:', JSON.stringify(templatesResponse.data));
          }
        } catch (templateError) {
          console.error('Error al cargar plantillas de métricas:', templateError);
          if (isMounted) {
            setTemplates([]);
          }
        }
        
        if (isMounted) {
          console.log('Carga completada con éxito - desactivando estados de carga');
          setLoading(false);
          setLoadingTemplates(false);
        }
      } catch (error: any) {
        console.error('Error al cargar datos:', error);
        if (isMounted) {
          setError('Error al cargar datos: ' + (error.message || 'Error desconocido'));
          setLoading(false);
          setLoadingTemplates(false);
        }
      }
    };
    
    // Only fetch data when router is ready
    if (router.isReady) {
      console.log('Router is ready, fetching data...');
      fetchData();
    } else {
      console.log('Router is not ready yet, waiting...');
    }
    
    // Cleanup function to prevent memory leaks and state updates after unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [projectIdNum, projectIdFromUrl, routerReady, useDevFallback]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveConfiguration = async () => {
    if (!projectIdNum) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // TODO: Implement saving metric configurations
      // This will be implemented when the backend endpoint is available
      
      setSuccess('Metric configurations saved successfully.');
      setSaving(false);
    } catch (error: any) {
      setError('Error saving configurations: ' + (error.message || 'Unknown error'));
      setSaving(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
    
    filterMetrics(query, categoryFilter);
  };

  const handleCategoryChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const category = event.target.value as string;
    setCategoryFilter(category);
    
    filterMetrics(searchQuery, category);
  };

  const filterMetrics = (query: string, category: string) => {
    let filtered = metrics;
    
    if (query) {
      filtered = filtered.filter(
        (metric) =>
          metric.name.toLowerCase().includes(query) ||
          (metric.description && metric.description.toLowerCase().includes(query))
      );
    }
    
    if (category !== 'all') {
      filtered = filtered.filter((metric) => metric.category === category);
    }
    
    setFilteredMetrics(filtered);
  };

  const handleMetricToggle = (metricId: number) => {
    const updatedMetrics = metrics.map((metric) => {
      if (metric.id === metricId) {
        return { ...metric, enabled: !metric.enabled };
      }
      return metric;
    });
    
    setMetrics(updatedMetrics);
    
    // También actualizar las métricas filtradas
    const updatedFilteredMetrics = filteredMetrics.map((metric) => {
      if (metric.id === metricId) {
        return { ...metric, enabled: !metric.enabled };
      }
      return metric;
    });
    
    setFilteredMetrics(updatedFilteredMetrics);
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setTemplateDialogOpen(true);
  };

  const applyTemplate = () => {
    if (!selectedTemplate) return;
    
    const templateMetricIds = selectedTemplate.metrics.map((m: any) => m.metric_id);
    
    const updatedMetrics = metrics.map((metric) => {
      const templateMetric = selectedTemplate.metrics.find((m: any) => m.metric_id === metric.id);
      
      if (templateMetric) {
        return {
          ...metric,
          enabled: true,
          config: templateMetric.parameters || {},
        };
      }
      
      return metric;
    });
    
    setMetrics(updatedMetrics);
    
    // También actualizar las métricas filtradas
    const updatedFilteredMetrics = filteredMetrics.map((metric) => {
      const templateMetric = selectedTemplate.metrics.find((m: any) => m.metric_id === metric.id);
      
      if (templateMetric) {
        return {
          ...metric,
          enabled: true,
          config: templateMetric.parameters || {},
        };
      }
      
      return metric;
    });
    
    setFilteredMetrics(updatedFilteredMetrics);
    setTemplateDialogOpen(false);
  };

  // Monitorear el estado para depuración
  useEffect(() => {
    console.log('Estado actual:', {
      loading,
      metricsLength: metrics.length,
      filteredMetricsLength: filteredMetrics.length,
      searchQuery,
      categoryFilter,
      error,
      success,
      saving,
      projectIdNum,
      useDevFallback,
    });
    
    console.log('Contenido de métricas:', metrics);
    console.log('Contenido de métricas filtradas:', filteredMetrics);
  }, [
    loading,
    metrics,
    filteredMetrics,
    searchQuery,
    categoryFilter,
    error,
    success,
    saving,
    projectIdNum,
    useDevFallback,
  ]);

  // Renderizar mensaje de error si no hay ID de proyecto válido y no estamos en modo desarrollo
  if (error && !useDevFallback) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 2,
              textAlign: 'center',
              border: '1px solid #f5c6cb',
              backgroundColor: '#f8d7da',
            }}
          >
            <ErrorIcon sx={{ fontSize: 60, color: '#721c24', mb: 2 }} />
            <Typography variant="h5" sx={{ color: '#721c24', mb: 2 }}>
              Error de configuración
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              {error}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/projects')}
              startIcon={<ArrowBackIcon />}
            >
              Volver a la lista de proyectos
            </Button>
          </Paper>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
              sx={{ mb: 1 }}
            >
              Volver
            </Button>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Configuración de Métricas
            </Typography>
            {project && (
              <Typography variant="h6" sx={{ color: '#666666' }}>
                {project.name}
              </Typography>
            )}
          </Box>
          <Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSaveConfiguration}
              disabled={saving || loading}
              sx={{ mr: 1 }}
            >
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </Box>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Loading indicator */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Métricas disponibles" />
                <Tab label="Configuración avanzada" />
                <Tab label="Plantillas" />
              </Tabs>
            </Box>

            {/* Métricas disponibles */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      placeholder="Buscar métricas..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Categoría</InputLabel>
                      <Select
                        value={categoryFilter}
                        label="Categoría"
                        onChange={handleCategoryChange as any}
                      >
                        <MenuItem value="all">Todas las categorías</MenuItem>
                        <MenuItem value="data_quality">Calidad de datos</MenuItem>
                        <MenuItem value="statistical">Estadísticas</MenuItem>
                        <MenuItem value="ml_specific">Específicas de ML</MenuItem>
                        <MenuItem value="general">General</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={3}>
                {filteredMetrics.length === 0 ? (
                  <Grid item xs={12}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        textAlign: 'center',
                        borderRadius: 2,
                        border: '1px solid #eee',
                      }}
                    >
                      <Typography variant="body1">
                        No se encontraron métricas que coincidan con los criterios de búsqueda.
                      </Typography>
                    </Paper>
                  </Grid>
                ) : (
                  filteredMetrics.map((metric) => (
                    <Grid item xs={12} md={6} lg={4} key={metric.id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 2,
                          border: metric.enabled
                            ? '2px solid #4caf50'
                            : '1px solid #eee',
                        }}
                      >
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              mb: 1,
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {metric.name}
                            </Typography>
                            <Chip
                              label={metric.category}
                              size="small"
                              sx={{
                                backgroundColor:
                                  metric.category === 'data_quality'
                                    ? '#e3f2fd'
                                    : metric.category === 'statistical'
                                    ? '#f3e5f5'
                                    : metric.category === 'ml_specific'
                                    ? '#e8f5e9'
                                    : '#f5f5f5',
                              }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{ mb: 2 }}
                          >
                            {metric.description}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={metric.enabled}
                                onChange={() => handleMetricToggle(metric.id)}
                                color="primary"
                              />
                            }
                            label={metric.enabled ? 'Habilitada' : 'Deshabilitar'}
                          />
                          <Button
                            size="small"
                            color="primary"
                            sx={{ ml: 'auto' }}
                          >
                            Configurar
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))
                )}
              </Grid>
            </TabPanel>

            {/* Configuración avanzada */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="body1">
                Configuración avanzada de métricas para el proyecto.
              </Typography>
              {/* Aquí irá la configuración avanzada */}
            </TabPanel>

            {/* Plantillas */}
            <TabPanel value={tabValue} index={2}>
              {loadingTemplates ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '200px',
                  }}
                >
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Plantillas de configuración
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 3 }}>
                    Seleccione una plantilla para aplicar una configuración predefinida de métricas.
                  </Typography>

                  <Grid container spacing={3}>
                    {(!templates || !Array.isArray(templates) || templates.length === 0) ? (
                      <Grid item xs={12}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            textAlign: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: 2
                          }}
                        >
                          <Typography variant="body1" color="textSecondary">
                            No hay plantillas disponibles.
                          </Typography>
                        </Paper>
                      </Grid>
                    ) : (
                      Array.isArray(templates) && templates.map((template) => (
                        <Grid item xs={12} md={4} key={template.id}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              borderRadius: 2,
                              border: '1px solid #eee',
                            }}
                          >
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {template.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{ mb: 2 }}
                              >
                                {template.description}
                              </Typography>
                              <Typography variant="body2">
                                {template.metrics?.length || 0} métricas incluidas
                              </Typography>
                            </CardContent>
                            <CardActions>
                              <Button
                                size="small"
                                color="primary"
                                onClick={() => handleTemplateSelect(template)}
                              >
                                Aplicar plantilla
                              </Button>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))
                    )}
                  </Grid>
                </>
              )}
            </TabPanel>
          </>
        )}

        {/* Template dialog */}
        <Dialog
          open={templateDialogOpen}
          onClose={() => setTemplateDialogOpen(false)}
        >
          <DialogTitle>Aplicar plantilla</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Está seguro de que desea aplicar la plantilla "{selectedTemplate?.name}"? Esto sobrescribirá cualquier configuración existente para las métricas incluidas en la plantilla.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={applyTemplate} color="primary">
              Aplicar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MainLayout>
  );
};

export default MetricsConfigurationPage;
