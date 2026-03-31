import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Assessment as AssessmentIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { QualityScoreGauge, MetricCard, ColumnMetricsTable, IssuesSummary, MetricDetailsTabs } from '../../components/evaluations';
import { evaluationsAPI, datasetsAPI } from '../../services/api';
import { Evaluation, Issue, Dataset } from '../../types';

const EvaluationDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const evaluationId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchEvaluationData = async () => {
      if (evaluationId === undefined || isNaN(evaluationId)) {
        setLoading(false);
        setError('ID de evaluación inválido.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch evaluation details
        const evalResponse = await evaluationsAPI.getEvaluation(evaluationId);
        const evalData = evalResponse.data?.data?.evaluation || evalResponse.data;
        setEvaluation(evalData);

        // Fetch dataset details
        if (evalData?.dataset_id) {
          try {
            const datasetResponse = await datasetsAPI.getDataset(evalData.dataset_id);
            const datasetData = datasetResponse.data?.data || datasetResponse.data;
            setDataset(datasetData);
          } catch (datasetError) {
            console.warn('Error fetching dataset:', datasetError);
          }
        }

        // Fetch issues
        if (evalData?.status === 'completed') {
          try {
            const issuesResponse = await evaluationsAPI.getIssues(evaluationId);
            const issuesData = issuesResponse.data?.data?.issues || issuesResponse.data?.issues || issuesResponse.data || [];
            setIssues(Array.isArray(issuesData) ? issuesData : []);
          } catch (issuesError) {
            console.warn('Error fetching issues:', issuesError);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching evaluation:', err);
        setError(err.response?.data?.message || 'Error al cargar la evaluación.');
        setLoading(false);
      }
    };

    if (router.isReady && evaluationId !== undefined) {
      fetchEvaluationData();
    }
  }, [evaluationId, router.isReady]);

  const handleRefresh = async () => {
    if (!evaluationId) return;
    
    setLoading(true);
    try {
      const evalResponse = await evaluationsAPI.getEvaluation(evaluationId);
      const evalData = evalResponse.data?.data?.evaluation || evalResponse.data;
      setEvaluation(evalData);

      if (evalData?.status === 'completed') {
        const issuesResponse = await evaluationsAPI.getIssues(evaluationId);
        const issuesData = issuesResponse.data?.data?.issues || issuesResponse.data?.issues || issuesResponse.data || [];
        setIssues(Array.isArray(issuesData) ? issuesData : []);
      }
    } catch (err: any) {
      setError('Error al actualizar la evaluación.');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!evaluation) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar esta evaluación?')) return;
    
    setDeleteLoading(true);
    try {
      await evaluationsAPI.deleteEvaluation(evaluation.id);
      router.push(`/datasets/${evaluation.dataset_id}`);
    } catch (err: any) {
      setError('Error al eliminar la evaluación.');
      setDeleteLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    const config: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
      completed: {
        color: '#00B37E',
        bgColor: 'rgba(0, 179, 126, 0.1)',
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
      },
      failed: {
        color: '#E5484D',
        bgColor: 'rgba(229, 72, 77, 0.1)',
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
      },
      processing: {
        color: '#FFB800',
        bgColor: 'rgba(255, 184, 0, 0.1)',
        icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />,
      },
      pending: {
        color: '#888888',
        bgColor: 'rgba(136, 136, 136, 0.1)',
        icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />,
      },
    };

    const statusConfig = config[status] || config.pending;

    return (
      <Chip
        icon={statusConfig.icon as React.ReactElement}
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        sx={{
          backgroundColor: statusConfig.bgColor,
          color: statusConfig.color,
          fontWeight: 500,
          '& .MuiChip-icon': {
            color: statusConfig.color,
          },
        }}
      />
    );
  };

  const filteredIssues = selectedSeverity
    ? issues.filter((issue) => issue.severity === selectedSeverity)
    : issues;

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error || !evaluation) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Evaluation Not Found
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Evaluación no encontrada'}</Alert>
          <Button variant="contained" onClick={() => router.push('/datasets')} sx={{ mt: 3 }}>
            Back to Datasets
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const results = evaluation.results;
  const overallMetrics: Record<string, any> = results?.overall || {};
  const columnMetrics: Record<string, any> = results?.column_metrics || {};

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/datasets/${evaluation.dataset_id}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {dataset?.name || 'Evaluación'}
              </Typography>
              {getStatusChip(evaluation.status)}
            </Box>
            <Typography variant="body2" sx={{ color: '#555555', mt: 0.5 }}>
              Dataset: {dataset?.name || `ID ${evaluation.dataset_id}`} | 
              Created: {new Date(evaluation.created_at).toLocaleString()}
              {evaluation.completed_at && ` | Completed: ${new Date(evaluation.completed_at).toLocaleString()}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={deleteLoading}
              sx={{
                borderColor: '#E5484D',
                color: '#E5484D',
                '&:hover': {
                  borderColor: '#D03E43',
                  backgroundColor: 'rgba(229, 72, 77, 0.04)',
                },
              }}
            >
              {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
            </Button>
          </Box>
        </Box>

        {/* Processing state */}
        {(evaluation.status === 'processing' || evaluation.status === 'pending') && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #EEEEEE', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="h6">Evaluation in Progress</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#555555', mb: 2 }}>
              {evaluation.current_step || 'Processing...'}
            </Typography>
            {evaluation.progress !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#EEEEEE',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${evaluation.progress}%`,
                        backgroundColor: '#00B37E',
                        borderRadius: 4,
                        transition: 'width 0.3s ease-in-out',
                      }}
                    />
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {evaluation.progress}%
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Failed state */}
        {evaluation.status === 'failed' && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Evaluation Failed
            </Typography>
            <Typography variant="body2">
              {evaluation.error || 'An unknown error occurred during the evaluation.'}
            </Typography>
          </Alert>
        )}

        {/* Completed state - Results */}
        {evaluation.status === 'completed' && (
          <>
            {/* Quality Score and Metrics Summary */}
            <Grid id="executive-summary" container spacing={3} sx={{ mb: 4, scrollMarginTop: '120px' }}>
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: '1px solid #EEEEEE',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <QualityScoreGauge
                    score={evaluation.quality_score || overallMetrics.quality_score || 0}
                    size="large"
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    Resumen de métricas
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Completeness Executive Card */}
                    {overallMetrics.completeness !== undefined && (() => {
                      const value = overallMetrics.completeness;
                      const percentage = (value * 100).toFixed(1);
                      const nullColumns = Object.values(columnMetrics).filter((col: any) => (col.n_nulls || 0) > 0).length;
                      const totalColumns = Object.keys(columnMetrics).length;
                      
                      const badge = value >= 0.98 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : value >= 0.90 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };
                      
                      const insight = nullColumns > 0 
                        ? `${nullColumns} de ${totalColumns} columnas tienen valores nulos`
                        : 'Todas las columnas están completas';
                      
                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => {
                              const el = document.getElementById('metric-details');
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            sx={{
                              p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer',
                              transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                              height: '100%',
                            }}
                          >
                            {/* Header con badge */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>
                                Completitud
                              </Typography>
                              <Chip 
                                label={badge.label}
                                size="small"
                                sx={{ 
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  fontWeight: 500,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            </Box>
                            
                            {/* Valor principal */}
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>
                              {percentage}%
                            </Typography>
                            
                            {/* Hallazgo clave */}
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>
                              {insight}
                            </Typography>
                            
                            {/* CTA */}
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>
                              Ver detalle →
                            </Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Uniqueness Executive Card */}
                    {overallMetrics.uniqueness !== undefined && (() => {
                      const value = overallMetrics.uniqueness;
                      const percentage = (value * 100).toFixed(1);
                      const totalRows = Object.values(columnMetrics).length > 0 
                        ? (columnMetrics[Object.keys(columnMetrics)[0]]?.n_nulls || 0) + (columnMetrics[Object.keys(columnMetrics)[0]]?.n_non_nulls || 0)
                        : 0;
                      const duplicateRows = totalRows > 0 ? Math.round((1 - value) * totalRows) : 0;
                      
                      const badge = duplicateRows === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : duplicateRows <= 2 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };
                      
                      const insight = duplicateRows > 0
                        ? `${duplicateRows} fila${duplicateRows !== 1 ? 's' : ''} completamente duplicada${duplicateRows !== 1 ? 's' : ''}`
                        : 'Sin filas duplicadas detectadas';
                      
                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => {
                              const el = document.getElementById('metric-details');
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            sx={{
                              p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer',
                              transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                              height: '100%',
                            }}
                          >
                            {/* Header con badge */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>
                                Unicidad
                              </Typography>
                              <Chip 
                                label={badge.label}
                                size="small"
                                sx={{ 
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  fontWeight: 500,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            </Box>
                            
                            {/* Valor principal */}
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>
                              {percentage}%
                            </Typography>
                            
                            {/* Hallazgo clave */}
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>
                              {insight}
                            </Typography>
                            
                            {/* CTA */}
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>
                              Ver detalle →
                            </Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Syntactic Accuracy Executive Card */}
                    {overallMetrics.syntactic_accuracy && (() => {
                      const sa = overallMetrics.syntactic_accuracy;
                      const value = sa.overall_conformance ?? 0;
                      const percentage = (value * 100).toFixed(1);

                      const badge = value >= 0.95 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : value >= 0.80 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

                      const insight = sa.columns_checked
                        ? `${sa.columns_checked} columna${sa.columns_checked !== 1 ? 's' : ''} analizadas`
                        : 'Sin columnas analizadas';

                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => { document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, height: '100%' }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>Exactitud sintáctica</Typography>
                              <Chip label={badge.label} size="small" sx={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.7rem', height: 20 }} />
                            </Box>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>{percentage}%</Typography>
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>{insight}</Typography>
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>Ver detalle →</Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Logical Consistency Executive Card */}
                    {overallMetrics.logical_consistency && overallMetrics.logical_consistency.rules && (() => {
                      const lc = overallMetrics.logical_consistency;
                      const value = lc.overall_compliance ?? 0;
                      const percentage = (value * 100).toFixed(1);
                      const withViolations = lc.rules_with_violations ?? 0;
                      const total = lc.rules_evaluated ?? (lc.rules?.length ?? 0);

                      const badge = withViolations === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : withViolations <= 1  ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

                      const insight = withViolations === 0
                        ? `${total} regla${total !== 1 ? 's' : ''} sin violaciones`
                        : `${withViolations} de ${total} regla${total !== 1 ? 's' : ''} con violaciones`;

                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => { document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, height: '100%' }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>Consistencia lógica</Typography>
                              <Chip label={badge.label} size="small" sx={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.7rem', height: 20 }} />
                            </Box>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>{percentage}%</Typography>
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>{insight}</Typography>
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>Ver detalle →</Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Class Balance Executive Card */}
                    {overallMetrics.class_balance && (() => {
                      const cb = overallMetrics.class_balance;
                      const value = cb.overall_balance_index ?? 0;
                      const display = value.toFixed(1);
                      const alerts = cb.columns_with_alerts ?? 0;

                      const badge = value >= 80 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : value >= 60 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

                      const insight = alerts === 0
                        ? 'Sin desequilibrios detectados'
                        : `${alerts} columna${alerts !== 1 ? 's' : ''} con desequilibrio`;

                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => { document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, height: '100%' }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>Equilibrio de clases</Typography>
                              <Chip label={badge.label} size="small" sx={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.7rem', height: 20 }} />
                            </Box>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>{display}%</Typography>
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>{insight}</Typography>
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>Ver detalle →</Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Timeliness Executive Card */}
                    {overallMetrics.timeliness && (() => {
                      const tl = overallMetrics.timeliness;
                      const value = tl.overall_freshness_score ?? 0;
                      const percentage = (value * 100).toFixed(1);
                      const stale = tl.columns_stale ?? 0;
                      const analyzed = tl.columns_analyzed ?? 0;

                      const badge = value >= 0.90 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : value >= 0.70 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

                      const insight = stale === 0
                        ? `${analyzed} columna${analyzed !== 1 ? 's' : ''} actualizadas`
                        : `${stale} de ${analyzed} columna${analyzed !== 1 ? 's' : ''} desactualizadas`;

                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => { document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, height: '100%' }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>Actualidad</Typography>
                              <Chip label={badge.label} size="small" sx={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.7rem', height: 20 }} />
                            </Box>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>{percentage}%</Typography>
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>{insight}</Typography>
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>Ver detalle →</Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}

                    {/* Outliers Executive Card */}
                    {overallMetrics.outliers && (() => {
                      const totalOutliers = Object.values(overallMetrics.outliers).reduce(
                        (sum: number, col: any) => sum + (col?.count || 0), 0
                      );
                      const totalValues = Object.values(overallMetrics.outliers).reduce(
                        (sum: number, col: any) => sum + (col?.total_values || 0), 0
                      );
                      const overallProportion = totalValues > 0 ? totalOutliers / totalValues : 0;
                      const columnsAffected = Object.entries(overallMetrics.outliers).filter(([_, col]: [string, any]) => col?.count > 0).length;
                      
                      const badge = overallProportion >= 0.05 ? { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' }
                                  : overallProportion >= 0.02 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                                  : totalOutliers === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                                  : { label: 'Aceptable', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' };
                      
                      const mostAffectedCol = Object.entries(overallMetrics.outliers)
                        .filter(([_, col]: [string, any]) => col?.count > 0)
                        .sort(([_, a]: [string, any], [__, b]: [string, any]) => (b?.count || 0) - (a?.count || 0))[0];
                      
                      const insight = totalOutliers === 0
                        ? 'Sin valores atípicos detectados'
                        : columnsAffected === 1 && mostAffectedCol
                        ? `${columnsAffected} columna afectada (${mostAffectedCol[0]}, ${(overallProportion * 100).toFixed(1)}%)`
                        : `${columnsAffected} columnas afectadas (${(overallProportion * 100).toFixed(1)}% del total)`;
                      
                      return (
                        <Grid item xs={12} sm={4}>
                          <Paper
                            elevation={0}
                            onClick={() => {
                              const el = document.getElementById('metric-details');
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            sx={{
                              p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer',
                              transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                              height: '100%',
                            }}
                          >
                            {/* Header con badge */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>
                                Outliers
                              </Typography>
                              <Chip 
                                label={badge.label}
                                size="small"
                                sx={{ 
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  fontWeight: 500,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            </Box>
                            
                            {/* Valor principal */}
                            <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>
                              {totalOutliers}
                            </Typography>
                            
                            {/* Hallazgo clave */}
                            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>
                              {insight}
                            </Typography>
                            
                            {/* CTA */}
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>
                              Ver detalle →
                            </Typography>
                          </Paper>
                        </Grid>
                      );
                    })()}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>

            {/* Priority Issues Section - Collapsible */}
            <Accordion
              id="priority-issues"
              elevation={0}
              defaultExpanded={true}
              sx={{
                mb: 4,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
                scrollMarginTop: '80px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon sx={{ color: '#888', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Issues Detected ({issues.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
              {issues.length > 0 ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <IssuesSummary
                      issues={issues}
                      onFilterChange={(severity) => setSelectedSeverity(severity)}
                      selectedSeverity={selectedSeverity}
                    />
                  </Box>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Severidad</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Métrica</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Descripción</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Columnas Afectadas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredIssues.map((issue) => {
                          const getSeverityLabel = (severity: string): string => {
                            if (severity === 'critical') return 'Crítica';
                            if (severity === 'high') return 'Alta';
                            if (severity === 'medium') return 'Media';
                            if (severity === 'low') return 'Baja';
                            return severity;
                          };

                          const getMetricName = (desc: string): string => {
                            const lower = desc.toLowerCase();
                            if (lower.includes('completeness') || lower.includes('completitud') || lower.includes('null') || lower.includes('missing')) return 'Completitud';
                            if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('unicidad') || lower.includes('duplicad')) return 'Unicidad';
                            if (lower.includes('outlier') || lower.includes('atípico')) return 'Outliers';
                            if (lower.includes('variability') || lower.includes('variabilidad')) return 'Unicidad';
                            if (lower.includes('syntactic') || lower.includes('format') || lower.includes('conforman')) return 'Exactitud sintáctica';
                            if (lower.includes('balance') || lower.includes('class') || lower.includes('categor') || lower.includes('desequilibr')) return 'Equilibrio de clases';
                            if (lower.includes('timeliness') || lower.includes('stale') || lower.includes('freshness') || lower.includes('desactualiz') || lower.includes('antiguo')) return 'Actualidad';
                            if (lower.includes('logical') || lower.includes('consistencia') || lower.includes('violation') || lower.includes('rule') || lower.includes('regla')) return 'Consistencia lógica';
                            return 'General';
                          };

                          return (
                            <TableRow key={issue.id} hover>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={getSeverityLabel(issue.severity)}
                                  sx={{
                                    backgroundColor:
                                      issue.severity === 'critical'
                                        ? 'rgba(139, 0, 0, 0.1)'
                                        : issue.severity === 'high'
                                        ? 'rgba(229, 72, 77, 0.1)'
                                        : issue.severity === 'medium'
                                        ? 'rgba(255, 184, 0, 0.1)'
                                        : 'rgba(0, 179, 126, 0.1)',
                                    color:
                                      issue.severity === 'critical'
                                        ? '#8B0000'
                                        : issue.severity === 'high'
                                        ? '#E5484D'
                                        : issue.severity === 'medium'
                                        ? '#FFB800'
                                        : '#00B37E',
                                    fontWeight: 500,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontWeight: 500, color: '#555' }}>
                                  {getMetricName(issue.description)}
                                </Typography>
                              </TableCell>
                              <TableCell>{issue.description}</TableCell>
                              <TableCell>
                                {issue.affected_columns && issue.affected_columns.length > 0
                                  ? issue.affected_columns.map((col: any) => {
                                      if (typeof col === 'string') return col;
                                      if (col.column) return col.column;
                                      if (col.name) return col.name;
                                      return JSON.stringify(col);
                                    }).join(', ')
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #CCCCCC', borderRadius: 2 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: '#00B37E', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: '#555555' }}>
                    No se detectaron problemas. ¡La calidad de tus datos es excelente!
                  </Typography>
                </Box>
              )}
              </AccordionDetails>
            </Accordion>

            {/* Metric Details - Collapsible Tabs */}
            <Accordion
              id="metric-details"
              elevation={0}
              defaultExpanded={true}
              sx={{
                mb: 4,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
                scrollMarginTop: '80px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon sx={{ color: '#888', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Detalles de métricas
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <MetricDetailsTabs
                  overallMetrics={overallMetrics}
                  columnMetrics={columnMetrics}
                />
              </AccordionDetails>
            </Accordion>

            {/* Column Metrics Section - Hidden temporarily */}
            {false && Object.keys(columnMetrics).length > 0 && (
              <Paper id="column-metrics" elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #EEEEEE', borderRadius: 2, scrollMarginTop: '80px' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Métricas por Columna ({Object.keys(columnMetrics).length} columnas)
                </Typography>
                <ColumnMetricsTable columnMetrics={columnMetrics} />
              </Paper>
            )}

            {/* Score Calculation - Collapsed by default */}
            {overallMetrics.score_breakdown && (
              <Accordion 
                elevation={0} 
                defaultExpanded={false}
                sx={{ 
                  mb: 4, 
                  border: '1px solid #E0E0E0', 
                  borderRadius: '8px !important', 
                  backgroundColor: '#FFFFFF',
                  '&:before': { display: 'none' },
                  scrollMarginTop: '80px',
                }}
                id="score-calculation"
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#888', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Cálculo de puntuación
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Typography variant="body2" sx={{ color: '#555555', mb: 3 }}>
                  El Quality Score se calcula promediando los scores de cada métrica evaluada y restando una penalización proporcional al número y severidad de los issues detectados.
                </Typography>

                {/* Step 1: Metric Scores */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#333' }}>
                    1. Puntuaciones por métrica
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {Object.entries(overallMetrics.score_breakdown.metric_scores || {}).map(([metric, score]: [string, any]) => {
                      const pct = (score * 100).toFixed(1);
                      const color = score >= 0.8 ? '#00B37E' : score >= 0.6 ? '#FFB800' : '#E5484D';
                      return (
                        <Paper key={metric} elevation={0} sx={{ px: 2, py: 1.5, border: '1px solid #EEEEEE', borderRadius: 2, minWidth: 140, backgroundColor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#888', textTransform: 'capitalize' }}>
                            {metric}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                            {pct}%
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1, color: '#888' }}>
                    Puntuación base (promedio) = <strong>{(overallMetrics.score_breakdown.base_score * 100).toFixed(1)}%</strong>
                  </Typography>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 2: Issue Penalty */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#333' }}>
                    2. Penalización por issues
                  </Typography>
                  {(() => {
                    const pd = overallMetrics.score_breakdown.penalty_detail || {};
                    const totalPenalty = overallMetrics.score_breakdown.issue_penalty || 0;
                    return (
                      <Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                          {pd.high_issues > 0 && (
                            <Chip
                              size="small"
                              label={`${pd.high_issues} high × ${(pd.high_weight * 100).toFixed(0)}% = −${(pd.high_issues * pd.high_weight * 100).toFixed(1)}%`}
                              sx={{ backgroundColor: 'rgba(229, 72, 77, 0.1)', color: '#E5484D', fontWeight: 500 }}
                            />
                          )}
                          {pd.medium_issues > 0 && (
                            <Chip
                              size="small"
                              label={`${pd.medium_issues} medium × ${(pd.medium_weight * 100).toFixed(1)}% = −${(pd.medium_issues * pd.medium_weight * 100).toFixed(1)}%`}
                              sx={{ backgroundColor: 'rgba(255, 184, 0, 0.1)', color: '#B8860B', fontWeight: 500 }}
                            />
                          )}
                          {pd.low_issues > 0 && (
                            <Chip
                              size="small"
                              label={`${pd.low_issues} low × ${(pd.low_weight * 100).toFixed(0)}% = −${(pd.low_issues * pd.low_weight * 100).toFixed(1)}%`}
                              sx={{ backgroundColor: 'rgba(0, 179, 126, 0.1)', color: '#00B37E', fontWeight: 500 }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#E5484D' }}>
                          Penalización total = <strong>−{(totalPenalty * 100).toFixed(1)}%</strong>
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 3: Final Calculation */}
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  backgroundColor: (overallMetrics.score_breakdown.final_score || 0) >= 0.8 ? 'rgba(0, 179, 126, 0.05)' : 
                                   (overallMetrics.score_breakdown.final_score || 0) >= 0.5 ? 'rgba(255, 184, 0, 0.05)' : 'rgba(229, 72, 77, 0.05)',
                  border: '1px solid',
                  borderColor: (overallMetrics.score_breakdown.final_score || 0) >= 0.8 ? 'rgba(0, 179, 126, 0.2)' : 
                               (overallMetrics.score_breakdown.final_score || 0) >= 0.5 ? 'rgba(255, 184, 0, 0.2)' : 'rgba(229, 72, 77, 0.2)',
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                    3. Puntuación final
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {(overallMetrics.score_breakdown.base_score * 100).toFixed(1)}% (base) − {(overallMetrics.score_breakdown.issue_penalty * 100).toFixed(1)}% (penalización) = {' '}
                    <Box component="span" sx={{ 
                      fontSize: '1.2rem',
                      color: (overallMetrics.score_breakdown.final_score || 0) >= 0.8 ? '#00B37E' : 
                             (overallMetrics.score_breakdown.final_score || 0) >= 0.5 ? '#FFB800' : '#E5484D',
                    }}>
                      {(overallMetrics.score_breakdown.final_score * 100).toFixed(1)}%
                    </Box>
                  </Typography>
                </Box>
                </AccordionDetails>
              </Accordion>
            )}

          </>
        )}
      </Box>
    </MainLayout>
  );
};

export default EvaluationDetail;
