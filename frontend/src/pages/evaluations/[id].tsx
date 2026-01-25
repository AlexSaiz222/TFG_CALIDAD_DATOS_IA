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
  const overallMetrics = results?.overall || {};
  const columnMetrics = results?.column_metrics || {};

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
                    <AssessmentIcon sx={{ color: '#00B37E' }} />
                    Metrics Summary
                  </Typography>
                  <Grid container spacing={2}>
                    {overallMetrics.completeness !== undefined && (
                      <Grid item xs={6} sm={4}>
                        <MetricCard
                          name="Completeness"
                          value={overallMetrics.completeness}
                          threshold={0.95}
                          description="Non-null values"
                        />
                      </Grid>
                    )}
                    {overallMetrics.uniqueness !== undefined && (
                      <Grid item xs={6} sm={4}>
                        <MetricCard
                          name="Uniqueness"
                          value={overallMetrics.uniqueness}
                          threshold={1.0}
                          description="Unique rows"
                        />
                      </Grid>
                    )}
                    {overallMetrics.outliers && (
                      <Grid item xs={6} sm={4}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            border: '1px solid #EEEEEE',
                            borderRadius: 2,
                            height: '100%',
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1 }}>
                            Outliers Detected
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: '#FFB800' }}>
                            {Object.values(overallMetrics.outliers).reduce(
                              (sum: number, col: any) => sum + (col?.count || 0),
                              0
                            )}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#555555' }}>
                            Across all columns
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>

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
                                ? issue.affected_columns.map((col: any) => col.column || col).join(', ')
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
