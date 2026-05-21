import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  IconButton,
  Tooltip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  FileUpload as FileUploadIcon,
  FormatAlignLeft as FormatIcon,
  ContentCopy as CopyIcon,
  FileDownload as FileDownloadIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Tune as TuneIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import MainLayout from '../../components/layout/MainLayout';
import TemplateCard from '../../components/metrics/TemplateCard';
import SmartMetricConfigDialog from '../../components/metrics/SmartMetricConfigDialog';
import { metricsAPI } from '../../services/api';
import { MetricTemplate, Metric } from '../../types';
import { getMetricMeta, GREEN, GREEN_HOVER } from '../../utils/metricColors';

const TemplatesSettings = () => {
  const { t } = useTranslation();
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
  const [selectedMetricsConfig, setSelectedMetricsConfig] = useState<Record<number, any>>({});
  
  // Metric Parameter Config Dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentMetricToConfig, setCurrentMetricToConfig] = useState<Metric | null>(null);

  // Import file ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog view mode
  const [dialogViewMode, setDialogViewMode] = useState<'visual' | 'json'>('visual');
  const [dialogEditJson, setDialogEditJson] = useState('');
  const [dialogEditJsonValid, setDialogEditJsonValid] = useState(true);
  const [dialogEditJsonError, setDialogEditJsonError] = useState<string | null>(null);
  const dialogEditEditorRef = useRef<any>(null);

  // JSON view/edit dialog
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonDialogText, setJsonDialogText] = useState('');
  const [jsonDialogValid, setJsonDialogValid] = useState(true);
  const [jsonDialogError, setJsonDialogError] = useState<string | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const jsonEditorRef = useRef<any>(null);

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

      const metricsRaw = (metricsResponse as any)?.data || [];
      const metricsData = (Array.isArray(metricsRaw) ? metricsRaw : [])
        .filter((m: any) => m?.name?.toLowerCase() !== 'outliers');
      setAllMetrics(metricsData);
    } catch (err: any) {
      setError(t('metrics.templates.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: MetricTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      const metricConfigs: Record<number, any> = {};
      template.metrics?.forEach((m: any) => {
        const id = m.id ?? m.metric_id;
        if (id) {
          metricConfigs[id] = m.parameters || {};
        }
      });
      setSelectedMetricsConfig(metricConfigs);
    } else {
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateDescription('');
      setSelectedMetricsConfig({});
    }
    setDialogViewMode('visual');
    setDialogEditJsonError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setSelectedMetricsConfig({});
    setDialogViewMode('visual');
    setDialogEditJsonError(null);
  };

  const handleToggleMetric = (metricId: number) => {
    setSelectedMetricsConfig((prev) => {
      const newConfig = { ...prev };
      if (metricId in newConfig) {
        delete newConfig[metricId];
      } else {
        const metric = allMetrics.find((m) => m.id === metricId);
        newConfig[metricId] = metric?.parameters || {};
      }
      return newConfig;
    });
  };

  const handleSaveTemplate = async () => {
    // If in JSON mode, parse and apply first
    if (dialogViewMode === 'json') {
      if (!dialogEditJsonValid) {
        setError(t('metrics.templates.jsonError'));
        return;
      }
      const text = dialogEditEditorRef.current?.getValue() ?? dialogEditJson;
      try {
        const data = JSON.parse(text);
        if (data.name !== undefined) setTemplateName(data.name);
        if (data.description !== undefined) setTemplateDescription(data.description);
        if (Array.isArray(data.metrics)) {
          const configs: Record<number, any> = {};
          data.metrics.forEach((m: any) => {
            const match = allMetrics.find((am) => am.name === m.name);
            if (match) configs[match.id] = m.parameters || {};
          });
          setSelectedMetricsConfig(configs);
        }
        // Validate name after applying
        if (!data.name?.trim()) {
          setError(t('metrics.templates.templateNameRequired'));
          return;
        }
        if (!Array.isArray(data.metrics) || data.metrics.length === 0) {
          setError(t('metrics.templates.atLeastOneMetric'));
          return;
        }
        // Build payload directly from JSON data
        const metricsConfig = data.metrics
          .map((m: any) => {
            const metric = allMetrics.find((am) => am.name === m.name);
            if (!metric) return null;
            return { metric_id: metric.id, name: metric.name, category: metric.category, enabled: true, parameters: m.parameters || {} };
          })
          .filter(Boolean);
        const payload = { name: data.name, description: data.description || '', metrics: metricsConfig };
        try {
          if (editingTemplate) {
            await metricsAPI.updateMetricTemplate(editingTemplate.id, payload);
            setSuccess(t('metrics.templates.templateUpdated'));
          } else {
            await metricsAPI.createMetricTemplate(payload);
            setSuccess(t('metrics.templates.templateCreated'));
          }
          handleCloseDialog();
          fetchData();
        } catch (err: any) {
          setError(err.response?.data?.message || t('metrics.templates.saveError'));
        }
        return;
      } catch {
        setError(t('metrics.templates.invalidJson'));
        return;
      }
    }

    if (!templateName.trim()) {
      setError(t('metrics.templates.templateNameRequired'));
      return;
    }
    if (Object.keys(selectedMetricsConfig).length === 0) {
      setError(t('metrics.templates.atLeastOneMetric'));
      return;
    }

    try {
      const metricsConfig = Object.entries(selectedMetricsConfig).map(([idStr, parameters]) => {
        const id = parseInt(idStr, 10);
        const metric = allMetrics.find((m) => m.id === id);
        return {
          metric_id: metric!.id,
          name: metric!.name,
          category: metric!.category,
          enabled: true,
          parameters: parameters || {},
        };
      });

      const payload = {
        name: templateName,
        description: templateDescription,
        metrics: metricsConfig,
      };

      if (editingTemplate?.id) {
        await metricsAPI.updateMetricTemplate(editingTemplate.id, payload);
        setSuccess(t('metrics.templates.templateUpdated'));
      } else {
        await metricsAPI.createMetricTemplate(payload);
        setSuccess(t('metrics.templates.templateCreated'));
      }

      handleCloseDialog();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || t('metrics.templates.saveError'));
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await metricsAPI.deleteMetricTemplate(templateToDelete.id);
      setSuccess(t('metrics.templates.templateDeleted'));
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || t('metrics.templates.deleteError'));
    }
  };

  const handleDuplicateTemplate = (template: MetricTemplate) => {
    setEditingTemplate(null);
    setTemplateName(`${template.name} (copia)`);
    setTemplateDescription(template.description || '');
    const metricConfigs: Record<number, any> = {};
    template.metrics?.forEach((m: any) => {
      const id = m.id ?? m.metric_id;
      if (id) {
        metricConfigs[id] = m.parameters || {};
      }
    });
    setSelectedMetricsConfig(metricConfigs);
    setDialogOpen(true);
  };

  // ── Edit dialog visual ↔ JSON toggle ────────────────────────────────────────

  const buildTemplateJson = () => {
    const metrics = Object.entries(selectedMetricsConfig).map(([idStr, parameters]) => {
      const metric = allMetrics.find((m) => m.id === parseInt(idStr, 10));
      return { name: metric?.name || '', parameters };
    });
    return JSON.stringify({ name: templateName, description: templateDescription, metrics }, null, 2);
  };

  const handleDialogModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'visual' | 'json' | null) => {
    if (!newMode || newMode === dialogViewMode) return;

    if (newMode === 'json') {
      setDialogEditJson(buildTemplateJson());
      setDialogEditJsonValid(true);
      setDialogEditJsonError(null);
      setDialogViewMode('json');
    } else {
      // Try to apply JSON before switching back to visual
      const text = dialogEditEditorRef.current?.getValue() ?? dialogEditJson;
      try {
        const data = JSON.parse(text);
        if (data.name !== undefined) setTemplateName(data.name);
        if (data.description !== undefined) setTemplateDescription(data.description);
        if (Array.isArray(data.metrics)) {
          const configs: Record<number, any> = {};
          data.metrics.forEach((m: any) => {
            const match = allMetrics.find((am) => am.name === m.name);
            if (match) configs[match.id] = m.parameters || {};
          });
          setSelectedMetricsConfig(configs);
        }
        setDialogEditJsonError(null);
        setDialogViewMode('visual');
      } catch {
        setDialogEditJsonError(t('metrics.templates.jsonVisualError'));
      }
    }
  };

  const handleDialogEditJsonChange = useCallback((value: string | undefined) => {
    const text = value ?? '';
    setDialogEditJson(text);
    if (text.trim() === '') { setDialogEditJsonValid(false); setDialogEditJsonError(null); return; }
    try {
      JSON.parse(text);
      setDialogEditJsonValid(true);
      setDialogEditJsonError(null);
    } catch (e: any) {
      setDialogEditJsonValid(false);
      setDialogEditJsonError(e.message || t('metrics.templates.invalidJson'));
    }
  }, []);

  // ── JSON dialog helpers ──────────────────────────────────────────────────────

  const openJsonDialog = (initialJson: string) => {
    setJsonDialogText(initialJson);
    setJsonDialogValid(true);
    setJsonDialogError(null);
    setJsonCopied(false);
    setJsonDialogOpen(true);
  };

  const handleExportTemplate = (template: MetricTemplate) => {
    const exportData = {
      name: template.name,
      description: template.description || '',
      metrics: template.metrics?.map((m: any) => ({
        name: m.name,
        category: m.category,
        parameters: m.parameters || {},
      })) || [],
    };
    openJsonDialog(JSON.stringify(exportData, null, 2));
  };

  const handleOpenImportDialog = () => {
    openJsonDialog('');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        JSON.parse(text); // validate
        openJsonDialog(text);
      } catch {
        setError(t('metrics.templates.fileReadError'));
      }
    };
    reader.readAsText(file);
  };

  const handleJsonEditorChange = useCallback((value: string | undefined) => {
    const text = value ?? '';
    setJsonDialogText(text);
    if (text.trim() === '') {
      setJsonDialogValid(false);
      setJsonDialogError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setJsonDialogValid(false);
        setJsonDialogError(t('metrics.templates.jsonObjectError'));
        return;
      }
      setJsonDialogValid(true);
      setJsonDialogError(null);
    } catch (e: any) {
      setJsonDialogValid(false);
      setJsonDialogError(e.message || t('metrics.templates.invalidJson'));
    }
  }, []);

  const handleJsonFormat = () => {
    if (jsonEditorRef.current) {
      try {
        const current = jsonEditorRef.current.getValue();
        const formatted = JSON.stringify(JSON.parse(current), null, 2);
        jsonEditorRef.current.setValue(formatted);
      } catch { /* ignore */ }
    }
  };

  const handleJsonCopy = async () => {
    const text = jsonEditorRef.current?.getValue() ?? jsonDialogText;
    await navigator.clipboard.writeText(text);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 1500);
  };

  const handleJsonDownload = () => {
    const text = jsonEditorRef.current?.getValue() ?? jsonDialogText;
    let name = 'plantilla';
    try { name = JSON.parse(text).name || 'plantilla'; } catch { /* ignore */ }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJsonImport = () => {
    const text = jsonEditorRef.current?.getValue() ?? jsonDialogText;
    try {
      const data = JSON.parse(text);
      if (!data.name || !Array.isArray(data.metrics)) {
        setJsonDialogError(t('metrics.templates.jsonStructureError'));
        return;
      }

      const metricConfigs: Record<number, any> = {};
      const notFound: string[] = [];
      data.metrics.forEach((importedMetric: any) => {
        const match = allMetrics.find((m) => m.name === importedMetric.name);
        if (match) {
          metricConfigs[match.id] = importedMetric.parameters || match.parameters || {};
        } else {
          notFound.push(importedMetric.name);
        }
      });

      setJsonDialogOpen(false);
      setEditingTemplate(null);
      setTemplateName(data.name);
      setTemplateDescription(data.description || '');
      setSelectedMetricsConfig(metricConfigs);
      setDialogOpen(true);

      if (notFound.length > 0) {
        setError(t('metrics.templates.unrecognizedMetrics', { metrics: notFound.join(', ') }));
      }
    } catch {
      setJsonDialogError(t('metrics.templates.invalidJson'));
    }
  };

  if (loading) {
    return (
      <MainLayout>
        {/* @ts-ignore — TS2590: MUI Box type inference too complex when monaco types are in scope */}
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
              {t('metrics.templates.pageTitle')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {t('metrics.templates.pageSubtitle')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={handleOpenImportDialog}
              sx={{
                borderColor: GREEN,
                color: GREEN,
                '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0,179,126,0.04)' },
              }}
            >
              {t('metrics.templates.importJson')}
            </Button>
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
              {t('metrics.templates.newTemplate')}
            </Button>
          </Box>
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
              {t('metrics.templates.noTemplatesYet')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
              {t('metrics.templates.createFirstTemplate')}
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
              {t('metrics.templates.createTemplate')}
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
                onExport={handleExportTemplate}
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
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogViewMode === 'json' ? { height: '85vh', maxHeight: '85vh' } : {} }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>
              {editingTemplate ? t('metrics.templates.editTemplate') : t('metrics.templates.newTemplate')}
            </Typography>
            <ToggleButtonGroup
              value={dialogViewMode}
              exclusive
              onChange={handleDialogModeChange}
              size="small"
              sx={{
                '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', gap: 0.5 },
                '& .Mui-selected': { color: `${GREEN} !important`, borderColor: `${GREEN} !important`, bgcolor: 'rgba(0,179,126,0.06) !important' },
              }}
            >
              <ToggleButton value="visual">
                <TuneIcon sx={{ fontSize: 16 }} /> {t('metrics.templates.visual')}
              </ToggleButton>
              <ToggleButton value="json">
                <CodeIcon sx={{ fontSize: 16 }} /> JSON
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={dialogViewMode === 'json' ? { p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : {}}>

          {/* ── Visual mode ── */}
          {dialogViewMode === 'visual' && (
            <>
              <TextField
                fullWidth
                label={t('metrics.templates.templateName')}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                sx={{ mt: 2, mb: 2 }}
                required
              />
              <TextField
                fullWidth
                label={t('metrics.templates.templateDescriptionOptional')}
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 3 }}
              />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('metrics.templates.selectMetrics')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                {t('metrics.templates.metricCount', { count: Object.keys(selectedMetricsConfig).length })}
              </Typography>
            </>
          )}

          {/* ── JSON mode toolbar ── */}
          {dialogViewMode === 'json' && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, py: 0.75, bgcolor: '#FAFAFA', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mr: 1 }}>JSON</Typography>
                <Chip label={t('metrics.templates.completeTemplate')} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#E8F5E9', color: GREEN }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <Tooltip title={t('metrics.templates.formatJson')} arrow>
                  <IconButton size="small" onClick={() => {
                    if (dialogEditEditorRef.current) {
                      try {
                        const f = JSON.stringify(JSON.parse(dialogEditEditorRef.current.getValue()), null, 2);
                        dialogEditEditorRef.current.setValue(f);
                      } catch { /* ignore */ }
                    }
                  }}>
                    <FormatIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}

          {/* Scrollable visual metric cards */}
          {dialogViewMode === 'visual' && (
            <Box sx={{ maxHeight: '400px', overflowY: 'auto', pr: 1 }}>
            <Grid container spacing={1.5}>
              {allMetrics.map((metric) => {
                const isSelected = metric.id in selectedMetricsConfig;
                const meta = getMetricMeta(metric.name);
                return (
                  <Grid item xs={12} sm={6} key={metric.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: isSelected ? GREEN : '#E0E0E0',
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: isSelected ? 'rgba(0, 179, 126, 0.05)' : '#FAFAFA',
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': {
                          borderColor: GREEN,
                          boxShadow: `0 4px 12px rgba(0, 179, 126, 0.12)`,
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleToggleMetric(metric.id)}
                        sx={{ p: 1.5, pb: isSelected && metric.parameters && Object.keys(metric.parameters).length > 0 ? 0 : 1.5 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 0.5 }}>
                              {meta.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                              {metric.description || t('metrics.templates.noDescription')}
                            </Typography>
                            <Chip
                              label={meta.category}
                              size="small"
                              sx={{
                                backgroundColor: meta.bg,
                                color: meta.color,
                                fontWeight: 500,
                                fontSize: '0.65rem',
                                height: 18,
                              }}
                            />
                          </Box>
                          {isSelected && (
                            <CheckCircleIcon sx={{ color: GREEN, fontSize: 20 }} />
                          )}
                        </Box>
                      </CardActionArea>
                      {isSelected && metric.parameters && Object.keys(metric.parameters).length > 0 && (
                        <Box sx={{ px: 1.5, pb: 1, pt: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setCurrentMetricToConfig(metric);
                              setConfigDialogOpen(true);
                            }}
                            sx={{
                              borderColor: GREEN,
                              color: GREEN,
                              textTransform: 'none',
                              fontSize: '0.7rem',
                              py: 0.25,
                              '&:hover': {
                                backgroundColor: 'rgba(0, 179, 126, 0.04)',
                                borderColor: GREEN_HOVER,
                              }
                            }}
                          >
                            {t('metrics.templates.configure')}
                          </Button>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
            </Box>
          )}

          {/* ── JSON mode editor ── */}
          {dialogViewMode === 'json' && (
            <>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  language="json"
                  theme="vs"
                  value={dialogEditJson}
                  onChange={handleDialogEditJsonChange}
                  onMount={(editor) => { dialogEditEditorRef.current = editor; }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    folding: true,
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: true,
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </Box>
              {dialogEditJsonError && (
                <Alert severity="error" sx={{ borderRadius: 0, py: 0.25, px: 1.5, fontSize: '0.75rem', flexShrink: 0 }}>
                  {dialogEditJsonError}
                </Alert>
              )}
            </>
          )}

        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#666' }}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={dialogViewMode === 'json' && !dialogEditJsonValid}
            sx={{
              backgroundColor: GREEN,
              color: '#fff',
              '&:hover': { backgroundColor: GREEN_HOVER },
              '&.Mui-disabled': { bgcolor: '#E0E0E0' },
            }}
          >
            {editingTemplate ? t('metrics.templates.saveChanges') : t('metrics.templates.createTemplate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('metrics.templates.deleteTemplate')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('metrics.templates.deleteConfirm', { name: templateToDelete?.name })}
            {t('metrics.templates.deleteWarning')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#666' }}>
            {t('common.cancel')}
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
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* JSON View/Edit Dialog */}
      <Dialog
        open={jsonDialogOpen}
        onClose={() => setJsonDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, height: '80vh', maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, flexShrink: 0 }}>
          <Typography variant="h6" fontWeight={600}>{t('metrics.templates.viewEditJson')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!jsonDialogValid && jsonDialogText.trim() !== '' && (
              <Chip label={t('metrics.templates.invalidJson')} size="small" color="error" variant="outlined" sx={{ height: 24, fontSize: '0.7rem' }} />
            )}
            <IconButton size="small" onClick={() => setJsonDialogOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        <Divider />

        {/* Toolbar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 0.75, bgcolor: '#FAFAFA', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mr: 1 }}>{t('metrics.templates.json')}</Typography>
            <Chip label={t('metrics.templates.completeTemplate')} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#E8F5E9', color: GREEN }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title={t('metrics.templates.formatJson')} arrow>
              <IconButton size="small" onClick={handleJsonFormat}>
                <FormatIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={jsonCopied ? t('jsonEditor.copied') : t('jsonEditor.copyToClipboard')} arrow>
              <IconButton size="small" onClick={handleJsonCopy}>
                {jsonCopied ? <CheckIcon fontSize="small" sx={{ color: GREEN }} /> : <CopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Schema hint */}
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F5F5F5', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {t('metrics.templates.structureHint')}
          </Typography>
        </Box>

        {/* Monaco Editor */}
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language="json"
              theme="vs"
              value={jsonDialogText}
              onChange={handleJsonEditorChange}
              onMount={(editor) => { jsonEditorRef.current = editor; }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                folding: true,
                bracketPairColorization: { enabled: true },
                formatOnPaste: true,
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                padding: { top: 8, bottom: 8 },
              }}
            />
          </Box>
          {jsonDialogError && (
            <Alert severity="error" sx={{ borderRadius: 0, py: 0.25, px: 1.5, fontSize: '0.75rem', flexShrink: 0 }}>
              {jsonDialogError}
            </Alert>
          )}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, flexShrink: 0, gap: 1 }}>
          {/* Load from file hidden input */}
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderColor: '#CCC', color: '#555', mr: 'auto', '&:hover': { borderColor: '#999' } }}
          >
            {t('metrics.templates.loadFile')}
          </Button>
          <Button onClick={() => setJsonDialogOpen(false)} color="inherit">{t('common.close')}</Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleJsonDownload}
            disabled={!jsonDialogValid || jsonDialogText.trim() === ''}
            sx={{ borderColor: GREEN, color: GREEN, '&:hover': { borderColor: GREEN_HOVER } }}
          >
            {t('metrics.templates.downloadJson')}
          </Button>
          <Button
            variant="contained"
            onClick={handleJsonImport}
            disabled={!jsonDialogValid || jsonDialogText.trim() === ''}
            sx={{ bgcolor: GREEN, color: '#fff', '&:hover': { bgcolor: GREEN_HOVER }, '&.Mui-disabled': { bgcolor: '#E0E0E0' } }}
          >
            {t('metrics.templates.importAsNewTemplate')}
          </Button>
        </DialogActions>
      </Dialog>

      <SmartMetricConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        metric={
          currentMetricToConfig
            ? {
                ...currentMetricToConfig,
                parameters: selectedMetricsConfig[currentMetricToConfig.id]
                  ?? currentMetricToConfig.parameters,
              }
            : null
        }
        onSave={(updatedMetric) => {
          setSelectedMetricsConfig((prev) => ({
            ...prev,
            [updatedMetric.id]: updatedMetric.parameters,
          }));
          setConfigDialogOpen(false);
        }}
      />
    </MainLayout>
  );
};

export default TemplatesSettings;
