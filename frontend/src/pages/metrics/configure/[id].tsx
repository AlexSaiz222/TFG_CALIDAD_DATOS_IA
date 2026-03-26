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
import TemplateCard from '../../../components/metrics/TemplateCard';
import { metricsAPI, projectsAPI } from '../../../services/api';
import { categoryColor, GREEN, GREEN_HOVER, ORANGE, RED } from '../../../utils/metricColors';

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
    

    // Caso 1: ID válido como string
    if (typeof id === 'string' && id !== 'undefined') {
      return id;
    }
    
    // Caso 2: ID válido en array
    if (Array.isArray(id) && id.length > 0 && id[0] !== 'undefined') {
      return id[0];
    }

    // Caso 3: Intentar recuperar de localStorage
    try {
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
      if (storedId) {
        // Actualizar URL sin recargar la página
        router.replace(`/metrics/configure/${storedId}`, undefined, { shallow: true });
        return storedId;
      }
    } catch (error) {
      console.error('Error al acceder a localStorage:', error);
    }
    
    // Caso 4: Redirigir a la lista de proyectos si no hay ID válido
    if (typeof window !== 'undefined' && router.isReady) {
      setTimeout(() => {
        router.push('/projects');
      }, 100);
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
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

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
    let projectPayload: any = null; // Variable hoisted to be accessible throughout the effect

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
            if (isMounted) {
              // Normaliza la respuesta del proyecto al guardarlo en estado
              projectPayload = projectResponse?.data?.data ?? projectResponse?.data;
              setProject(projectPayload);
            }
          } catch (projectError: any) {
            console.error('Error al cargar proyecto:', projectError);
            if (isMounted) {
              // Intentar recuperar el proyecto desde localStorage
              const cachedProjects = localStorage.getItem('projects');
              if (cachedProjects) {
                try {
                  const projects = JSON.parse(cachedProjects);
                  const cachedProject = projects.find((p: any) => p.id === projectIdNum);
                  if (cachedProject) {
                    setProject(cachedProject);
                  } else {
                    const errorMsg = `No se pudo cargar el proyecto con ID ${projectIdNum}. El proyecto no existe en caché.`;
                    console.error(errorMsg);
                    setError(errorMsg);
                  }
                } catch (parseError: unknown) {
                  console.error('Error al parsear proyectos de localStorage:', parseError);
                  setError(`Error al recuperar datos de caché: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
                }
              } else {
                const errorMsg = `No se pudo cargar el proyecto con ID ${projectIdNum}. No hay datos en caché.`;
                console.error(errorMsg);
                setError(errorMsg);
              }
            }
          }
        } else if (useDevFallback && isMounted) {
          projectPayload = {
            id: 0,
            name: 'Proyecto de Prueba',
            description: 'Este es un proyecto de prueba para desarrollo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            owner_id: 1,
            metrics_config: [],
          };
          setProject(projectPayload);
        }

        // Métricas
        let metricsData: any[] = [];
        try {
          const metricsResponse = await metricsAPI.getMetrics() as any;
          const rawData = metricsResponse?.data;
          if (Array.isArray(rawData)) {
            metricsData = rawData;
          } else if (rawData && Array.isArray(rawData.metrics)) {
            metricsData = rawData.metrics;
          }
          
        } catch (metricsError) {
          console.error('Error al cargar métricas:', metricsError);
          // No interrumpimos el flujo por un error en métricas, solo lo registramos
          // y continuamos con un array vacío
          if (isMounted) {
            setError((prevError) => prevError || 'Error al cargar métricas. Algunas funcionalidades pueden no estar disponibles.');
          }
        }

        // Asegurarse de que metricsData sea un array antes de mapearlo
        const normalizedMetrics = (metricsData || []).map((metric: any) => ({
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
        
        // Rehidratación con config guardada en el proyecto (usar metric_id y la variable local normalizedMetrics)
        const projectObj = projectPayload ?? project; // Usar projectPayload si existe, o project como fallback
        let hydratedMetrics = normalizedMetrics;
        let hydratedSelected: any[] = [];
        if (projectObj?.metrics_config && Array.isArray(projectObj.metrics_config)) {
          hydratedMetrics = normalizedMetrics.map((metric: any) => {
            // Buscar por nombre (string) ya que metrics_config usa id como string ("completeness", "uniqueness", etc.)
            // mientras que el catálogo de métricas usa id numérico
            const cfg = projectObj.metrics_config.find(
              (m: any) => {
                const configId = m.metric_id ?? m.id;
                // Comparar por nombre (case-insensitive) o por ID si coincide
                return (
                  (typeof configId === 'string' && metric.name && configId.toLowerCase() === metric.name.toLowerCase()) ||
                  (typeof configId === 'number' && configId === metric.id) ||
                  (m.name && metric.name && m.name.toLowerCase() === metric.name.toLowerCase())
                );
              }
            );
            if (cfg) {
              const params = cfg.parameters ?? {};
              const configured = {
                ...metric,
                enabled: true,
                // Usa SIEMPRE 'parameters' como fuente de verdad
                parameters: { ...metric.parameters, ...params },
                // (si necesitas 'config' para UI, mantenla en sync)
                config: { ...metric.parameters, ...params },
              };
              hydratedSelected.push(configured);
              return configured;
            }
            return metric;
          });
        }

        if (isMounted) {
          setMetrics(hydratedMetrics || normalizedMetrics);
          setFilteredMetrics(hydratedMetrics || normalizedMetrics);
          // Siempre setea; si está vacío, evitas arrastrar selección antigua
          setSelectedMetrics(hydratedSelected);
        }

        // Eliminado el bloque redundante de useDevFallback que sobreescribía las métricas
        // Ya se hizo la rehidratación correctamente arriba

        // La rehidratación ahora se hace directamente después de cargar el proyecto

        // Plantillas
        try {
          const templatesResponse = await metricsAPI.getMetricTemplates() as any;

          if (isMounted) {
            const rawTemplates = templatesResponse?.data;
            const templatesArray = Array.isArray(rawTemplates)
              ? rawTemplates
              : Array.isArray(rawTemplates?.templates)
                ? rawTemplates.templates
                : [];
            setTemplates(templatesArray);
          }
        } catch (templateError) {
          console.error('Error al cargar plantillas:', templateError);
          if (isMounted) {
            setTemplates([]);
            // No mostramos error al usuario por las plantillas, ya que no son críticas
          }
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
      // Formato correcto para la API: un array de objetos con id (nombre de la métrica) y parameters
      const metricsConfig = selectedMetrics.map((metric) => ({
        id: metric.name,  // Usar el nombre de la métrica como id (string) para consistencia
        parameters: metric.parameters || {},
        weight: metric.weight || 1.0  // Incluir weight si existe
      }));

      // El formato esperado por la API
      const configToSave = {
        metrics_config: metricsConfig  // Enviar como metrics_config
      };

      
      // Usa un fallback seguro para el ID al guardar
      const pid = project?.id ?? projectIdNum;
      if (!pid) {
        setError('No se pudo determinar el ID de proyecto para guardar la configuración.');
        setSaving(false);
        return;
      }
      
      // Llamada a la API con el formato correcto
      await metricsAPI.saveProjectMetricConfigs(pid, configToSave);
      // Actualización optimista del proyecto local
      setProject((prev: any) => prev ? { ...prev, metrics_config: configToSave.metrics_config } : prev);
      setSuccess('Configuración guardada correctamente');

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error al guardar la configuración de métricas:', err);
      // Mejorar el mensaje de error para incluir más detalles
      const errorMessage = err.response?.status === 404 
        ? `Error 404: Endpoint no encontrado. Verifica la ruta /api/projects/${project?.id ?? projectIdNum}/metrics/config` 
        : err.response?.data?.message || err.message || 'Error al guardar la configuración de métricas';
      
      setError(errorMessage);
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
    
    if (isAlreadySelected) {
      // Si ya está seleccionada, la quitamos (efecto toggle)
      setSelectedMetrics(selectedMetrics.filter(m => m.id !== metric.id));
      return;
    }
    
    // Add metric to selectedMetrics sin abrir el modal de configuración
    // Asegurarse de que tenga parameters y config
    setSelectedMetrics([
      ...selectedMetrics, 
      { ...metric, parameters: metric.parameters ?? {}, config: metric.config ?? {} }
    ]);
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
    // Asegurarse de que parameters y config estén sincronizados
    const updatedMetric = {
      ...configuredMetric,
      parameters: configuredMetric.parameters || {},
      config: configuredMetric.config || {}
    };
    
    const updatedSelectedMetrics = selectedMetrics.map(metric => 
      metric.id === updatedMetric.id ? updatedMetric : metric
    );
    setSelectedMetrics(updatedSelectedMetrics);
    setConfigDialogOpen(false);
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setTemplateDialogOpen(true);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate || !selectedTemplate.metrics) {
      setTemplateDialogOpen(false);
      return;
    }

    // Convert template metrics to selected metrics format
    const templateMetrics = selectedTemplate.metrics.map((tm: any) => {
      const fullMetric = metrics.find((m: any) => m.id === tm.id || m.id === tm.metric_id);
      if (!fullMetric) return null;
      
      return {
        id: fullMetric.id,
        name: fullMetric.name,
        category: fullMetric.category,
        description: fullMetric.description,
        enabled: true,
        parameters: tm.parameters || fullMetric.parameters || {},
      };
    }).filter(Boolean);

    setSelectedMetrics(templateMetrics);
    setTemplateDialogOpen(false);
    setSuccess(`Plantilla "${selectedTemplate.name}" aplicada correctamente`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || selectedMetrics.length === 0) return;
    setSavingTemplate(true);
    try {
      const templateMetrics = selectedMetrics.map((m: any) => ({
        metric_id: m.id,
        parameters: m.parameters || {},
      }));
      await metricsAPI.createMetricTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim(),
        metrics: templateMetrics,
      });
      // Refresh templates list
      try {
        const templatesResponse = await metricsAPI.getMetricTemplates() as any;
        const tData = templatesResponse?.data || [];
        let arr: any[] = [];
        if (Array.isArray(tData)) arr = tData;
        else if (tData.templates && Array.isArray(tData.templates)) arr = tData.templates;
        setTemplates(arr);
      } catch (_) { /* ignore refresh error */ }
      setSuccess('Plantilla guardada correctamente');
      setSaveTemplateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.response?.data?.message || 'Error al guardar la plantilla');
    } finally {
      setSavingTemplate(false);
    }
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
              Configuración de métricas
            </Typography>
          </Box>
          <Alert 
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => {
                  // Intentar recuperar el ID del localStorage
                  const storedId = localStorage.getItem('currentProjectId');
                  if (storedId) {
                    router.push(`/metrics/configure/${storedId}`);
                  } else {
                    router.push('/projects');
                  }
                }}
              >
                Reintentar
              </Button>
            }
          >
            {error}
          </Alert>
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => router.push('/projects')}
              sx={{
                backgroundColor: GREEN,
                color: '#FFFFFF',
                '&:hover': { backgroundColor: GREEN_HOVER },
              }}
            >
              Volver a proyectos
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                // Limpiar el error y recargar la página
                setError(null);
                window.location.reload();
              }}
              sx={{
                borderColor: GREEN,
                color: GREEN,
                '&:hover': { borderColor: GREEN_HOVER, color: GREEN_HOVER },
              }}
            >
              Recargar página
            </Button>
          </Box>
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
              Configuración de métricas
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
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => {
                  // Intentar recuperar el ID del localStorage
                  const storedId = localStorage.getItem('currentProjectId');
                  if (storedId) {
                    router.push(`/metrics/configure/${storedId}`);
                  } else {
                    router.push('/projects');
                  }
                }}
              >
                Reintentar
              </Button>
            }
          >
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
            {/* Se eliminó el panel de información del proyecto */}

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
                                backgroundColor: categoryColor(metric.category).bg,
                                color: categoryColor(metric.category).fg,
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
                                backgroundColor: selectedMetrics.some(m => m.id === metric.id) ? 'rgba(0, 179, 126, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                                color: selectedMetrics.some(m => m.id === metric.id) ? GREEN : '#555555',
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
                              backgroundColor: selectedMetrics.some(m => m.id === metric.id) ? '#EF5350' : GREEN,
                              color: '#FFFFFF',
                              textTransform: 'none',
                              '&:hover': { backgroundColor: selectedMetrics.some(m => m.id === metric.id) ? '#E01815' : GREEN_HOVER },
                            }}
                            variant="contained"
                            startIcon={selectedMetrics.some(m => m.id === metric.id) ? null : <AddIcon />}
                            onClick={() => handleAddMetric(metric)}
                          >
                            {selectedMetrics.some(m => m.id === metric.id) ? 'Quitar' : 'Añadir'}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Métricas seleccionadas
                </Typography>
                {selectedMetrics.length > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => setSaveTemplateDialogOpen(true)}
                    sx={{
                      borderColor: GREEN,
                      color: GREEN,
                      textTransform: 'none',
                      '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0, 179, 126, 0.04)' },
                    }}
                  >
                    Guardar como plantilla
                  </Button>
                )}
              </Box>
              
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

                  {!templates || !Array.isArray(templates) || templates.length === 0 ? (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 5,
                        textAlign: 'center',
                        borderRadius: 2,
                        border: '2px dashed #E0E0E0',
                        backgroundColor: '#FAFAFA',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '240px',
                      }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 60, color: GREEN, opacity: 0.7, mb: 2 }} />
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 500, color: '#1A1A1A' }}>
                        No hay plantillas disponibles
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#666', maxWidth: '420px', mb: 2 }}>
                        Crea plantillas desde Configuración &gt; Plantillas para reutilizar configuraciones de métricas.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => router.push('/settings/templates')}
                        sx={{
                          borderColor: GREEN,
                          color: GREEN,
                          textTransform: 'none',
                          '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0,179,126,0.04)' },
                        }}
                      >
                        Ir a Plantillas
                      </Button>
                    </Paper>
                  ) : (
                    <Grid container spacing={2}>
                      {templates.map((template: any) => (
                        <Grid item xs={12} sm={6} md={4} key={template.id}>
                          <TemplateCard
                            template={template}
                            mode="apply"
                            onApply={handleTemplateSelect}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  )}
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
              color: '#FFFFFF',
              '&:hover': { bgcolor: GREEN_HOVER } 
            }}
          >
            Guardar configuración
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Diálogo de plantilla */}
        <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm">
          <DialogTitle>Aplicar plantilla</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              ¿Deseas aplicar la plantilla <strong>"{selectedTemplate?.name}"</strong>?
            </DialogContentText>
            {selectedTemplate && (
              <Box sx={{ p: 2, backgroundColor: '#F5F5F5', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                  Esta plantilla incluye {selectedTemplate.metrics?.length || 0} métricas que se añadirán a tu configuración actual.
                </Typography>
                {selectedTemplate.description && (
                  <Typography variant="caption" sx={{ color: '#999' }}>
                    {selectedTemplate.description}
                  </Typography>
                )}
              </Box>
            )}
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              Las métricas de la plantilla se añadirán a tu selección actual. Puedes modificarlas después.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setTemplateDialogOpen(false)} sx={{ color: '#666' }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApplyTemplate} 
              variant="contained"
              sx={{ 
                backgroundColor: GREEN, 
                color: '#fff',
                '&:hover': { backgroundColor: GREEN_HOVER }
              }}
            >
              Aplicar plantilla
            </Button>
          </DialogActions>
        </Dialog>

        {/* Diálogo guardar como plantilla */}
        <Dialog open={saveTemplateDialogOpen} onClose={() => setSaveTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Guarda la configuración actual ({selectedMetrics.length} métricas) como una plantilla reutilizable.
            </DialogContentText>
            <TextField
              fullWidth
              label="Nombre de la plantilla"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              sx={{ mb: 2 }}
              size="small"
              autoFocus
            />
            <TextField
              fullWidth
              label="Descripción (opcional)"
              value={newTemplateDescription}
              onChange={(e) => setNewTemplateDescription(e.target.value)}
              multiline
              rows={2}
              size="small"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveTemplateDialogOpen(false)} color="inherit">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              variant="contained"
              disabled={savingTemplate || !newTemplateName.trim()}
              sx={{ bgcolor: GREEN, color: '#fff', '&:hover': { bgcolor: GREEN_HOVER } }}
            >
              {savingTemplate ? 'Guardando...' : 'Guardar plantilla'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MainLayout>
  );
};

export default MetricsConfigurationPage;
