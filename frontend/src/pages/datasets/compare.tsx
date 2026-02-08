import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI } from '../../services/api';
import { Dataset } from '../../types';

interface ComparisonData {
  dataset_a: Dataset & { latestAnalysis?: any };
  dataset_b: Dataset & { latestAnalysis?: any };
  comparison: {
    rows_diff: number;
    columns_diff: number;
    quality_score_diff: number | null;
    issues_diff: number;
    new_issues: any[];
    resolved_issues: any[];
    common_issues: any[];
  };
}

const DatasetCompare = () => {
  const router = useRouter();
  const { a, b, projectId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);

  useEffect(() => {
    const fetchComparison = async () => {
      if (!a || !b || !projectId) return;

      try {
        setLoading(true);
        const response = await datasetsAPI.compareDatasetVersions(
          Number(projectId),
          Number(a),
          Number(b)
        );
        const data = response?.data?.data || response?.data || {};
        setComparisonData(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching comparison:', err);
        setError('No se pudo cargar la comparación de versiones');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [a, b, projectId]);

  const getQualityGateIcon = (status: string | null | undefined) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 24 }} />;
      case 'FAILED':
        return <ErrorIcon sx={{ color: '#E5484D', fontSize: 24 }} />;
      case 'WARNING':
        return <WarningIcon sx={{ color: '#FFB800', fontSize: 24 }} />;
      default:
        return null;
    }
  };

  const getTrendIcon = (diff: number | null) => {
    if (diff === null) return <TrendingFlatIcon sx={{ color: '#999' }} />;
    if (diff > 0) return <TrendingUpIcon sx={{ color: '#00B37E' }} />;
    if (diff < 0) return <TrendingDownIcon sx={{ color: '#E5484D' }} />;
    return <TrendingFlatIcon sx={{ color: '#FFB800' }} />;
  };

  const formatDiff = (diff: number | null, suffix: string = '') => {
    if (diff === null) return '—';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}${suffix}`;
  };

  const getIssueSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return '#E5484D';
      case 'medium':
        return '#FFB800';
      case 'low':
        return '#00B37E';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error || !comparisonData) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error || 'No se encontraron datos de comparación'}</Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.back()}
            sx={{ mt: 2 }}
          >
            Volver
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const { dataset_a, dataset_b, comparison } = comparisonData;

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Comparación de Versiones
          </Typography>
        </Box>

        {/* Version Cards Side by Side */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Version A */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '2px solid #E0E0E0',
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip
                  label={dataset_a.version_tag || `v${dataset_a.version}`}
                  sx={{
                    backgroundColor: 'rgba(23, 69, 79, 0.1)',
                    color: '#17454F',
                    fontWeight: 600,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Versión anterior
                </Typography>
              </Box>
              
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {dataset_a.name}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Filas</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {dataset_a.row_count?.toLocaleString() || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Columnas</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {dataset_a.column_count || '—'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getQualityGateIcon(dataset_a.latestAnalysis?.quality_gate_status)}
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {dataset_a.latestAnalysis?.quality_score != null
                      ? `${dataset_a.latestAnalysis.quality_score}%`
                      : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Quality Score
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {dataset_a.latestAnalysis?.total_issues_count ?? 0} issues detectados
              </Typography>
            </Paper>
          </Grid>

          {/* Arrow */}
          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <SwapHorizIcon sx={{ fontSize: 48, color: '#9c27b0' }} />
              <Typography variant="body2" color="text.secondary">
                vs
              </Typography>
            </Box>
          </Grid>

          {/* Version B */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '2px solid #00B37E',
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip
                  label={dataset_b.version_tag || `v${dataset_b.version}`}
                  sx={{
                    backgroundColor: 'rgba(23, 69, 79, 0.1)',
                    color: '#17454F',
                    fontWeight: 600,
                  }}
                />
                {dataset_b.is_latest && (
                  <Chip
                    label="Latest"
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 179, 126, 0.1)',
                      color: '#00B37E',
                      fontWeight: 600,
                    }}
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  Versión actual
                </Typography>
              </Box>
              
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {dataset_b.name}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Filas</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {dataset_b.row_count?.toLocaleString() || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Columnas</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {dataset_b.column_count || '—'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getQualityGateIcon(dataset_b.latestAnalysis?.quality_gate_status)}
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {dataset_b.latestAnalysis?.quality_score != null
                      ? `${dataset_b.latestAnalysis.quality_score}%`
                      : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Quality Score
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {dataset_b.latestAnalysis?.total_issues_count ?? 0} issues detectados
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Summary Stats */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Resumen de cambios
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {getTrendIcon(comparison.quality_score_diff)}
                  <Typography variant="h4" sx={{ fontWeight: 600, color: comparison.quality_score_diff && comparison.quality_score_diff > 0 ? '#00B37E' : comparison.quality_score_diff && comparison.quality_score_diff < 0 ? '#E5484D' : '#757575' }}>
                    {formatDiff(comparison.quality_score_diff, '%')}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Quality Score
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 600, color: comparison.issues_diff < 0 ? '#00B37E' : comparison.issues_diff > 0 ? '#E5484D' : '#757575' }}>
                  {formatDiff(-comparison.issues_diff)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Issues (menos = mejor)
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#00B37E' }}>
                  {comparison.resolved_issues?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Issues resueltos
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#E5484D' }}>
                  {comparison.new_issues?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nuevos issues
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Issues Diff */}
        <Grid container spacing={3}>
          {/* Resolved Issues */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckCircleIcon sx={{ color: '#00B37E' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Issues Resueltos ({comparison.resolved_issues?.length || 0})
                </Typography>
              </Box>
              
              {comparison.resolved_issues && comparison.resolved_issues.length > 0 ? (
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Severidad</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparison.resolved_issues.map((issue: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip
                              label={issue.severity}
                              size="small"
                              sx={{
                                backgroundColor: `${getIssueSeverityColor(issue.severity)}20`,
                                color: getIssueSeverityColor(issue.severity),
                                fontWeight: 500,
                                textTransform: 'capitalize',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: '#999' }}>
                              {issue.description}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No hay issues resueltos entre estas versiones
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* New Issues */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ErrorIcon sx={{ color: '#E5484D' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Nuevos Issues ({comparison.new_issues?.length || 0})
                </Typography>
              </Box>
              
              {comparison.new_issues && comparison.new_issues.length > 0 ? (
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Severidad</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparison.new_issues.map((issue: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip
                              label={issue.severity}
                              size="small"
                              sx={{
                                backgroundColor: `${getIssueSeverityColor(issue.severity)}20`,
                                color: getIssueSeverityColor(issue.severity),
                                fontWeight: 500,
                                textTransform: 'capitalize',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {issue.description}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No hay nuevos issues en esta versión
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => router.push(`/datasets/${a}`)}
          >
            Ver {dataset_a.version_tag || `v${dataset_a.version}`}
          </Button>
          <Button
            variant="contained"
            onClick={() => router.push(`/datasets/${b}`)}
            sx={{
              backgroundColor: '#00B37E',
              '&:hover': { backgroundColor: '#00A070' },
            }}
          >
            Ver {dataset_b.version_tag || `v${dataset_b.version}`}
          </Button>
        </Box>
      </Box>
    </MainLayout>
  );
};

export default DatasetCompare;
