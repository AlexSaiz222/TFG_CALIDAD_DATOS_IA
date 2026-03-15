import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Divider,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  BugReport as BugReportIcon,
  NewReleases as NewReleasesIcon,
  CheckCircle as CheckCircleIcon,
  Replay as ReplayIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material';
import MainLayout from '../../../../components/layout/MainLayout';
import QualityGateBadge from '../../../../components/QualityGateBadge';
import IssuesList from '../../../../components/IssuesList';
import { analysisAPI, projectsAPI } from '../../../../services/api';
import type { AnalysisRun, DataQualityIssue } from '../../../../types';

// Colores consistentes
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';

const AnalysisRunDetail = () => {
  const router = useRouter();
  const { id: projectId, runId } = router.query;

  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);
  const [baselineRun, setBaselineRun] = useState<AnalysisRun | null>(null);
  const [project, setProject] = useState<any>(null);
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId || !runId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch analysis run
        const runResponse = await analysisAPI.getAnalysisRun(Number(runId));
        // Extract analysis_run from response: { data: { data: { analysis_run: ... } } }
        const runData = runResponse.data?.data?.analysis_run || 
                       runResponse.data?.analysis_run || 
                       runResponse.data?.data || 
                       runResponse.data;
        setAnalysisRun(runData);

        // Fetch project info
        try {
          const projectResponse = await projectsAPI.getProject(Number(projectId));
          setProject(projectResponse.data?.data || projectResponse.data);
        } catch {
          console.warn('Could not fetch project info');
        }

        // Fetch baseline if exists
        if (runData?.baseline_analysis_id) {
          try {
            const baselineResponse = await analysisAPI.getAnalysisRun(runData.baseline_analysis_id);
            const baselineData = baselineResponse.data?.data?.analysis_run || 
                                baselineResponse.data?.analysis_run || 
                                baselineResponse.data?.data || 
                                baselineResponse.data;
            setBaselineRun(baselineData);
          } catch {
            console.warn('Could not fetch baseline run');
          }
        }

        setLoading(false);
        
        // Fetch issues (after main loading completes)
        setIssuesLoading(true);
        try {
          const issuesResponse = await analysisAPI.getAnalysisRunIssues(Number(runId));
          // Extract issues from response: { data: { data: { issues: [...] } } }
          const issuesData = issuesResponse.data?.data?.issues || 
                            issuesResponse.data?.issues || 
                            [];
          setIssues(Array.isArray(issuesData) ? issuesData : []);
        } catch {
          console.warn('Could not fetch issues');
          setIssues([]);
        }
        setIssuesLoading(false);
      } catch (err: any) {
        console.error('Error fetching analysis run:', err);
        setError(err.response?.data?.message || 'Error al cargar el análisis');
        setLoading(false);
      }
    };

    if (router.isReady) {
      fetchData();
    }
  }, [projectId, runId, router.isReady]);

  // Calculate duration
  const calculateDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return null;
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${mins}m ${secs}s`;
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (error || !analysisRun) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => router.back()} sx={{ mb: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Alert severity="error">{error || 'Análisis no encontrado'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push(`/projects/${projectId}`)}
            sx={{ mt: 2, backgroundColor: GREEN, '&:hover': { backgroundColor: '#00A070' } }}
          >
            Volver al Proyecto
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const duration = calculateDuration(analysisRun.started_at, analysisRun.completed_at);
  const scoreDiff = baselineRun?.quality_score 
    ? (analysisRun.quality_score || 0) - baselineRun.quality_score 
    : null;

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/projects/${projectId}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Análisis #{analysisRun.id}
            </Typography>
            {project && (
              <Typography variant="body1" sx={{ color: '#555555' }}>
                Proyecto: {project.name}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Quality Gate Status - Large */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 3,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            backgroundColor: '#FAFAFA',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: '#555555' }}>
            Estado del Quality Gate
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <QualityGateBadge
              status={analysisRun.quality_gate_status}
              newIssuesCount={analysisRun.new_issues_count}
              fixedIssuesCount={analysisRun.fixed_issues_count}
              size="large"
              showLabel={true}
              showIssuesCounts={true}
            />
          </Box>

          {/* Quality Score */}
          <Box sx={{ maxWidth: 400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Quality Score
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                  {analysisRun.quality_score?.toFixed(1) || 0}%
                </Typography>
                {scoreDiff !== null && (
                  <Chip
                    icon={scoreDiff >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    label={`${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}%`}
                    size="small"
                    sx={{
                      backgroundColor: scoreDiff >= 0 ? 'rgba(0, 179, 126, 0.1)' : 'rgba(229, 72, 77, 0.1)',
                      color: scoreDiff >= 0 ? GREEN : RED,
                      fontWeight: 600,
                      '& .MuiChip-icon': { color: scoreDiff >= 0 ? GREEN : RED },
                    }}
                  />
                )}
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={analysisRun.quality_score || 0}
              sx={{
                height: 10,
                borderRadius: 5,
                backgroundColor: '#E0E0E0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 
                    (analysisRun.quality_score || 0) >= 80 ? GREEN :
                    (analysisRun.quality_score || 0) >= 60 ? ORANGE : RED,
                  borderRadius: 5,
                },
              }}
            />
          </Box>
        </Paper>

        {/* Metadata Grid */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarIcon sx={{ color: GRAY, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Fecha de ejecución
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {formatDate(analysisRun.completed_at || analysisRun.created_at)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScheduleIcon sx={{ color: GRAY, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Duración
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {duration || '—'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BugReportIcon sx={{ color: GRAY, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Total Issues
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {analysisRun.total_issues_count || 0}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BugReportIcon sx={{ color: RED, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Issues Críticos
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: analysisRun.critical_issues_count > 0 ? RED : 'inherit' }}>
                {analysisRun.critical_issues_count || 0}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Issues Summary */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
            Resumen de Issues
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(229, 72, 77, 0.05)' }}>
                <NewReleasesIcon sx={{ fontSize: 40, color: RED, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: RED }}>
                  {analysisRun.new_issues_count || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Nuevos
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(0, 179, 126, 0.05)' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: GREEN, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: GREEN }}>
                  {analysisRun.fixed_issues_count || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Corregidos
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 184, 0, 0.05)' }}>
                <ReplayIcon sx={{ fontSize: 40, color: ORANGE, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: ORANGE }}>
                  {analysisRun.recurrent_issues_count || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Recurrentes
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(136, 136, 136, 0.05)' }}>
                <BugReportIcon sx={{ fontSize: 40, color: GRAY, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
                  {analysisRun.total_issues_count || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Total
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Baseline Comparison */}
        {baselineRun && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <CompareArrowsIcon sx={{ color: GREEN }} />
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                Comparación con Baseline
              </Typography>
            </Box>
            
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={5}>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: '#FAFAFA' }}>
                  <Typography variant="body2" sx={{ color: '#555555', mb: 1 }}>
                    Análisis Anterior (#{baselineRun.id})
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                    {baselineRun.quality_score?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888888' }}>
                    {formatDate(baselineRun.completed_at)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${baselineRun.total_issues_count || 0} issues`}
                      size="small"
                      sx={{ backgroundColor: '#E0E0E0' }}
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={2}>
                <Box sx={{ textAlign: 'center' }}>
                  <CompareArrowsIcon sx={{ fontSize: 40, color: '#CCCCCC' }} />
                </Box>
              </Grid>
              
              <Grid item xs={12} md={5}>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(0, 179, 126, 0.05)', border: `2px solid ${GREEN}` }}>
                  <Typography variant="body2" sx={{ color: '#555555', mb: 1 }}>
                    Análisis Actual (#{analysisRun.id})
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                    {analysisRun.quality_score?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888888' }}>
                    {formatDate(analysisRun.completed_at)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${analysisRun.total_issues_count || 0} issues`}
                      size="small"
                      sx={{ backgroundColor: '#E0E0E0' }}
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Button
              variant="outlined"
              onClick={() => router.push(`/projects/${projectId}/runs/${baselineRun.id}`)}
              sx={{
                borderColor: GREEN,
                color: GREEN,
                '&:hover': { borderColor: '#00A070', backgroundColor: 'rgba(0, 179, 126, 0.04)' },
              }}
            >
              Ver Análisis Anterior
            </Button>
          </Paper>
        )}

        {/* No Baseline Message */}
        {!baselineRun && analysisRun.status === 'COMPLETED' && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: '#888888' }}>
              Este es el primer análisis del proyecto. No hay baseline para comparar.
            </Typography>
          </Paper>
        )}

        {/* Issues List */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            Detalle de Issues
          </Typography>
          {issuesLoading ? (
            <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ mt: 2, color: GRAY }}>
                Cargando issues...
              </Typography>
            </Paper>
          ) : (
            <IssuesList issues={issues} loading={issuesLoading} />
          )}
        </Box>
      </Box>
    </MainLayout>
  );
};

export default AnalysisRunDetail;
