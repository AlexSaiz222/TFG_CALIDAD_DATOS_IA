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
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { QualityScoreGauge, MetricCard, IssuesSummary, ColumnMetricsTable } from '../../components/evaluations';
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
  const [showBreakdown, setShowBreakdown] = useState(false);

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
                Evaluation #{evaluation.id}
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
            <Grid container spacing={3} sx={{ mb: 4 }}>
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
                    cursor: overallMetrics.score_breakdown ? 'pointer' : 'default',
                    transition: 'box-shadow 0.2s',
                    '&:hover': overallMetrics.score_breakdown ? { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } : {},
                  }}
                  onClick={() => overallMetrics.score_breakdown && setShowBreakdown(!showBreakdown)}
                >
                  <QualityScoreGauge
                    score={evaluation.quality_score || overallMetrics.quality_score || 0}
                    size="large"
                  />
                  {overallMetrics.score_breakdown && (
                    <Typography variant="caption" sx={{ mt: 1, color: '#888', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {showBreakdown ? '▲ Ocultar detalle' : '▼ Ver cómo se calcula'}
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssessmentIcon sx={{ color: '#00B37E' }} />
                    Metrics Summary
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Completeness Card */}
                    {overallMetrics.completeness !== undefined && (
                      <Grid item xs={12} sm={4}>
                        <Paper elevation={0} sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, height: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Completeness</Typography>
                            {overallMetrics.completeness < 0.95 ? (
                              <WarningIcon sx={{ fontSize: 18, color: '#FFB800' }} />
                            ) : (
                              <CheckCircleIcon sx={{ fontSize: 18, color: '#00B37E' }} />
                            )}
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: overallMetrics.completeness >= 0.95 ? '#00B37E' : '#FFB800' }}>
                            {(overallMetrics.completeness * 100).toFixed(1)}%
                          </Typography>
                          <Box sx={{ width: '100%', height: 4, backgroundColor: '#EEEEEE', borderRadius: 2, mt: 1, mb: 1.5 }}>
                            <Box sx={{ width: `${overallMetrics.completeness * 100}%`, height: '100%', backgroundColor: overallMetrics.completeness >= 0.95 ? '#00B37E' : '#FFB800', borderRadius: 2 }} />
                          </Box>
                          <Typography variant="caption" sx={{ color: '#555' }}>
                            Porcentaje de celdas con valor (no nulas) en todo el dataset.
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', mt: 0.5 }}>
                            Umbral: 95% — por debajo se genera un issue.
                          </Typography>
                        </Paper>
                      </Grid>
                    )}

                    {/* Uniqueness Card */}
                    {overallMetrics.uniqueness !== undefined && (
                      <Grid item xs={12} sm={4}>
                        <Paper elevation={0} sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, height: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Uniqueness</Typography>
                            {overallMetrics.uniqueness >= 1.0 ? (
                              <CheckCircleIcon sx={{ fontSize: 18, color: '#00B37E' }} />
                            ) : (
                              <WarningIcon sx={{ fontSize: 18, color: '#FFB800' }} />
                            )}
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: overallMetrics.uniqueness >= 1.0 ? '#00B37E' : '#FFB800' }}>
                            {(overallMetrics.uniqueness * 100).toFixed(1)}%
                          </Typography>
                          <Box sx={{ width: '100%', height: 4, backgroundColor: '#EEEEEE', borderRadius: 2, mt: 1, mb: 1.5 }}>
                            <Box sx={{ width: `${overallMetrics.uniqueness * 100}%`, height: '100%', backgroundColor: overallMetrics.uniqueness >= 1.0 ? '#00B37E' : '#FFB800', borderRadius: 2 }} />
                          </Box>
                          <Typography variant="caption" sx={{ color: '#555' }}>
                            Porcentaje de filas que son únicas (sin duplicados completos).
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', mt: 0.5 }}>
                            Umbral: 100% — cualquier duplicado genera un issue.
                          </Typography>
                        </Paper>
                      </Grid>
                    )}

                    {/* Outliers Card - Enhanced */}
                    {overallMetrics.outliers && (
                      <Grid item xs={12} sm={4}>
                        <Paper elevation={0} sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Outliers
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: '#FFB800' }}>
                            {Object.values(overallMetrics.outliers).reduce(
                              (sum: number, col: any) => sum + (col?.count || 0), 0
                            )}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#555', display: 'block', mt: 1 }}>
                            Valores fuera del rango esperado usando el método IQR (rango intercuartílico × 1.5).
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>

            {/* Outlier Detail per Column */}
            {overallMetrics.outliers && Object.entries(overallMetrics.outliers).some(([_, col]: [string, any]) => col?.count > 0) && (
              <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #EEEEEE', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Outlier Detail
                </Typography>
                <Typography variant="body2" sx={{ color: '#555', mb: 2 }}>
                  Valores detectados como atípicos por columna. Se usa el método IQR: un valor es outlier si está fuera de [Q1 − 1.5×IQR, Q3 + 1.5×IQR].
                </Typography>
                {Object.entries(overallMetrics.outliers)
                  .filter(([_, col]: [string, any]) => col?.count > 0)
                  .map(([colName, col]: [string, any]) => (
                    <Paper key={colName} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #F5F5F5', borderRadius: 2, backgroundColor: '#FAFAFA' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Chip label={colName} size="small" sx={{ fontWeight: 600, backgroundColor: '#E8E8E8' }} />
                        <Chip label={`${col.count} outliers`} size="small" sx={{ backgroundColor: 'rgba(255, 184, 0, 0.15)', color: '#B8860B', fontWeight: 500 }} />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1 }}>
                        {col.q1 !== undefined && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#888' }}>Q1</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>{Number(col.q1).toLocaleString()}</Typography>
                          </Box>
                        )}
                        {col.q3 !== undefined && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#888' }}>Q3</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>{Number(col.q3).toLocaleString()}</Typography>
                          </Box>
                        )}
                        {col.iqr !== undefined && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#888' }}>IQR</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>{Number(col.iqr).toLocaleString()}</Typography>
                          </Box>
                        )}
                        {col.lower_bound !== undefined && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#888' }}>Límite inferior</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', color: '#E5484D' }}>{Number(col.lower_bound).toLocaleString()}</Typography>
                          </Box>
                        )}
                        {col.upper_bound !== undefined && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#888' }}>Límite superior</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', color: '#E5484D' }}>{Number(col.upper_bound).toLocaleString()}</Typography>
                          </Box>
                        )}
                      </Box>
                      {col.sample_values && col.sample_values.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" sx={{ color: '#888' }}>Valores atípicos detectados:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {col.sample_values.map((val: number, idx: number) => (
                              <Chip key={idx} label={Number(val).toLocaleString()} size="small" sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  ))}
              </Paper>
            )}

            {/* Score Breakdown - Collapsible on gauge click */}
            {showBreakdown && overallMetrics.score_breakdown && (
              <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #E0E0E0', borderRadius: 2, backgroundColor: '#FAFAFA' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Score Breakdown
                </Typography>
                <Typography variant="body2" sx={{ color: '#555555', mb: 3 }}>
                  El Quality Score se calcula promediando los scores de cada métrica evaluada y restando una penalización proporcional al número y severidad de los issues detectados.
                </Typography>

                {/* Step 1: Metric Scores */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#333' }}>
                    1. Scores por métrica
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
                    Base Score (promedio) = <strong>{(overallMetrics.score_breakdown.base_score * 100).toFixed(1)}%</strong>
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
                    3. Score Final
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
              </Paper>
            )}

            {/* Issues Section */}
            <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #EEEEEE', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Issues Detected ({issues.length})
              </Typography>

              {issues.length > 0 ? (
                <>
                  <IssuesSummary
                    issues={issues}
                    onFilterChange={setSelectedSeverity}
                    selectedSeverity={selectedSeverity}
                  />

                  <Divider sx={{ my: 2 }} />

                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Severity</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>Affected Columns</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredIssues.map((issue) => (
                          <TableRow key={issue.id} hover>
                            <TableCell>
                              <Chip
                                size="small"
                                label={issue.severity}
                                sx={{
                                  backgroundColor:
                                    issue.severity === 'high'
                                      ? 'rgba(229, 72, 77, 0.1)'
                                      : issue.severity === 'medium'
                                      ? 'rgba(255, 184, 0, 0.1)'
                                      : 'rgba(0, 179, 126, 0.1)',
                                  color:
                                    issue.severity === 'high'
                                      ? '#E5484D'
                                      : issue.severity === 'medium'
                                      ? '#FFB800'
                                      : '#00B37E',
                                  fontWeight: 500,
                                  textTransform: 'capitalize',
                                }}
                              />
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
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #CCCCCC', borderRadius: 2 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: '#00B37E', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: '#555555' }}>
                    No issues detected. Your data quality is excellent!
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Column Metrics Section */}
            {Object.keys(columnMetrics).length > 0 && (
              <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Column Metrics ({Object.keys(columnMetrics).length} columns)
                </Typography>
                <ColumnMetricsTable columnMetrics={columnMetrics} />
              </Paper>
            )}
          </>
        )}
      </Box>
    </MainLayout>
  );
};

export default EvaluationDetail;
