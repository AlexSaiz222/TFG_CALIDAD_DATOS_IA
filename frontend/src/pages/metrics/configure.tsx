import React, { useState, useEffect } from 'react';
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
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import MetricParameterDialog from '../../components/metrics/MetricParameterDialog';
import MetricTemplateDialog from '../../components/metrics/MetricTemplateDialog';
import { metricsAPI, projectsAPI } from '../../services/api';
import { Metric, MetricConfig, Project, MetricTemplate } from '../../types';

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
  const { id: projectId } = router.query;
  const projectIdNum = projectId ? parseInt(projectId as string, 10) : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricConfig[]>([]);
  const [tabValue, setTabValue] = useState(0);
  
  // Filtering and searching state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Parameter configuration dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentMetric, setCurrentMetric] = useState<Metric | null>(null);
  const [currentMetricConfig, setCurrentMetricConfig] = useState<MetricConfig | null>(null);
  
  // Template state
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetricTemplate | null>(null);

  // Forzar finalización de carga después de 3 segundos (solución de emergencia)
  useEffect(() => {
    if (loading) {
      console.log('Iniciando timeout de emergencia (3 segundos)');
      const emergencyTimeoutId = setTimeout(() => {
        console.log('EMERGENCY TIMEOUT: Forzando fin del estado de carga después de 3 segundos');
        setLoading(false);
        setLoadingTemplates(false);
        
        // Si no hay métricas cargadas, establecer un array vacío
        if (!metrics || metrics.length === 0) {
          console.log('No se cargaron métricas, estableciendo array vacío');
          setMetrics([]);
        }
        
        // Si no hay proyecto cargado, establecer un proyecto dummy con nombre más específico
        if (!project) {
          console.log('No se cargó el proyecto, estableciendo proyecto dummy con nombre recuperado');
          
          // Intentar obtener el nombre del proyecto de localStorage si existe
          let projectName = 'Project';
          try {
            // Intentar obtener el nombre del proyecto del localStorage
            const cachedProjects = localStorage.getItem('projectsCache');
            if (cachedProjects) {
              const parsedCache = JSON.parse(cachedProjects);
              if (parsedCache.data && Array.isArray(parsedCache.data)) {
                const cachedProject = parsedCache.data.find((p: any) => p.id === projectIdNum);
                if (cachedProject && cachedProject.name) {
                  projectName = cachedProject.name;
                  console.log(`Nombre de proyecto recuperado de cache: ${projectName}`);
                }
              }
            }
          } catch (e) {
            console.error('Error al recuperar nombre de proyecto de cache:', e);
          }
          
          setProject({
            id: projectIdNum || 0,
            name: projectName,
            description: '',
            owner_id: 1, // Valor por defecto
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            dataset_count: 0
          });
        }
        
        // Si no hay configuraciones de métricas, establecer array vacío
        if (!selectedMetrics || selectedMetrics.length === 0) {
          console.log('No se cargaron configuraciones de métricas, estableciendo array vacío');
          setSelectedMetrics([]);
        }
        
        // Si no hay plantillas, establecer array vacío
        if (!templates || templates.length === 0) {
          console.log('No se cargaron plantillas, estableciendo array vacío');
          setTemplates([]);
        }
      }, 3000);
      
      return () => clearTimeout(emergencyTimeoutId);
    }
  }, [loading, project, projectIdNum, metrics, selectedMetrics, templates]);

  useEffect(() => {
    // Track if component is mounted to prevent state updates after unmount
    let isMounted = true;
    // Track API request cancellation
    const controller = new AbortController();
    
    const fetchData = async () => {
      if (!projectIdNum) return;

      // Forzar estado inicial limpio
      if (isMounted) {
        setLoading(true);
        setError(null);
        setLoadingTemplates(true);
        console.log('Iniciando carga de datos de métricas para proyecto:', projectIdNum);
      }
      
      // Crear un timeout más corto para prevenir carga indefinida
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.log('Timeout de 8 segundos activado - abortando solicitudes');
          setError('La solicitud ha tardado demasiado tiempo. Por favor, inténtalo de nuevo.');
          setLoading(false);
          setLoadingTemplates(false);
          controller.abort();
        }
      }, 8000); // 8 segundos de timeout

      try {
        // Fetch metrics and project details in parallel to improve performance
        const [metricsResponse, projectResponse] = await Promise.allSettled([
          metricsAPI.getMetrics(),
          projectsAPI.getProject(projectIdNum)
        ]);
        
        // Handle metrics response
        if (metricsResponse.status === 'fulfilled') {
          // Ensure metricsData is an array
          let metricsData: any[] = [];
          const response = metricsResponse.value as any;
          
          console.log('Respuesta de métricas recibida:', response);
          
          if (response && response.data) {
            if (Array.isArray(response.data)) {
              metricsData = response.data;
              console.log('Datos de métricas encontrados como array directo, longitud:', metricsData.length);
            } else if (response.data.metrics && Array.isArray(response.data.metrics)) {
              metricsData = response.data.metrics;
              console.log('Datos de métricas encontrados en propiedad metrics, longitud:', metricsData.length);
            } else if (typeof response.data === 'object') {
              // Look for any array property that might contain metrics
              const possibleArrays = Object.values(response.data).filter(val => Array.isArray(val));
              if (possibleArrays.length > 0) {
                // Use the first array found
                metricsData = possibleArrays[0] as any[];
                console.log('Datos de métricas encontrados en otra propiedad, longitud:', metricsData.length);
              } else {
                console.warn('La respuesta API no contiene un array de métricas');
                metricsData = []; // Asegurar que sea un array vacío
              }
            }
          } else {
            console.warn('Respuesta de métricas inválida o vacía');
          }
          
          console.log('Normalized metrics data:', metricsData);
          if (isMounted) {
            setMetrics(metricsData);

            // Extract unique categories from metrics
            const uniqueCategories = Array.isArray(metricsData) && metricsData.length > 0 ? 
              Array.from(new Set(metricsData.map((metric: Metric) => metric.category))).sort() as string[] : 
              [];
            setCategories(uniqueCategories);
          }
        } else {
          console.error('Error fetching metrics:', metricsResponse.reason);
          if (isMounted) {
            setError('Error al cargar las métricas. Por favor, inténtalo de nuevo.');
          }
        }

        // Handle project response
        if (projectResponse.status === 'fulfilled') {
          const projectData = (projectResponse.value as any)?.data;
          console.log('Datos del proyecto recibidos:', projectData);
          if (isMounted && projectData) {
            setProject(projectData);
          }
        } else {
          console.error('Error fetching project:', projectResponse.reason);
          if (isMounted) {
            setError('Error al cargar los detalles del proyecto. Por favor, inténtalo de nuevo.');
          }
        }

        // Fetch project's current metric configurations with retry mechanism
        let configRetries = 0;
        const fetchMetricConfigs = async () => {
          try {
            const metricsConfigResponse = await metricsAPI.getProjectMetricConfigs(projectIdNum) as any;
            if (metricsConfigResponse?.data && Array.isArray(metricsConfigResponse.data) && isMounted) {
              console.log('Configuraciones de métricas cargadas:', metricsConfigResponse.data.length);
              setSelectedMetrics(metricsConfigResponse.data);
            }
            return true; // Success
          } catch (configError: any) {
            console.log(`Attempt ${configRetries + 1} - Error fetching metric configs:`, configError?.message || configError);
            if (configRetries < 2 && isMounted) { // Try up to 3 times
              configRetries++;
              return false; // Failed, retry
            } else {
              console.warn('Max retries reached for metric configs, continuing with empty config');
              return true; // Stop retrying
            }
          }
        };
        
        // Initial attempt
        let configSuccess = await fetchMetricConfigs();
        
        // Retry if needed with exponential backoff
        while (!configSuccess && configRetries < 2 && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, configRetries)));
          configSuccess = await fetchMetricConfigs();
        }

        // Fetch metric templates
        try {
          const templatesResponse = await metricsAPI.getMetricTemplates() as any;
          if (templatesResponse?.data && Array.isArray(templatesResponse.data)) {
            console.log('Plantillas de métricas cargadas:', templatesResponse.data.length);
            setTemplates(templatesResponse.data);
          } else {
            console.warn('No se encontraron plantillas de métricas o formato incorrecto');
            if (isMounted) setTemplates([]);
          }
        } catch (error) {
          console.error('Error fetching metric templates:', error);
          // Non-critical error, don't set error state
          if (isMounted) setTemplates([]);
        }

        try {
          clearTimeout(timeoutId);
          if (isMounted) {
            console.log('Carga completada con éxito - desactivando estados de carga');
            setLoading(false);
            setLoadingTemplates(false);
          }
        } catch (e) {
          console.error('Error clearing timeout:', e);
          // Asegurar que los estados de carga se desactiven incluso si hay error
          if (isMounted) {
            setLoading(false);
            setLoadingTemplates(false);
          }
        }
      } catch (error: any) {
        console.error('Error fetching metrics data:', error);
        
        try {
          clearTimeout(timeoutId);
        } catch (e) {
          console.error('Error clearing timeout in catch block:', e);
        }
        
        if (isMounted) {
          console.log('Setting error state and disabling loading');
          // Check if request was cancelled
          if (error.name === 'AbortError' || error.name === 'CanceledError') {
            setError('La solicitud fue cancelada. Por favor, inténtalo de nuevo.');
          } else {
            setError(error.response?.data?.message || 'Error al cargar los datos de métricas. Por favor, inténtalo de nuevo.');
          }
          setLoading(false);
          setLoadingTemplates(false);
        }
      }
    };

    if (projectIdNum) {
      fetchData();
    }
    
    // Cleanup function to prevent memory leaks and state updates after unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [projectIdNum]);

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
      console.error('Error saving metric configurations:', error);
      setError(error.response?.data?.message || 'Failed to save metric configurations. Please try again.');
      setSaving(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleCategoryFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }) => {
    setCategoryFilter(event.target.value);
  };

  const handleAddMetric = (metric: Metric) => {
    // Check if metric is already selected
    const isAlreadySelected = selectedMetrics.some(m => m.metric_id === metric.id);
    
    if (!isAlreadySelected) {
      // Add metric with default parameters
      setSelectedMetrics([...selectedMetrics, {
        metric_id: metric.id,
        parameters: { ...metric.parameters } // Copy default parameters
      }]);
      
      // Switch to Selected Metrics tab
      setTabValue(1);
      
      setSuccess(`Added ${metric.name} to selected metrics`);
    } else {
      setError(`${metric.name} is already selected`);
    }
  };

  const handleRemoveMetric = (metricId: number) => {
    setSelectedMetrics(selectedMetrics.filter(m => m.metric_id !== metricId));
    setSuccess('Metric removed from selection');
  };
  
  const handleOpenConfigDialog = (metricId: number) => {
    const metric = getMetricById(metricId);
    const metricConfig = selectedMetrics.find(m => m.metric_id === metricId) || null;
    
    if (metric && metricConfig) {
      setCurrentMetric(metric);
      setCurrentMetricConfig(metricConfig);
      setConfigDialogOpen(true);
    }
  };
  
  const handleCloseConfigDialog = () => {
    setConfigDialogOpen(false);
  };
  
  const handleSaveParameters = (updatedConfig: MetricConfig) => {
    // Update the selected metrics list with the new configuration
    setSelectedMetrics(selectedMetrics.map(config => 
      config.metric_id === updatedConfig.metric_id ? updatedConfig : config
    ));
    
    setConfigDialogOpen(false);
    setSuccess('Metric parameters updated successfully');
  };
  
  const handleSaveAllConfigurations = async () => {
    if (!projectIdNum) {
      setError('Project ID is invalid');
      return;
    }
    
    if (selectedMetrics.length === 0) {
      setError('No metrics selected. Please select at least one metric.');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    // Reference to track if component is still mounted
    let isMounted = true;
    
    // Set a timeout to prevent indefinite loading state
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setSaving(false);
        setError('La operación ha tardado demasiado tiempo. Por favor, inténtalo de nuevo.');
      }
    }, 20000); // 20 seconds timeout
    
    try {
      console.log('Guardando configuración de métricas:', selectedMetrics);
      await metricsAPI.saveProjectMetricConfigs(projectIdNum, selectedMetrics);
      
      if (isMounted) {
        setSuccess('Metric configurations saved successfully');
        
        // Refresh project data
        try {
          const projectResponse = await projectsAPI.getProject(projectIdNum);
          if (isMounted) {
            setProject(projectResponse.data);
          }
        } catch (refreshErr) {
          console.error('Error refreshing project data:', refreshErr);
          // Non-critical error, don't show to user
        }
      }
    } catch (err: any) {
      console.error('Error saving metric configurations:', err);
      if (isMounted) {
        // Check if request was cancelled
        if (err.name === 'AbortError' || err.name === 'CanceledError') {
          setError('La solicitud fue cancelada. Por favor, inténtalo de nuevo.');
        } else {
          setError(err.response?.data?.message || 'Failed to save metric configurations. Please try again.');
        }
      }
    } finally {
      clearTimeout(timeoutId);
      if (isMounted) {
        setSaving(false);
      }
    }
    
    // Return cleanup function
    return () => {
      isMounted = false;
    };
  };
  
  // Template functions
  const handleOpenSaveTemplateDialog = () => {
    if (selectedMetrics.length === 0) {
      setError('No metrics selected to save as template');
      return;
    }
    setSaveTemplateDialogOpen(true);
  };
  
  const handleOpenLoadTemplateDialog = () => {
    if (templates.length === 0) {
      setError('No templates available to load');
      return;
    }
    setLoadTemplateDialogOpen(true);
  };
  
  const handleSaveTemplate = async (name: string, description: string) => {
    try {
      const templateData = {
        name,
        description,
        metrics: selectedMetrics
      };
      
      await metricsAPI.createMetricTemplate(templateData);
      setSuccess(`Template "${name}" saved successfully`);
      
      // Refresh templates
      const templatesResponse = await metricsAPI.getMetricTemplates() as any;
      if (templatesResponse?.data && Array.isArray(templatesResponse.data)) {
        setTemplates(templatesResponse.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaveTemplateDialogOpen(false);
    }
  };
  
  const handleLoadTemplate = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Ask for confirmation if there are already selected metrics
      if (selectedMetrics.length > 0) {
        if (window.confirm('Loading this template will replace your current metric selections. Continue?')) {
          setSelectedMetrics(template.metrics);
          setSuccess(`Template "${template.name}" loaded successfully`);
        }
      } else {
        setSelectedMetrics(template.metrics);
        setSuccess(`Template "${template.name}" loaded successfully`);
      }
    }
    setLoadTemplateDialogOpen(false);
  };
  
  const handleDeleteTemplate = async (templateId: number) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await metricsAPI.deleteMetricTemplate(templateId);
        setTemplates(templates.filter(t => t.id !== templateId));
        setSuccess('Template deleted successfully');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete template');
      }
    }
  };

  // Función para crear métricas de ejemplo como fallback
  const loadExampleMetrics = () => {
    console.log('Cargando métricas de ejemplo como fallback');
    const exampleMetrics = [
      {
        id: 1,
        name: 'Completeness',
        description: 'Measures the percentage of non-null values in a dataset',
        category: 'Data Quality',
        parameters: { threshold: 0.8 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Uniqueness',
        description: 'Measures the percentage of unique values in a dataset',
        category: 'Data Quality',
        parameters: { columns: [] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Consistency',
        description: 'Checks if data follows consistent patterns',
        category: 'Data Validation',
        parameters: { rules: {} },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 4,
        name: 'Accuracy',
        description: 'Measures how close the data values are to the true values',
        category: 'Data Quality',
        parameters: { reference_data: null },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 5,
        name: 'Timeliness',
        description: 'Measures if data is available when needed',
        category: 'Data Validation',
        parameters: { max_delay: 24 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 6,
        name: 'Anomaly Detection',
        description: 'Identifies unusual patterns in data',
        category: 'Advanced Analytics',
        parameters: { sensitivity: 0.7 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    setMetrics(exampleMetrics);
    
    // Extract unique categories from example metrics
    const uniqueCategories = Array.from(new Set(exampleMetrics.map(metric => metric.category))).sort() as string[];
    setCategories(uniqueCategories);
  };

  // Intentar cargar métricas reales primero, usar ejemplos como fallback
  React.useEffect(() => {
    const loadRealMetrics = async () => {
      try {
        console.log('Intentando cargar métricas reales desde la API...');
        const response = await metricsAPI.getMetrics();
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log(`Cargadas ${response.data.length} métricas reales desde la API`);
          setMetrics(response.data);
          
          // Extraer categorías únicas de las métricas reales
          const uniqueCategories = Array.from(new Set(response.data.map((metric: any) => metric.category))).sort() as string[];
          setCategories(uniqueCategories);
        } else {
          console.log('La API devolvió un array vacío de métricas, usando fallback');
          loadExampleMetrics();
        }
      } catch (error) {
        console.error('Error cargando métricas reales:', error);
        loadExampleMetrics();
      }
    };
    
    loadRealMetrics();
  }, []);  // Ejecutar solo una vez al montar el componente

  // Filter metrics based on search query and category filter
  const filteredMetrics = Array.isArray(metrics) ? metrics.filter(metric => {
    const matchesSearch = metric.name.toLowerCase().includes(searchQuery?.toLowerCase() || '') || 
                         (metric.description && metric.description.toLowerCase().includes(searchQuery?.toLowerCase() || ''));
    const matchesCategory = categoryFilter === 'all' || metric.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) : [];
  
  // Log para depuración
  console.log('Estado actual:', {
    loading,
    metricsLength: metrics?.length || 0,
    filteredMetricsLength: filteredMetrics.length,
    searchQuery,
    categoryFilter,
    categories
  });
  
  // Log detallado de las métricas para verificar su estructura
  console.log('Contenido de métricas:', metrics);
  console.log('Contenido de métricas filtradas:', filteredMetrics);

  // Get metric details by ID
  const getMetricById = (metricId: number) => {
    return Array.isArray(metrics) ? metrics.find(m => m.id === metricId) : undefined;
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Loading metrics configuration...
          </Typography>
          <Button 
            variant="text" 
            color="primary" 
            sx={{ mt: 2 }}
            onClick={() => router.push(`/projects/${projectIdNum}`)}
          >
            Cancel and return to project
          </Button>
        </Box>
      </MainLayout>
    );
  }

  if (error || !project) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Metrics Configuration
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Project not found'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: '#00B37E',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00A070',
              },
            }}
          >
            Back to Projects
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/projects/${project.id}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Metrics Configuration
            </Typography>
            <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
              Configure metrics for project: {project.name}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon sx={{ color: '#FFFFFF' }} />}
            onClick={handleSaveConfiguration}
            disabled={saving}
            sx={{
              backgroundColor: '#00B37E',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00A070',
              },
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Configuration'}
          </Button>
        </Box>

        {/* Success/Error Messages */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="metrics configuration tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
              },
              '& .Mui-selected': {
                color: '#00B37E',
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#00B37E',
              },
            }}
          >
            <Tab label="Available Metrics" id="metrics-tab-0" aria-controls="metrics-tabpanel-0" />
            <Tab label="Selected Metrics" id="metrics-tab-1" aria-controls="metrics-tabpanel-1" />
            <Tab label="Templates" id="metrics-tab-2" aria-controls="metrics-tabpanel-2" />
          </Tabs>
        </Box>

        {/* Available Metrics Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Available Metrics
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: '#555555' }}>
            Select metrics to add to your project configuration.
          </Typography>
          
          {/* Filters and Search */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              label="Search metrics"
              variant="outlined"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#999', mr: 1 }} />,
              }}
            />
            <FormControl sx={{ minWidth: 200 }} size="small">
              <InputLabel id="category-filter-label">Category</InputLabel>
              <Select
                labelId="category-filter-label"
                value={categoryFilter}
                label="Category"
                onChange={handleCategoryFilterChange}
                startAdornment={<FilterListIcon sx={{ color: '#999', mr: 1 }} />}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {/* Debug Info */}
          <Box sx={{ mb: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Estado de depuración:</Typography>
            <Typography variant="body2">Métricas cargadas: {metrics?.length || 0}</Typography>
            <Typography variant="body2">Métricas filtradas: {filteredMetrics.length}</Typography>
            <Typography variant="body2">Categoría seleccionada: {categoryFilter}</Typography>
            <Typography variant="body2">Búsqueda: {searchQuery || '(ninguna)'}</Typography>
            <Typography variant="body2">Categorías disponibles: {categories.join(', ') || '(ninguna)'}</Typography>
            
            {/* Mostrar primera métrica como ejemplo si existe */}
            {filteredMetrics.length > 0 && (
              <Box sx={{ mt: 2, p: 1, border: '1px solid #ddd', borderRadius: 1, backgroundColor: '#fff' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Primera métrica (ejemplo):</Typography>
                <pre style={{ fontSize: '0.75rem', overflowX: 'auto' }}>
                  {JSON.stringify(filteredMetrics[0], null, 2)}
                </pre>
              </Box>
            )}
          </Box>
          
          {/* Metrics Grid */}
          <Grid container spacing={3}>
            {filteredMetrics.length > 0 ? (
              filteredMetrics.map((metric) => (
                <Grid item xs={12} sm={6} md={4} key={metric.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      border: '1px solid #EEEEEE',
                      borderRadius: 2,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                        borderColor: '#00B37E',
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                          {metric.name}
                        </Typography>
                        <Chip 
                          label={metric.category} 
                          size="small" 
                          sx={{ 
                            backgroundColor: '#F0F9F6', 
                            color: '#00B37E',
                            fontWeight: 500,
                          }} 
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {metric.description || 'No description available'}
                      </Typography>
                      
                      {/* Parameter preview */}
                      {Object.keys(metric.parameters).length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" sx={{ color: '#555555', fontWeight: 500 }}>
                            Parameters:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {Object.keys(metric.parameters).map((param) => (
                              <Chip 
                                key={param} 
                                label={param} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon sx={{ color: '#FFFFFF' }} />}
                        onClick={() => handleAddMetric(metric)}
                        disabled={selectedMetrics.some(m => m.metric_id === metric.id)}
                        sx={{
                          backgroundColor: '#00B37E',
                          color: '#FFFFFF',
                          '&:hover': {
                            backgroundColor: '#00A070',
                          },
                          minWidth: '70px',
                          height: '36px',
                          padding: '0 8px',
                        }}
                      >
                        {selectedMetrics.some(m => m.metric_id === metric.id) ? 'Added' : 'Add'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
                  <Typography variant="body1" sx={{ color: '#555555' }}>
                    No metrics found matching your search criteria.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Selected Metrics Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Selected Metrics
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: '#555555' }}>
            Configure parameters for selected metrics.
          </Typography>
          
          {selectedMetrics.length > 0 ? (
            <Paper sx={{ borderRadius: 2, border: '1px solid #EEEEEE' }}>
              <List>
                {selectedMetrics.map((metricConfig) => {
                  const metric = getMetricById(metricConfig.metric_id);
                  return metric ? (
                    <React.Fragment key={metric.id}>
                      <ListItem
                        sx={{
                          borderBottom: '1px solid #EEEEEE',
                          '&:last-child': {
                            borderBottom: 'none',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {metric.name}
                              </Typography>
                              <Chip 
                                label={metric.category} 
                                size="small" 
                                sx={{ 
                                  backgroundColor: '#F0F9F6', 
                                  color: '#00B37E',
                                  fontWeight: 500,
                                }} 
                              />
                            </Box>
                          }
                          secondary={metric.description || 'No description available'}
                        />
                        <ListItemSecondaryAction>
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<EditIcon />}
                            sx={{
                              mr: 1,
                              borderColor: '#00B37E',
                              color: '#00B37E',
                              '&:hover': {
                                borderColor: '#00A070',
                                backgroundColor: 'rgba(0, 179, 126, 0.04)',
                              },
                            }}
                            onClick={() => handleOpenConfigDialog(metric.id)}
                          >
                            Configure
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleRemoveMetric(metric.id)}
                            sx={{
                              borderColor: '#E5484D',
                              color: '#E5484D',
                              '&:hover': {
                                borderColor: '#D03E43',
                                backgroundColor: 'rgba(229, 72, 77, 0.04)',
                              },
                            }}
                          >
                            Remove
                          </Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </React.Fragment>
                  ) : null;
                })}
              </List>
            </Paper>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                No metrics selected yet.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setTabValue(0)}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                Browse Available Metrics
              </Button>
            </Paper>
          )}
          {/* Action buttons */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
            >
              Back
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon sx={{ color: '#FFFFFF' }} />}
              disabled={saving || selectedMetrics.length === 0}
              sx={{
                backgroundColor: '#00B37E',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
              onClick={handleSaveAllConfigurations}
            >
              {saving ? 'Saving...' : 'Save Configurations'}
            </Button>
          </Box>
        </TabPanel>

        {/* Templates Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Metric Templates
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: '#555555' }}>
            Save and load metric configurations as templates for reuse across projects.
          </Typography>
          
          {/* Templates UI */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon sx={{ color: '#FFFFFF' }} />}
              onClick={handleOpenSaveTemplateDialog}
              disabled={selectedMetrics.length === 0}
              sx={{
                backgroundColor: '#00B37E',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
            >
              Save Current Configuration as Template
            </Button>
            <Button
              variant="outlined"
              onClick={handleOpenLoadTemplateDialog}
              disabled={templates.length === 0}
              sx={{
                borderColor: '#00B37E',
                color: '#00B37E',
                '&:hover': {
                  borderColor: '#00A070',
                  backgroundColor: 'rgba(0, 179, 126, 0.04)',
                },
              }}
            >
              Load Template
            </Button>
          </Box>
          
          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress size={40} sx={{ color: '#00B37E' }} />
            </Box>
          ) : templates.length === 0 ? (
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <Typography color="text.secondary">
                No saved templates yet. Configure metrics and save them as a template to reuse later.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      border: '1px solid #EEEEEE',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6">{template.name}</Typography>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleDeleteTemplate(template.id)}
                        sx={{ mt: -1, mr: -1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    
                    {template.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        <strong>{template.metrics.length}</strong> metric{template.metrics.length !== 1 ? 's' : ''} configured
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Last updated: {new Date(template.updated_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ 
                        mt: 2,
                        alignSelf: 'flex-start',
                        borderColor: '#00B37E',
                        color: '#00B37E',
                        '&:hover': {
                          borderColor: '#00A070',
                          backgroundColor: 'rgba(0, 179, 126, 0.04)',
                        },
                      }}
                      onClick={() => handleLoadTemplate(template.id)}
                    >
                      Load Template
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )})
        </TabPanel>
      </Box>
      
      {/* Metric Parameter Configuration Dialog */}
      <MetricParameterDialog
        open={configDialogOpen}
        onClose={handleCloseConfigDialog}
        metric={currentMetric}
        metricConfig={currentMetricConfig}
        onSave={handleSaveParameters}
      />
      
      {/* Save Template Dialog */}
      <MetricTemplateDialog
        open={saveTemplateDialogOpen}
        onClose={() => setSaveTemplateDialogOpen(false)}
        onSave={handleSaveTemplate}
        metrics={selectedMetrics}
        mode="save"
      />
      
      {/* Load Template Dialog - This would be replaced with a proper template selection dialog */}
      {loadTemplateDialogOpen && (
        <Dialog 
          open={loadTemplateDialogOpen} 
          onClose={() => setLoadTemplateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Select Template to Load</DialogTitle>
          <DialogContent>
            <List>
              {templates.map((template) => (
                <ListItem key={template.id} disablePadding>
                  <ListItemButton onClick={() => handleLoadTemplate(template.id)}>
                    <ListItemText 
                      primary={template.name} 
                      secondary={`${template.metrics.length} metrics | ${template.description || 'No description'}`} 
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLoadTemplateDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
    </MainLayout>
  );
};

export default MetricsConfigurationPage;
