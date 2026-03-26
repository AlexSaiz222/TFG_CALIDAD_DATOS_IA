import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Card,
  CardActionArea,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import TemplateCard from '../../components/metrics/TemplateCard';
import { metricsAPI } from '../../services/api';
import { MetricTemplate, Metric } from '../../types';
import { categoryColor, GREEN, GREEN_HOVER } from '../../utils/metricColors';

const TemplatesSettings = () => {
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [allMetrics, setAllMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MetricTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MetricTemplate | null>(null);

  // Form states
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesResponse, metricsResponse] = await Promise.all([
        metricsAPI.getMetricTemplates(),
        metricsAPI.getMetrics(),
      ]);

      const templatesData = (templatesResponse as any)?.data?.templates
        || (templatesResponse as any)?.data
        || [];

      const allTemplates = Array.isArray(templatesData) ? templatesData : [];
      setTemplates(allTemplates);

      const metricsData = (metricsResponse as any)?.data || [];
      setAllMetrics(Array.isArray(metricsData) ? metricsData : []);
    } catch (err: any) {
      setError('Error al cargar las plantillas. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: MetricTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      const metricIds = template.metrics?.map((m: any) => m.id ?? m.metric_id) || [];
      setSelectedMetricIds(new Set(metricIds.filter(Boolean)));
    } else {
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateDescription('');
      setSelectedMetricIds(new Set());
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setSelectedMetricIds(new Set());
  };

  const handleToggleMetric = (metricId: number) => {
    setSelectedMetricIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(metricId)) newSet.delete(metricId);
      else newSet.add(metricId);
      return newSet;
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('El nombre de la plantilla es obligatorio');
      return;
    }
    if (selectedMetricIds.size === 0) {
      setError('Debes seleccionar al menos una métrica');
      return;
    }

    try {
      const metricsConfig = Array.from(selectedMetricIds).map((id) => {
        const metric = allMetrics.find((m) => m.id === id);
        return {
          metric_id: metric!.id,
          name: metric!.name,
          category: metric!.category,
          enabled: true,
          parameters: metric!.parameters || {},
        };
      });

      const payload = {
        name: templateName,
        description: templateDescription,
        metrics: metricsConfig,
      };

      if (editingTemplate) {
        await metricsAPI.updateMetricTemplate(editingTemplate.id, payload);
        setSuccess('Plantilla actualizada correctamente');
      } else {
        await metricsAPI.createMetricTemplate(payload);
        setSuccess('Plantilla creada correctamente');
      }

      handleCloseDialog();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar la plantilla');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await metricsAPI.deleteMetricTemplate(templateToDelete.id);
      setSuccess('Plantilla eliminada correctamente');
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar la plantilla');
    }
  };

  const handleDuplicateTemplate = (template: MetricTemplate) => {
    setEditingTemplate(null);
    setTemplateName(`${template.name} (copia)`);
    setTemplateDescription(template.description || '');
    const metricIds = template.metrics?.map((m: any) => m.id ?? m.metric_id) || [];
    setSelectedMetricIds(new Set(metricIds.filter(Boolean)));
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress sx={{ color: GREEN }} />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 0.5 }}>
              Plantillas de métricas
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              Crea y gestiona plantillas personalizadas para aplicar en tus proyectos
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              backgroundColor: GREEN,
              color: '#fff',
              '&:hover': { backgroundColor: GREEN_HOVER },
            }}
          >
            Nueva plantilla
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {templates.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              border: '2px dashed #E0E0E0',
              borderRadius: 2,
              backgroundColor: '#FAFAFA',
            }}
          >
            <Typography variant="h6" sx={{ color: '#999', mb: 1 }}>
              No tienes plantillas aún
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
              Crea tu primera plantilla para reutilizar configuraciones de métricas en múltiples proyectos
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                borderColor: GREEN,
                color: GREEN,
                '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0,179,126,0.04)' },
              }}
            >
              Crear plantilla
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 2 }}>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                mode="manage"
                onEdit={handleOpenDialog}
                onDuplicate={handleDuplicateTemplate}
                onDelete={(t) => {
                  setTemplateToDelete(t);
                  setDeleteDialogOpen(true);
                }}
              />
            ))}
          </Box>
        )}

      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre de la plantilla"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Descripción (opcional)"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Selecciona las métricas
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            {selectedMetricIds.size} métrica{selectedMetricIds.size !== 1 ? 's' : ''} seleccionada{selectedMetricIds.size !== 1 ? 's' : ''}
          </Typography>

          <Box sx={{ maxHeight: '400px', overflowY: 'auto', pr: 1 }}>
            <Grid container spacing={1.5}>
              {allMetrics.map((metric) => {
                const isSelected = selectedMetricIds.has(metric.id);
                const colors = categoryColor(metric.category);
                return (
                  <Grid item xs={12} sm={6} key={metric.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: isSelected ? colors.fg : '#E0E0E0',
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: isSelected ? colors.bg : '#FAFAFA',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': {
                          borderColor: colors.fg,
                          boxShadow: `0 2px 8px ${colors.bg}`,
                        },
                      }}
                    >
                      <CardActionArea onClick={() => handleToggleMetric(metric.id)} sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 0.5 }}>
                              {metric.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                              {metric.description || 'Sin descripción'}
                            </Typography>
                            <Chip
                              label={metric.category}
                              size="small"
                              sx={{
                                backgroundColor: colors.bg,
                                color: colors.fg,
                                fontWeight: 500,
                                fontSize: '0.65rem',
                                height: 18,
                              }}
                            />
                          </Box>
                          {isSelected && (
                            <CheckCircleIcon sx={{ color: colors.fg, fontSize: 20 }} />
                          )}
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#666' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            sx={{
              backgroundColor: GREEN,
              color: '#fff',
              '&:hover': { backgroundColor: GREEN_HOVER },
            }}
          >
            {editingTemplate ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Eliminar plantilla</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que quieres eliminar la plantilla &quot;{templateToDelete?.name}&quot;?
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#666' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteTemplate}
            variant="contained"
            sx={{
              backgroundColor: '#E5484D',
              color: '#fff',
              '&:hover': { backgroundColor: '#D32F2F' },
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default TemplatesSettings;
