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
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Info as InfoIcon,
  Assessment as AssessmentIcon,
  CloudUpload as CloudUploadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import MainLayout from '../../../components/layout/MainLayout';
import { metricsAPI, projectsAPI } from '../../../services/api';

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

  // ======== Router readiness / ID recovery logic (se mantiene) ========
  const [routerReady, setRouterReady] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      setRouterReady(true);
      const { id } = router.query;

      if (id === 'undefined' || id === undefined) {
        try {
          const storedId =
            typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
          if (storedId) {
            router.replace(`/metrics/configure/${storedId}`, undefined, { shallow: true });
          }
        } catch (error) {
          console.error('Error al acceder a localStorage:', error);
        }
      }
    }
  }, [router.isReady, router.query, router]);

  const projectIdFromUrl = useMemo(() => {
    if (!routerReady) return null;
    const { id } = router.query;

    if (typeof id === 'string' && id !== 'undefined') return id;
    if (Array.isArray(id) && id.length > 0 && id[0] !== 'undefined') return id[0];

    try {
      const storedId =
        typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
      if (storedId) {
        router.replace(`/metrics/configure/${storedId}`, undefined, { shallow: true });
        return storedId;
      }
    } catch (error) {
      console.error('Error al acceder a localStorage:', error);
    }
    return null;
  }, [router.query, routerReady, router]);

  const projectIdNum = useMemo(() => {
    if (!projectIdFromUrl) {
      if (router.isReady && router.query.id) {
        const idFromQuery = router.query.id;
        if (typeof idFromQuery === 'string') {
          const parsed = parseInt(idFromQuery, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
      try {
        const storedId =
          typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
        if (storedId) {
          const parsed = parseInt(storedId, 10);
          if (!isNaN(parsed)) return parsed;
        }
      } catch (error) {
        console.error('Error al acceder a localStorage en projectIdNum:', error);
      }
      return null;
    }
    const parsed = parseInt(projectIdFromUrl, 10);
    if (isNaN(parsed)) return null;
    return parsed;
  }, [projectIdFromUrl, router.isReady, router.query.id]);

  const isDevelopmentMode = process.env.NODE_ENV === 'development';
  const useDevFallback = useMemo(() => {
    if (!routerReady) return false;
    return isDevelopmentMode && projectIdNum === null;
  }, [isDevelopmentMode, projectIdNum, routerReady]);

  // ======== Estado de la página ========
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
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentMetric, setCurrentMetric] = useState<any>(null);

  // Timeout de emergencia (se mantiene)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
      if (loadingTemplates) setLoadingTemplates(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [loading, loadingTemplates]);

  // Carga de datos (se mantiene)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      if (!projectIdNum && !useDevFallback) {
        if (isMounted) {
          setLoading(false);
          setError(`El ID de proyecto "${projectIdFromUrl}" no es válido. Debe ser un número entero.`);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
        setLoadingTemplates(true);
      }

      try {
        // Proyecto
        if (projectIdNum) {
          try {
            const projectResponse = await projectsAPI.getProject(projectIdNum);
            if (isMounted) setProject(projectResponse.data);
          } catch (projectError: any) {
            if (isMounted) {
              const cachedProjects = localStorage.getItem('projects');
              if (cachedProjects) {
                const projects = JSON.parse(cachedProjects);
                const cachedProject = projects.find((p: any) => p.id === projectIdNum);
                if (cachedProject) {
                  setProject(cachedProject);
                } else {
                  setError(`No se pudo cargar el proyecto con ID ${projectIdNum}.`);
                }
              } else {
                setError(`No se pudo cargar el proyecto con ID ${projectIdNum}.`);
              }
            }
          }
        } else if (useDevFallback && isMounted) {
          setProject({
            id: 0,
            name: 'Proyecto de Prueba',
            description: 'Este es un proyecto de prueba para desarrollo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            owner_id: 1,
            metrics_config: [],
          });
        }

        // Métricas
        const metricsResponse = await metricsAPI.getMetrics();
        let metricsData: any[] = [];
        if (Array.isArray(metricsResponse.data)) {
          metricsData = metricsResponse.data;
        } else if (metricsResponse.data && Array.isArray(metricsResponse.data.metrics)) {
          metricsData = metricsResponse.data.metrics;
        } else if (metricsResponse.data && typeof metricsResponse.data === 'object') {
          const possibleMetricsArrays = Object.values(metricsResponse.data).filter(
            (v) => Array.isArray(v) && (v as any[]).length > 0
          ) as any[];
          if (possibleMetricsArrays.length > 0) metricsData = possibleMetricsArrays[0];
        }

        const normalizedMetrics = metricsData.map((metric: any) => ({
          id: metric.id,
          name: metric.name,
          description: metric.description || 'Sin descripción',
          category: metric.category || 'general',
          parameters: metric.parameters || {},
          created_at: metric.created_at || new Date().toISOString(),
          updated_at: metric.updated_at || new Date().toISOString(),
          enabled: false,
          config: {},
        }));

        if (isMounted) {
          setMetrics(normalizedMetrics);
          setFilteredMetrics(normalizedMetrics);
        }

        if (useDevFallback && isMounted) {
          if (project && project.metrics_config && Array.isArray(project.metrics_config) && project.metrics_config.length > 0) {
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
            setMetrics(updatedMetrics);
            setFilteredMetrics(updatedMetrics);
          }
        }

        // Cargar configuración actual si existe
        if (project?.metrics_config && Array.isArray(project.metrics_config)) {
          const selectedMetricsList = [];
          const updatedMetrics = metrics.map((metric) => {
            const existingConfig = project.metrics_config.find((m: any) => m.id === metric.id);
            if (existingConfig) {
              const configuredMetric = {
                ...metric,
                parameters: existingConfig.parameters || metric.parameters,
              };
              selectedMetricsList.push(configuredMetric);
              return configuredMetric;
            }
            return metric;
          });
          setMetrics(updatedMetrics);
          setFilteredMetrics(updatedMetrics);
          setSelectedMetrics(selectedMetricsList);
        }

        // Plantillas
        try {
          const templatesResponse = await metricsAPI.getMetricTemplates() as any;
          if (isMounted) {
            const templatesData = templatesResponse.data || [];
            const templatesArray = Array.isArray(templatesData)
              ? templatesData
              : templatesData.templates && Array.isArray(templatesData.templates)
              ? templatesData.templates
              : [];
            setTemplates(templatesArray);
          }
        } catch (templateError) {
          if (isMounted) setTemplates([]);
        }

        if (isMounted) {
          setLoading(false);
          setLoadingTemplates(false);
        }
      } catch (error: any) {
        if (isMounted) {
          setError('Error al cargar datos: ' + (error.message || 'Error desconocido'));
          setLoading(false);
          setLoadingTemplates(false);
        }
      }
    };

    if (router.isReady) fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [projectIdNum, projectIdFromUrl, routerReady, useDevFallback, router.isReady]);

  // ======== Handlers (se mantienen) ========
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveConfiguration = async () => {
    if (!project) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const configToSave = {
        project_id: project.id,
        metrics: selectedMetrics.map((metric) => ({
          id: metric.id,
          parameters: metric.parameters || {},
        })),
      };

      await metricsAPI.saveProjectMetricConfigs(project.id, configToSave);
      setSuccess('Configuración guardada correctamente');

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error al guardar la configuración de métricas:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Error al guardar la configuración de métricas'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
    filterMetrics(query, categoryFilter);
  };

  const handleCategoryChange = (event: any) => {
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

  const handleAddMetric = (metric: any) => {
    // Check if metric is already selected
    const isAlreadySelected = selectedMetrics.some(m => m.id === metric.id);
    if (isAlreadySelected) return;
    
    // Add metric to selectedMetrics
    setSelectedMetrics([...selectedMetrics, { ...metric }]);
    
    // Open configuration dialog
    setCurrentMetric({ ...metric });
    setConfigDialogOpen(true);
  };
  
  const handleRemoveMetric = (metricId: number) => {
    setSelectedMetrics(selectedMetrics.filter(metric => metric.id !== metricId));
  };
  
  const handleConfigureMetric = (metric: any) => {
    setCurrentMetric({ ...metric });
    setConfigDialogOpen(true);
  };
  
  const handleConfigDialogClose = () => {
    setConfigDialogOpen(false);
  };
  
  const handleConfigDialogSave = (configuredMetric: any) => {
    // Update the metric in selectedMetrics
    const updatedSelectedMetrics = selectedMetrics.map(metric => 
      metric.id === configuredMetric.id ? { ...configuredMetric } : metric
    );
    setSelectedMetrics(updatedSelectedMetrics);
    setConfigDialogOpen(false);
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setTemplateDialogOpen(true);
  };

  const applyTemplate = () => {
    if (!selectedTemplate) return;

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

  // ======== Render de error temprano con estilo del primer archivo ========
  if (error && !useDevFallback) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.push('/projects')} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Configuración de Métricas
            </Typography>
          </Box>
          <Alert severity="error">{error}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: GREEN,
              color: '#FFFFFF',
              '&:hover': { backgroundColor: GREEN_HOVER },
            }}
          >
            Volver a proyectos
          </Button>
        </Box>
      </MainLayout>
    );
  }

  // ======== UI principal con estilo del primer archivo ========
  return (
    <MainLayout>
      <Box sx={{ p: 3, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/projects')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Configuración de Métricas
            </Typography>
            {project && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {project.name}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon sx={{ color: '#FFFFFF' }} />}
            onClick={handleSaveConfiguration}
            disabled={saving || loading}
            sx={{
              backgroundColor: GREEN,
              color: '#FFFFFF',
              '&:hover': { backgroundColor: GREEN_HOVER },
            }}
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </Box>

        {/* Mensajes */}
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

        {/* Loading */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Info del proyecto (tarjeta suave como en el primero) */}
            {project && (
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
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ color: '#555555' }}>
                      ID de proyecto
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {project.id}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ color: '#555555' }}>
                      Nombre
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {project.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ color: '#555555' }}>
                      Descripción
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {project.description || '—'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Tabs con estilo verde */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="metrics configuration tabs"
                sx={{
                  '& .MuiTabs-indicator': { backgroundColor: GREEN },
                  '& .Mui-selected': { color: GREEN },
                }}
              >
                <Tab label="Métricas disponibles" />
                <Tab label="Métricas seleccionadas" />
                <Tab label="Plantillas" />
              </Tabs>
            </Box>

            {/* Métricas disponibles */}
            <TabPanel value={tabValue} index={0}>
              {/* Filtros */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                  border: '1px solid #EEEEEE',
                  backgroundColor: '#FAFAFA',
                }}
              >
                <Grid container spacing={2} alignItems="center">
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
                      <Select value={categoryFilter} label="Categoría" onChange={handleCategoryChange}>
                        <MenuItem value="all">Todas las categorías</MenuItem>
                        <MenuItem value="data_quality">Calidad de datos</MenuItem>
                        <MenuItem value="statistical">Estadísticas</MenuItem>
                        <MenuItem value="ml_specific">Específicas de ML</MenuItem>
                        <MenuItem value="general">General</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>

              <Typography variant="h6" sx={{ fontWeight: 500, color: '#555555', mb: 2 }}>
                {filteredMetrics.length} {filteredMetrics.length === 1 ? 'métrica' : 'métricas'}
              </Typography>

              <Grid container spacing={3}>
                {filteredMetrics.length === 0 ? (
                  <Grid item xs={12}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 5,
                        textAlign: 'center',
                        borderRadius: 2,
                        border: '1px dashed #CCCCCC',
                        backgroundColor: '#FAFAFA',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '240px',
                      }}
                    >
                      <AssessmentIcon sx={{ fontSize: 60, color: ORANGE, opacity: 0.7, mb: 2 }} />
                      <Typography variant="h5" sx={{ mb: 1, fontWeight: 500, color: '#1A1A1A' }}>
                        No se encontraron métricas
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#555555', maxWidth: '520px' }}>
                        Ajusta los filtros o la búsqueda para ver otras métricas disponibles.
                      </Typography>
                    </Paper>
                  </Grid>
                ) : (
                  filteredMetrics.map((metric) => (
                    <Grid item xs={12} sm={6} md={4} key={metric.id}>
                      <Card
                        sx={{
                          height: '100%',
                          borderRadius: 2,
                          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
                          transition: 'all 0.3s ease-in-out',
                          position: 'relative',
                          overflow: 'visible',
                          border: '1px solid #eee',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '4px',
                            height: '100%',
                            backgroundColor: selectedMetrics.some(m => m.id === metric.id) ? GREEN : '#E0E0E0',
                            borderTopLeftRadius: 8,
                            borderBottomLeftRadius: 8,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography
                              variant="h6"
                              component="div"
                              sx={{
                                mb: 1,
                                fontWeight: 600,
                                color: '#1A1A1A',
                              }}
                            >
                              {metric.name}
                            </Typography>

                            <Chip
                              label={metric.category}
                              size="small"
                              sx={{
                                backgroundColor:
                                  metric.category === 'data_quality'
                                    ? 'rgba(0, 179, 126, 0.1)'
                                    : metric.category === 'statistical'
                                    ? 'rgba(255, 184, 0, 0.12)'
                                    : metric.category === 'ml_specific'
                                    ? 'rgba(33, 150, 243, 0.12)'
                                    : 'rgba(0,0,0,0.06)',
                                color:
                                  metric.category === 'data_quality'
                                    ? GREEN
                                    : metric.category === 'statistical'
                                    ? ORANGE
                                    : metric.category === 'ml_specific'
                                    ? '#2196F3'
                                    : '#555555',
                                fontWeight: 500,
                                borderRadius: '16px',
                                textTransform: 'capitalize',
                              }}
                            />
                          </Box>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              height: '40px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {metric.description}
                          </Typography>

                          <Divider sx={{ my: 1.5 }} />

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={selectedMetrics.some(m => m.id === metric.id) ? 'Añadida' : 'Disponible'}
                              size="small"
                              sx={{
                                backgroundColor: selectedMetrics.some(m => m.id === metric.id) ? 'rgba(0, 179, 126, 0.08)' : 'rgba(229, 72, 77, 0.08)',
                                color: selectedMetrics.some(m => m.id === metric.id) ? GREEN : RED,
                                fontWeight: 600,
                                borderRadius: '12px',
                              }}
                            />
                            <Tooltip title="Información de la métrica">
                              <InfoIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                            </Tooltip>
                          </Box>
                        </CardContent>

                        <CardActions sx={{ px: 3, pb: 2 }}>
                          <Button
                            size="small"
                            sx={{
                              borderColor: GREEN,
                              color: GREEN,
                              textTransform: 'none',
                              '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0, 179, 126, 0.04)' },
                            }}
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddMetric(metric)}
                            disabled={selectedMetrics.some(m => m.id === metric.id)}
                          >
                            {selectedMetrics.some(m => m.id === metric.id) ? 'Añadida' : 'Añadir'}
                          </Button>
                          <Button
                            size="small"
                            sx={{
                              ml: 'auto',
                              borderColor: GREEN,
                              color: GREEN,
                              textTransform: 'none',
                              '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0, 179, 126, 0.04)' },
                            }}
                            variant="outlined"
                            onClick={() => handleConfigureMetric(metric)}
                            disabled={!selectedMetrics.some(m => m.id === metric.id)}
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

            {/* Métricas seleccionadas */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Métricas seleccionadas
              </Typography>
              
              {selectedMetrics.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No has seleccionado ninguna métrica. Añade métricas desde la pestaña "Métricas disponibles".
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {selectedMetrics.map((metric) => (
                    <Grid item xs={12} sm={6} md={4} key={metric.id}>
                      <Card
                        sx={{
                          position: 'relative',
                          transition: 'all 0.2s ease-in-out',
                          border: '1px solid #E0E0E0',
                          borderRadius: 2,
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '4px',
                            height: '100%',
                            backgroundColor: GREEN,
                            borderTopLeftRadius: 8,
                            borderBottomLeftRadius: 8,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography
                              variant="h6"
                              component="div"
                              sx={{
                                fontWeight: 600,
                                mb: 1,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {metric.name}
                            </Typography>
                            <Chip
                              label={metric.category}
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                              }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {metric.description}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2, pt: 0, display: 'flex', justifyContent: 'space-between' }}>
                          <Button
                            size="small"
                            sx={{
                              borderColor: GREEN,
                              color: GREEN,
                              textTransform: 'none',
                              '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0, 179, 126, 0.04)' },
                            }}
                            variant="outlined"
                            startIcon={<SettingsIcon />}
                            onClick={() => handleConfigureMetric(metric)}
                          >
                            Configurar
                          </Button>
                          <Button
                            size="small"
                            sx={{
                              borderColor: RED,
                              color: RED,
                              textTransform: 'none',
                              '&:hover': { borderColor: '#D03B40', backgroundColor: 'rgba(229, 72, 77, 0.04)' },
                            }}
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleRemoveMetric(metric.id)}
                          >
                            Eliminar
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>

            {/* Plantillas */}
            <TabPanel value={tabValue} index={2}>
              {loadingTemplates ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 500, color: '#555555' }}>
                    Plantillas de configuración
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
                    Aplica una configuración predefinida de métricas para acelerar la puesta en marcha.
                  </Typography>

                  <Grid container spacing={3}>
                    {!templates || !Array.isArray(templates) || templates.length === 0 ? (
                      <Grid item xs={12}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 5,
                            textAlign: 'center',
                            borderRadius: 2,
                            border: '1px dashed #CCCCCC',
                            backgroundColor: '#FAFAFA',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '240px',
                          }}
                        >
                          <CloudUploadIcon sx={{ fontSize: 60, color: GREEN, opacity: 0.7, mb: 2 }} />
                          <Typography variant="h5" sx={{ mb: 1, fontWeight: 500, color: '#1A1A1A' }}>
                            No hay plantillas disponibles
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#555555', maxWidth: '520px' }}>
                            Crea plantillas en el backend o habilítalas para poder aplicarlas aquí.
                          </Typography>
                        </Paper>
                      </Grid>
                    ) : (
                      templates.map((template: any) => (
                        <Grid item xs={12} md={4} key={template.id}>
                          <Card
                            sx={{
                              height: '100%',
                              borderRadius: 2,
                              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
                              transition: 'all 0.3s ease-in-out',
                              position: 'relative',
                              overflow: 'visible',
                              border: '1px solid #eee',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
                              },
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '4px',
                                height: '100%',
                                backgroundColor: GREEN,
                                borderTopLeftRadius: 8,
                                borderBottomLeftRadius: 8,
                              },
                            }}
                          >
                            <CardContent sx={{ p: 3 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1 }}>
                                {template.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  mb: 2,
                                  height: '40px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                {template.description}
                              </Typography>
                              <Chip
                                label={`${template.metrics?.length || 0} métricas`}
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(0, 179, 126, 0.1)',
                                  color: GREEN,
                                  fontWeight: 500,
                                  borderRadius: '16px',
                                }}
                              />
                            </CardContent>
                            <CardActions sx={{ px: 3, pb: 2 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleTemplateSelect(template)}
                                sx={{
                                  borderColor: GREEN,
                                  color: GREEN,
                                  textTransform: 'none',
                                  '&:hover': {
                                    borderColor: GREEN_HOVER,
                                    backgroundColor: 'rgba(0, 179, 126, 0.04)',
                                  },
                                }}
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

        {/* Diálogo de configuración de métricas */}
      <Dialog
        open={configDialogOpen}
        onClose={handleConfigDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Configurar métrica: {currentMetric?.name}
        </DialogTitle>
        <DialogContent>
          {currentMetric && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Parámetros
              </Typography>
              
              {Object.keys(currentMetric.parameters || {}).length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Esta métrica no tiene parámetros configurables.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(currentMetric.parameters || {}).map(([key, value]: [string, any]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <TextField
                        fullWidth
                        label={key}
                        value={value}
                        onChange={(e) => {
                          const updatedMetric = { ...currentMetric };
                          updatedMetric.parameters = { ...updatedMetric.parameters };
                          updatedMetric.parameters[key] = e.target.value;
                          setCurrentMetric(updatedMetric);
                        }}
                        variant="outlined"
                        margin="normal"
                        helperText={`Parámetro: ${key}`}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfigDialogClose} color="inherit">
            Cancelar
          </Button>
          <Button 
            onClick={() => handleConfigDialogSave(currentMetric)}
            variant="contained"
            sx={{ 
              bgcolor: GREEN, 
              '&:hover': { bgcolor: GREEN_HOVER } 
            }}
          >
            Guardar configuración
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Diálogo de plantilla */}
        <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
          <DialogTitle>Aplicar plantilla</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Está seguro de que desea aplicar la plantilla "{selectedTemplate?.name}"? Esto sobrescribirá cualquier
              configuración existente para las métricas incluidas en la plantilla.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={applyTemplate} sx={{ color: GREEN }}>
              Aplicar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MainLayout>
  );
};

export default MetricsConfigurationPage;
