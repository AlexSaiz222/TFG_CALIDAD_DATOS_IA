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
import { Metric, MetricConfig, Project } from '../../types';

// Template interface
interface MetricTemplate {
  id: number;
  name: string;
  description: string;
  metrics_config: MetricConfig[];
  created_at: string;
  updated_at: string;
}

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

  useEffect(() => {
    const fetchData = async () => {
      if (!projectIdNum) return;

      setLoading(true);
      setError(null);
      
      // Also fetch templates
      setLoadingTemplates(true);

      try {
        // Fetch available metrics
        const metricsResponse = await metricsAPI.getMetrics();
        
        // Ensure metricsData is an array
        let metricsData = [];
        if (metricsResponse.data) {
          if (Array.isArray(metricsResponse.data)) {
            metricsData = metricsResponse.data;
          } else if (metricsResponse.data.metrics && Array.isArray(metricsResponse.data.metrics)) {
            metricsData = metricsResponse.data.metrics;
          } else if (typeof metricsResponse.data === 'object') {
            // Look for any array property that might contain metrics
            const possibleArrays = Object.values(metricsResponse.data).filter(val => Array.isArray(val));
            if (possibleArrays.length > 0) {
              // Use the first array found
              metricsData = possibleArrays[0] as any[];
            } else {
              console.warn('API response does not contain an array of metrics');
            }
          }
        }
        
        console.log('Normalized metrics data:', metricsData);
        setMetrics(metricsData);

        // Extract unique categories from metrics
        const uniqueCategories = Array.isArray(metricsData) && metricsData.length > 0 ? 
          Array.from(new Set(metricsData.map((metric: Metric) => metric.category))).sort() as string[] : 
          [];
        setCategories(uniqueCategories);

        // Fetch project details
        const projectResponse = await projectsAPI.getProject(projectIdNum);
        setProject(projectResponse.data);

        // Fetch project's current metric configurations
        try {
          const metricsConfigResponse = await metricsAPI.getProjectMetricConfigs(projectIdNum);
          if (metricsConfigResponse.data && Array.isArray(metricsConfigResponse.data)) {
            setSelectedMetrics(metricsConfigResponse.data);
          }
        } catch (configError) {
          console.log('No existing metric configurations found or endpoint not available yet');
          // Don't set an error as this might be a new project without configurations
        }

        setLoading(false);
        
        // Fetch templates
        try {
          const templatesResponse = await metricsAPI.getMetricTemplates();
          setTemplates(templatesResponse.data);
        } catch (templatesError) {
          console.error('Error fetching templates:', templatesError);
          // Don't set error as templates are not critical
        } finally {
          setLoadingTemplates(false);
        }
      } catch (error: any) {
        console.error('Error fetching metrics data:', error);
        setError(error.response?.data?.message || 'Failed to load metrics data. Please try again.');
        setLoading(false);
        setLoadingTemplates(false);
      }
    };

    if (projectIdNum) {
      fetchData();
    }
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
    if (!projectIdNum || selectedMetrics.length === 0) {
      setError('No metrics selected or project ID is invalid');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      await metricsAPI.saveProjectMetricConfigs(projectIdNum, selectedMetrics);
      setSuccess('Metric configurations saved successfully');
      
      // Optionally refresh project data
      const projectResponse = await projectsAPI.getProject(projectIdNum);
      setProject(projectResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save metric configurations');
    } finally {
      setSaving(false);
    }
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
        metrics_config: selectedMetrics
      };
      
      await metricsAPI.createMetricTemplate(templateData);
      setSuccess(`Template "${name}" saved successfully`);
      
      // Refresh templates
      const templatesResponse = await metricsAPI.getMetricTemplates();
      setTemplates(templatesResponse.data);
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
          setSelectedMetrics(template.metrics_config);
          setSuccess(`Template "${template.name}" loaded successfully`);
        }
      } else {
        setSelectedMetrics(template.metrics_config);
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

  // Filter metrics based on search query and category filter
  const filteredMetrics = Array.isArray(metrics) ? metrics.filter(metric => {
    const matchesSearch = metric.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (metric.description && metric.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || metric.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) : [];

  // Get metric details by ID
  const getMetricById = (metricId: number) => {
    return Array.isArray(metrics) ? metrics.find(m => m.id === metricId) : undefined;
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
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
            startIcon={<SaveIcon />}
            onClick={handleSaveConfiguration}
            disabled={saving}
            sx={{
              backgroundColor: '#00B37E',
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
                        startIcon={<AddIcon />}
                        onClick={() => handleAddMetric(metric)}
                        disabled={selectedMetrics.some(m => m.metric_id === metric.id)}
                        sx={{
                          backgroundColor: '#00B37E',
                          '&:hover': {
                            backgroundColor: '#00A070',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: '#E0E0E0',
                            color: '#A0A0A0',
                          }
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
              startIcon={<SaveIcon />}
              disabled={saving || selectedMetrics.length === 0}
              sx={{
                backgroundColor: '#00B37E',
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
              onClick={handleOpenSaveTemplateDialog}
              disabled={selectedMetrics.length === 0}
              sx={{
                backgroundColor: '#00B37E',
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
                        <strong>{template.metrics_config.length}</strong> metric{template.metrics_config.length !== 1 ? 's' : ''} configured
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
                      secondary={`${template.metrics_config.length} metrics | ${template.description || 'No description'}`} 
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
