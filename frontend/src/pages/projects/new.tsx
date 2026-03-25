import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  Checkbox,
  FormControlLabel,
  Divider,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as TemplateIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { projectsAPI, metricsAPI } from '../../services/api';
import { safeNavigate } from '../../utils/routeTransition';

const GREEN = '#00B37E';
const GREEN_HOVER = '#00A070';

const steps = ['Información básica', 'Plantilla y métricas', 'Resumen y confirmación'];

const NewProject = () => {
  const router = useRouter();

  // Step state
  const [activeStep, setActiveStep] = useState(0);

  // Form data
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Template & metrics state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [allMetrics, setAllMetrics] = useState<any[]>([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<number>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = useState(false);


  // Global state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates & metrics when entering step 2
  useEffect(() => {
    if (activeStep === 1 && templates.length === 0) {
      loadTemplatesAndMetrics();
    }
  }, [activeStep]);

  const loadTemplatesAndMetrics = async () => {
    setLoadingTemplates(true);
    try {
      const [templatesRes, metricsRes] = await Promise.all([
        metricsAPI.getMetricTemplates() as Promise<any>,
        metricsAPI.getMetrics(),
      ]);

      // Parse templates
      let tData = templatesRes?.data || [];
      if (!Array.isArray(tData)) {
        tData = tData.templates || [];
      }
      setTemplates(Array.isArray(tData) ? tData : []);

      // Parse metrics
      let mData = metricsRes?.data || [];
      if (!Array.isArray(mData)) {
        mData = mData.metrics || [];
      }
      setAllMetrics(Array.isArray(mData) ? mData : []);

      // Default: select completeness, uniqueness, outliers
      if (selectedMetricIds.size === 0) {
        const defaultNames = ['completeness', 'uniqueness', 'outliers'];
        const ids = new Set<number>();
        (Array.isArray(mData) ? mData : []).forEach((m: any) => {
          if (defaultNames.includes(m.name?.toLowerCase())) ids.add(m.id);
        });
        setSelectedMetricIds(ids);
      }
    } catch (err) {
      console.error('Error loading templates/metrics:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      const newErrors: Record<string, string> = {};
      if (!formData.name.trim()) newErrors.name = 'El nombre del proyecto es obligatorio';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }
    return true;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!validateStep(0)) return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleTemplateSelect = (templateId: number | null) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const tmpl = templates.find((t) => t.id === templateId);
      if (tmpl?.metrics && Array.isArray(tmpl.metrics)) {
        const ids = new Set<number>();
        tmpl.metrics.forEach((m: any) => {
          if (m.metric_id) ids.add(m.metric_id);
        });
        setSelectedMetricIds(ids);
      }
    }
  };

  const toggleMetric = (metricId: number) => {
    setSelectedMetricIds((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
    // Deselect template since user customized
    setSelectedTemplateId(null);
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!validateStep(0)) { setActiveStep(0); return; }

    setLoading(true);
    setError(null);

    try {
      // Build metrics_config from selected metric IDs
      const metricsConfig = Array.from(selectedMetricIds).map((id) => {
        const metric = allMetrics.find((m) => m.id === id);
        return {
          id: metric?.name || String(id),
          parameters: metric?.parameters || {},
          weight: 1.0,
        };
      });

      const payload: any = {
        name: formData.name,
        description: formData.description,
        metrics_config: metricsConfig,
      };

      if (selectedTemplateId) {
        payload.template_id = selectedTemplateId;
      }

      const response = await projectsAPI.createProject(payload);
      const newProject = response.data;

      if (window.localStorage) {
        localStorage.removeItem('projectsCache');
      }

      safeNavigate(`/projects/${newProject.id || newProject.data?.id}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.response?.data?.message || 'Error al crear el proyecto. Inténtelo de nuevo.');
      setLoading(false);
    }
  };

  // --- Render helpers ---
  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'data_quality': return { bg: 'rgba(0,179,126,0.1)', fg: GREEN };
      case 'statistical': return { bg: 'rgba(255,184,0,0.12)', fg: '#FFB800' };
      case 'ml_specific': return { bg: 'rgba(33,150,243,0.12)', fg: '#2196F3' };
      default: return { bg: 'rgba(0,0,0,0.06)', fg: '#555' };
    }
  };

  // ===== RENDER =====
  return (
    <MainLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', mb: 4, px: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, width: '100%', maxWidth: 900 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Nuevo proyecto
          </Typography>
        </Box>

        {/* Stepper - Custom Professional Design */}
        <Box sx={{ width: '100%', maxWidth: 900, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', px: 2 }}>
            {/* Progress line background */}
            <Box sx={{
              position: 'absolute',
              top: 20,
              left: '16.66%',
              right: '16.66%',
              height: 3,
              bgcolor: '#E0E0E0',
              borderRadius: 1.5,
              zIndex: 0,
            }} />
            {/* Progress line foreground */}
            <Box sx={{
              position: 'absolute',
              top: 20,
              left: '16.66%',
              width: activeStep === 0 ? '0%' : activeStep === 1 ? '25%' : activeStep === 2 ? '50%' : '75%',
              height: 3,
              bgcolor: GREEN,
              borderRadius: 1.5,
              zIndex: 0,
              transition: 'width 0.3s ease-in-out',
            }} />

            {steps.map((label, index) => {
              const isActive = index === activeStep;
              const isCompleted = index < activeStep;
              return (
                <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 1 }}>
                  {/* Step circle */}
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isCompleted || isActive ? GREEN : '#E0E0E0',
                    color: isCompleted || isActive ? '#FFFFFF' : '#999999',
                    fontWeight: 700,
                    fontSize: '1rem',
                    mb: 1,
                    transition: 'all 0.3s ease-in-out',
                    border: isActive ? `3px solid ${GREEN}` : 'none',
                    boxShadow: isActive ? `0 0 0 4px rgba(0,179,126,0.15)` : 'none',
                  }}>
                    {isCompleted ? (
                      <CheckCircleIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
                    ) : (
                      index + 1
                    )}
                  </Box>
                  {/* Step label */}
                  <Typography variant="body2" sx={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#1A1A1A' : isCompleted ? '#555' : '#999',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    transition: 'all 0.3s ease-in-out',
                  }}>
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 900 }}>
            {error}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            width: '100%',
            maxWidth: 900,
            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* ===== STEP 0: Basic Info ===== */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Información del proyecto
              </Typography>
              <TextField
                fullWidth
                label="Nombre del proyecto"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
                sx={{ mb: 2 }}
                required
                size="small"
              />
              <TextField
                fullWidth
                label="Descripción"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={4}
                sx={{ mb: 2 }}
                placeholder="Describe brevemente el propósito del proyecto (opcional)"
                size="small"
              />
            </Box>
          )}

          {/* ===== STEP 1: Templates & Metrics ===== */}
          {activeStep === 1 && (
            <Box>
              {loadingTemplates ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {/* Template selection */}
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Elige una plantilla
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                    Selecciona una plantilla predefinida o personaliza las métricas manualmente.
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {/* "Sin plantilla" card */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderColor: selectedTemplateId === null ? GREEN : '#E0E0E0',
                          borderWidth: selectedTemplateId === null ? 2 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        <CardActionArea onClick={() => handleTemplateSelect(null)} sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TemplateIcon sx={{ color: selectedTemplateId === null ? GREEN : '#999' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              Personalizada
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Selecciona métricas manualmente sin partir de una plantilla.
                          </Typography>
                          {selectedTemplateId === null && (
                            <CheckCircleIcon sx={{ position: 'absolute', top: 8, right: 8, color: GREEN, fontSize: 20 }} />
                          )}
                        </CardActionArea>
                      </Card>
                    </Grid>

                    {templates.map((tmpl) => (
                      <Grid item xs={12} sm={6} md={4} key={tmpl.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderColor: selectedTemplateId === tmpl.id ? GREEN : '#E0E0E0',
                            borderWidth: selectedTemplateId === tmpl.id ? 2 : 1,
                            transition: 'all 0.2s',
                            position: 'relative',
                          }}
                        >
                          <CardActionArea onClick={() => handleTemplateSelect(tmpl.id)} sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <TemplateIcon sx={{ color: selectedTemplateId === tmpl.id ? GREEN : '#999' }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {tmpl.name}
                              </Typography>
                              {tmpl.is_system && (
                                <Chip label="Sistema" size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                              )}
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {tmpl.description || 'Sin descripción'}
                            </Typography>
                            <Chip
                              label={`${tmpl.metrics?.length || 0} métricas`}
                              size="small"
                              sx={{ backgroundColor: 'rgba(0,179,126,0.1)', color: GREEN, fontWeight: 500 }}
                            />
                            {selectedTemplateId === tmpl.id && (
                              <CheckCircleIcon sx={{ position: 'absolute', top: 8, right: 8, color: GREEN, fontSize: 20 }} />
                            )}
                          </CardActionArea>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  {/* Metrics selection */}
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Métricas activas
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                    Activa o desactiva métricas individuales. Podrás configurar parámetros detallados desde el proyecto.
                  </Typography>

                  <Grid container spacing={1}>
                    {allMetrics.map((metric) => {
                      const isSelected = selectedMetricIds.has(metric.id);
                      const cc = categoryColor(metric.category);
                      return (
                        <Grid item xs={12} sm={6} key={metric.id}>
                          <Box
                            onClick={() => toggleMetric(metric.id)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 1.5,
                              borderRadius: 1.5,
                              border: `1px solid ${isSelected ? GREEN : '#E0E0E0'}`,
                              backgroundColor: isSelected ? 'rgba(0,179,126,0.04)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              '&:hover': { borderColor: GREEN, backgroundColor: 'rgba(0,179,126,0.02)' },
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              size="small"
                              sx={{ p: 0.5, mr: 1, color: GREEN, '&.Mui-checked': { color: GREEN } }}
                              tabIndex={-1}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                                {metric.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {metric.description}
                              </Typography>
                            </Box>
                            <Chip
                              label={metric.category?.replace('_', ' ')}
                              size="small"
                              sx={{ ml: 1, backgroundColor: cc.bg, color: cc.fg, fontSize: '0.65rem', height: 20 }}
                            />
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {allMetrics.length === 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      No se encontraron métricas disponibles.
                    </Alert>
                  )}
                </>
              )}
            </Box>
          )}

          {/* ===== STEP 2: Summary & Confirmation ===== */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#1A1A1A' }}>
                Resumen del proyecto
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
                Revisa la información antes de crear el proyecto. Podrás modificarla después desde la configuración.
              </Typography>

              {/* Project Info */}
              <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: '1px solid #E0E0E0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: GREEN }}>
                  Información básica
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#999', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
                      Nombre
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formData.name}
                    </Typography>
                  </Box>
                  {formData.description && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#999', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
                        Descripción
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555' }}>
                        {formData.description}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {/* Template & Metrics */}
              <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: '1px solid #E0E0E0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: GREEN }}>
                  Configuración de métricas
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#999', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
                      Plantilla
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedTemplateId 
                        ? templates.find(t => t.id === selectedTemplateId)?.name || 'Plantilla personalizada'
                        : 'Personalizada (sin plantilla)'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#999', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600, mb: 1, display: 'block' }}>
                      Métricas seleccionadas ({selectedMetricIds.size})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {Array.from(selectedMetricIds).map((metricId) => {
                        const metric = allMetrics.find(m => m.id === metricId);
                        if (!metric) return null;
                        const colors = categoryColor(metric.category);
                        return (
                          <Chip
                            key={metricId}
                            label={metric.name}
                            size="small"
                            sx={{
                              backgroundColor: colors.bg,
                              color: colors.fg,
                              fontWeight: 500,
                              fontSize: '0.75rem',
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* Info box */}
              <Alert severity="info" sx={{ mt: 3 }}>
                Al crear el proyecto, podrás subir datasets y configurar evaluaciones de calidad de datos.
              </Alert>
            </Box>
          )}

          {/* ===== Navigation buttons ===== */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid #EEE' }}>
            <Button
              variant="outlined"
              onClick={activeStep === 0 ? () => router.back() : handleBack}
              disabled={loading}
              sx={{ borderColor: '#CCC', color: '#555', '&:hover': { borderColor: '#AAA', backgroundColor: 'rgba(0,0,0,0.04)' } }}
            >
              {activeStep === 0 ? 'Cancelar' : 'Anterior'}
            </Button>

            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{ backgroundColor: GREEN, color: '#fff', '&:hover': { backgroundColor: GREEN_HOVER } }}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ backgroundColor: GREEN, color: '#fff', px: 4, '&:hover': { backgroundColor: GREEN_HOVER } }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Crear proyecto'}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    </MainLayout>
  );
};

export default NewProject;
