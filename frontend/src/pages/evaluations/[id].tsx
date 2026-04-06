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
  LinearProgress,
  Collapse,
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
  Speed as SpeedIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { QualityScoreGauge, MetricCard, ColumnMetricsTable, IssuesSummary, MetricDetailsTabs, ExecutiveMetricCard } from '../../components/evaluations';
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
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [scoreExpanded, setScoreExpanded] = useState(true);

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

  const getMetricName = (issue: { issue_type?: string; description: string }): string => {
    const type = issue.issue_type || '';
    if (type === 'completeness') return 'Completitud';
    if (type === 'low_variability' || type === 'non_unique_identifier' || type === 'duplicate_rows') return 'Unicidad';
    if (type === 'outliers') return 'Outliers';
    if (type === 'syntactic_accuracy') return 'Exactitud sintáctica';
    if (type === 'class_balance') return 'Equilibrio de clases';
    if (type === 'timeliness') return 'Actualidad';
    if (type === 'logical_consistency') return 'Consistencia lógica';
    const lower = (issue.description || '').toLowerCase();
    if (lower.includes('completitud') || lower.includes('completeness') || lower.includes('null') || lower.includes('nulo')) return 'Completitud';
    if (lower.includes('unicidad') || lower.includes('unique') || lower.includes('duplicad') || lower.includes('variabilidad')) return 'Unicidad';
    if (lower.includes('atípico') || lower.includes('outlier')) return 'Outliers';
    if (lower.includes('tipo esperado') || lower.includes('conformidad') || lower.includes('sintáct') || lower.includes('syntactic')) return 'Exactitud sintáctica';
    if (lower.includes('clase') || lower.includes('desequilibr') || lower.includes('balance') || lower.includes('minoritaria')) return 'Equilibrio de clases';
    if (lower.includes('desactualiz') || lower.includes('timeliness') || lower.includes('obsolet') || lower.includes('frescura')) return 'Actualidad';
    if (lower.includes('regla') || lower.includes('consistencia') || lower.includes('violó') || lower.includes('logical')) return 'Consistencia lógica';
    return 'General';
  };

  const filteredIssues = issues.filter((issue: Issue) => {
    const matchesSeverity = selectedSeverity ? issue.severity === selectedSeverity : true;
    const matchesMetric = selectedMetric ? getMetricName(issue) === selectedMetric : true;
    return matchesSeverity && matchesMetric;
  });

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
            {/* Quality Score and Metrics Summary — Unified Grid */}
            {(() => {
              // Build metric cards data and compute tab indices for click-to-tab navigation
              const metricCards: Array<{ title: string; value: string; badge: { label: string; bg: string; color: string }; insight: string; tabKey: string }> = [];

              if (overallMetrics.completeness !== undefined) {
                const v = overallMetrics.completeness;
                const nullCols = Object.values(columnMetrics).filter((col: any) => (col.n_nulls || 0) > 0).length;
                const totalCols = Object.keys(columnMetrics).length;
                metricCards.push({
                  title: 'Completitud',
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: v >= 0.98 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : v >= 0.90 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: nullCols > 0 ? `${nullCols} de ${totalCols} columnas tienen valores nulos` : 'Todas las columnas están completas',
                  tabKey: 'completeness',
                });
              }

              if (overallMetrics.uniqueness !== undefined) {
                const v = overallMetrics.uniqueness;
                const totalRows = Object.values(columnMetrics).length > 0
                  ? (columnMetrics[Object.keys(columnMetrics)[0]]?.n_nulls || 0) + (columnMetrics[Object.keys(columnMetrics)[0]]?.n_non_nulls || 0)
                  : 0;
                const dupes = totalRows > 0 ? Math.round((1 - v) * totalRows) : 0;
                metricCards.push({
                  title: 'Unicidad',
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: dupes === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : dupes <= 2 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: dupes > 0 ? `${dupes} fila${dupes !== 1 ? 's' : ''} completamente duplicada${dupes !== 1 ? 's' : ''}` : 'Sin filas duplicadas detectadas',
                  tabKey: 'uniqueness',
                });
              }

              if (overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0) {
                const totalOut = Object.values(overallMetrics.outliers).reduce((s: number, c: any) => s + (c?.count || 0), 0);
                const totalVals = Object.values(overallMetrics.outliers).reduce((s: number, c: any) => s + (c?.total_values || 0), 0);
                const prop = totalVals > 0 ? totalOut / totalVals : 0;
                const colsAffected = Object.entries(overallMetrics.outliers).filter(([_, c]: [string, any]) => c?.count > 0).length;
                const mostAffected = Object.entries(overallMetrics.outliers)
                  .filter(([_, c]: [string, any]) => c?.count > 0)
                  .sort(([_, a]: [string, any], [__, b]: [string, any]) => (b?.count || 0) - (a?.count || 0))[0];
                metricCards.push({
                  title: 'Outliers',
                  value: `${totalOut}`,
                  badge: prop >= 0.05 ? { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' }
                       : prop >= 0.02 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : totalOut === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : { label: 'Aceptable', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' },
                  insight: totalOut === 0 ? 'Sin valores atípicos detectados'
                         : colsAffected === 1 && mostAffected ? `${colsAffected} columna afectada (${mostAffected[0]}, ${(prop * 100).toFixed(1)}%)`
                         : `${colsAffected} columnas afectadas (${(prop * 100).toFixed(1)}% del total)`,
                  tabKey: 'outliers',
                });
              }

              if (overallMetrics.syntactic_accuracy?.columns) {
                const sa = overallMetrics.syntactic_accuracy;
                const v = sa.overall_conformance ?? 0;
                metricCards.push({
                  title: 'Exactitud sintáctica',
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: v >= 0.95 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : v >= 0.80 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: sa.columns_checked ? `${sa.columns_checked} columna${sa.columns_checked !== 1 ? 's' : ''} analizadas` : 'Sin columnas analizadas',
                  tabKey: 'syntactic_accuracy',
                });
              }

              if (overallMetrics.logical_consistency?.rules) {
                const lc = overallMetrics.logical_consistency;
                const v = lc.overall_compliance ?? 0;
                const withViol = lc.rules_with_violations ?? 0;
                const total = lc.rules_evaluated ?? (lc.rules?.length ?? 0);
                metricCards.push({
                  title: 'Consistencia lógica',
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: withViol === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : withViol <= 1 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: withViol === 0 ? `${total} regla${total !== 1 ? 's' : ''} sin violaciones` : `${withViol} de ${total} regla${total !== 1 ? 's' : ''} con violaciones`,
                  tabKey: 'logical_consistency',
                });
              }

              if (overallMetrics.class_balance?.columns) {
                const cb = overallMetrics.class_balance;
                const v = cb.overall_balance_index ?? 0;
                const alerts = cb.columns_with_alerts ?? 0;
                metricCards.push({
                  title: 'Equilibrio de clases',
                  value: `${v.toFixed(1)}%`,
                  badge: v >= 80 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : v >= 60 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: alerts === 0 ? 'Sin desequilibrios detectados' : `${alerts} columna${alerts !== 1 ? 's' : ''} con desequilibrio`,
                  tabKey: 'class_balance',
                });
              }

              if (overallMetrics.timeliness?.columns) {
                const tl = overallMetrics.timeliness;
                const v = tl.overall_freshness_score ?? 0;
                const stale = tl.columns_stale ?? 0;
                const analyzed = tl.columns_analyzed ?? 0;
                metricCards.push({
                  title: 'Actualidad',
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: v >= 0.90 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : v >= 0.70 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' },
                  insight: stale === 0 ? `${analyzed} columna${analyzed !== 1 ? 's' : ''} actualizadas` : `${stale} de ${analyzed} columna${analyzed !== 1 ? 's' : ''} desactualizadas`,
                  tabKey: 'timeliness',
                });
              }

              // Tab order in MetricDetailsTabs: completeness, uniqueness, outliers, syntactic_accuracy, logical_consistency, class_balance, timeliness
              const tabOrder = ['completeness', 'uniqueness', 'outliers', 'syntactic_accuracy', 'logical_consistency', 'class_balance', 'timeliness'];
              const availableTabs = tabOrder.filter(key => {
                if (key === 'completeness') return overallMetrics.completeness !== undefined;
                if (key === 'uniqueness') return overallMetrics.uniqueness !== undefined;
                if (key === 'outliers') return overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0;
                if (key === 'syntactic_accuracy') return overallMetrics.syntactic_accuracy?.columns;
                if (key === 'logical_consistency') return overallMetrics.logical_consistency?.rules;
                if (key === 'class_balance') return overallMetrics.class_balance?.columns;
                if (key === 'timeliness') return overallMetrics.timeliness?.columns;
                return false;
              });

              const scrollToTab = (tabKey: string) => {
                const idx = availableTabs.indexOf(tabKey);
                if (idx >= 0) setActiveDetailTab(idx);
                // Expand the accordion if collapsed, then scroll after DOM updates
                if (!detailsExpanded) {
                  setDetailsExpanded(true);
                  setTimeout(() => {
                    document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 300);
                } else {
                  document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              };

              const score = evaluation.quality_score || overallMetrics.quality_score || 0;
              const scoreColor = score >= 80 ? '#00B37E' : score >= 60 ? '#FFB800' : '#E5484D';
              const scoreColorBg = score >= 80 ? 'rgba(0, 179, 126, 0.1)' : score >= 60 ? 'rgba(255, 184, 0, 0.1)' : 'rgba(229, 72, 77, 0.1)';
              const scoreVerdict = score >= 90 ? 'Excelente' : score >= 80 ? 'Bueno' : score >= 60 ? 'Aceptable' : score >= 40 ? 'Deficiente' : 'Crítico';
              const metricsEvaluated = metricCards.length;
              const totalIssues = issues.length;

              const accordionSx = {
                mb: 3,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
              };

              return (
                <Box id="executive-summary" sx={{ scrollMarginTop: '120px' }}>
                  {/* ── Puntuación de calidad ── */}
                  <Paper elevation={0} sx={{ mb: 3, border: '1px solid #E0E0E0', borderRadius: 2, overflow: 'hidden' }}>
                    {/* Cabecera siempre visible */}
                    <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SpeedIcon sx={{ color: '#888', fontSize: 20 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Puntuación de calidad</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={scoreVerdict}
                          size="small"
                          sx={{ backgroundColor: scoreColorBg, color: scoreColor, fontWeight: 600, fontSize: '0.75rem' }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => setScoreExpanded(v => !v)}
                          sx={{ color: '#888' }}
                        >
                          <ExpandMoreIcon sx={{ transition: 'transform 0.2s', transform: scoreExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Cuerpo colapsable */}
                    <Collapse in={scoreExpanded}>
                      <Box sx={{ px: 3, pb: 3 }}>
                        {/* Score numérico */}
                        <Typography variant="h2" component="div" sx={{ fontWeight: 800, color: scoreColor, lineHeight: 1, mb: 2 }}>
                          {Math.round(score)}
                          <Typography component="span" variant="h5" sx={{ color: '#BBBBBB', fontWeight: 400, ml: 0.5 }}>/100</Typography>
                        </Typography>

                        {/* Barra de progreso */}
                        <LinearProgress
                          variant="determinate"
                          value={score}
                          sx={{
                            height: 10,
                            borderRadius: 5,
                            mb: 2.5,
                            backgroundColor: '#EEEEEE',
                            '& .MuiLinearProgress-bar': { borderRadius: 5, backgroundColor: scoreColor },
                          }}
                        />

                        {/* Stats */}
                        <Typography variant="body2" sx={{ color: '#888' }}>
                          {metricsEvaluated} métrica{metricsEvaluated !== 1 ? 's' : ''} evaluada{metricsEvaluated !== 1 ? 's' : ''}
                          {' · '}
                          <Box component="span" sx={{ color: totalIssues > 0 ? '#E5484D' : '#00B37E', fontWeight: 600 }}>
                            {totalIssues} issue{totalIssues !== 1 ? 's' : ''} detectado{totalIssues !== 1 ? 's' : ''}
                          </Box>
                        </Typography>
                      </Box>
                    </Collapse>
                  </Paper>

                  {/* ── Resumen de métricas ── */}
                  {metricCards.length > 0 && (
                    <Accordion elevation={0} defaultExpanded={true} sx={{ ...accordionSx, mb: 4 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <GridViewIcon sx={{ color: '#888', fontSize: 20 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Resumen de métricas
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 3, pb: 3 }}>
                        <Grid container spacing={2}>
                          {metricCards.map((card) => (
                            <ExecutiveMetricCard
                              key={card.tabKey}
                              title={card.title}
                              value={card.value}
                              badge={card.badge}
                              insight={card.insight}
                              onClickDetail={() => scrollToTab(card.tabKey)}
                            />
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              );
            })()}

            {/* Issues detectados - Collapsible */}
            <Accordion
              id="priority-issues"
              elevation={0}
              defaultExpanded={true}
              sx={{
                mb: 3,
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
                    Issues detectados ({issues.length})
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
                      onMetricFilterChange={(metric) => setSelectedMetric(metric)}
                      selectedMetric={selectedMetric}
                      getMetricName={getMetricName}
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
                                  {getMetricName(issue)}
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

            {/* Detalles de métricas - Collapsible Tabs */}
            <Accordion
              id="metric-details"
              elevation={0}
              expanded={detailsExpanded}
              onChange={(_, expanded) => setDetailsExpanded(expanded)}
              sx={{
                mb: 3,
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
                  initialTab={activeDetailTab}
                  datasetId={evaluation.dataset_id}
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

            {/* Cálculo de puntuación - Collapsed by default */}
            {overallMetrics.score_breakdown && (
              <Accordion
                elevation={0}
                defaultExpanded={false}
                sx={{
                  mb: 3,
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
                  El Quality Score es la media ponderada de los scores de cada métrica. Los issues no penalizan directamente el score — ya están reflejados en él — pero los issues críticos pueden bloquear el Quality Gate del proyecto.
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
                      const weight = overallMetrics.score_breakdown.metric_weights?.[metric];
                      return (
                        <Paper key={metric} elevation={0} sx={{ px: 2, py: 1.5, border: '1px solid #EEEEEE', borderRadius: 2, minWidth: 140, backgroundColor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#888', textTransform: 'capitalize' }}>
                            {metric}
                            {weight !== undefined && weight !== 1 && (
                              <Box component="span" sx={{ color: '#aaa', ml: 0.5 }}>×{weight}</Box>
                            )}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                            {pct}%
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1, color: '#888' }}>
                    Media ponderada = <strong>{(overallMetrics.score_breakdown.base_score * 100).toFixed(1)}%</strong>
                  </Typography>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 2: Issue Counts */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#333' }}>
                    2. Issues detectados
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
                    Los issues ya están incorporados en el score de cada métrica. Los issues críticos activan el Quality Gate si se supera el umbral configurado.
                  </Typography>
                  {(() => {
                    const ic = overallMetrics.score_breakdown.issue_counts || {};
                    const COLORS: Record<string, { bg: string; color: string }> = {
                      critical: { bg: 'rgba(139,0,0,0.1)', color: '#8B0000' },
                      high:     { bg: 'rgba(229,72,77,0.1)', color: '#E5484D' },
                      medium:   { bg: 'rgba(255,184,0,0.1)', color: '#B8860B' },
                      low:      { bg: 'rgba(0,179,126,0.1)', color: '#00B37E' },
                    };
                    const LABEL: Record<string, string> = { critical: 'Críticos', high: 'Altos', medium: 'Medios', low: 'Bajos' };
                    const order = ['critical', 'high', 'medium', 'low'];
                    const total = order.reduce((acc, s) => acc + (ic[s] || 0), 0);
                    return (
                      <Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
                          {order.map(sev => {
                            const cnt = ic[sev] || 0;
                            if (cnt === 0) return null;
                            const c = COLORS[sev];
                            return (
                              <Chip
                                key={sev}
                                size="small"
                                label={`${cnt} ${LABEL[sev]}`}
                                sx={{ backgroundColor: c.bg, color: c.color, fontWeight: 600 }}
                              />
                            );
                          })}
                          {total === 0 && (
                            <Typography variant="body2" sx={{ color: '#00B37E' }}>
                              Sin issues detectados
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })()}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 3: Final Score */}
                {(() => {
                  const finalScore = overallMetrics.score_breakdown.final_score ?? overallMetrics.score_breakdown.base_score ?? 0;
                  return (
                    <Box sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: finalScore >= 0.8 ? 'rgba(0, 179, 126, 0.05)' :
                                       finalScore >= 0.5 ? 'rgba(255, 184, 0, 0.05)' : 'rgba(229, 72, 77, 0.05)',
                      border: '1px solid',
                      borderColor: finalScore >= 0.8 ? 'rgba(0, 179, 126, 0.2)' :
                                   finalScore >= 0.5 ? 'rgba(255, 184, 0, 0.2)' : 'rgba(229, 72, 77, 0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                        3. Puntuación final
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        Σ(score × peso) / Σ(pesos) ={' '}
                        <Box component="span" sx={{
                          fontSize: '1.2rem',
                          color: finalScore >= 0.8 ? '#00B37E' : finalScore >= 0.5 ? '#FFB800' : '#E5484D',
                        }}>
                          {(finalScore * 100).toFixed(1)}%
                        </Box>
                      </Typography>
                    </Box>
                  );
                })()}
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
