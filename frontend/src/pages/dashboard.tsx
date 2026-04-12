import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import MainLayout from '../components/layout/MainLayout';
import { StatusDonut } from '../components/dashboard/DashboardCharts';
import KpiCard from '../components/dashboard/KpiCard';
import IssueSeverityChart from '../components/dashboard/IssueSeverityChart';
import ProjectHealthTimeline, { type TimeRange } from '../components/dashboard/ProjectHealthTimeline';
import AttentionTable from '../components/dashboard/AttentionTable';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import type { DashboardSummary } from '../types';

const GREEN = '#00B37E';
const ORANGE = '#FFB800';
const RED = '#E5484D';

function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const historyDays = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const response = await dashboardAPI.getSummary(historyDays);
      const summary = response?.data?.data || response?.data;
      if (summary && summary.projects && summary.aggregated) {
        setData(summary);
      } else {
        setData(null);
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError') {
        setError('Error al cargar el dashboard.');
        console.error('Dashboard fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const historyDays = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const response = await dashboardAPI.getSummary(historyDays);
        if (!isMounted) return;
        const summary = response?.data?.data || response?.data;
        if (summary && summary.projects && summary.aggregated) {
          setData(summary);
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err.name !== 'CanceledError') {
          setError('Error al cargar el dashboard.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [isAuthenticated, authLoading, timeRange]);

  // Derived data for charts
  const issuesByProject = useMemo(() => {
    if (!data) return [];
    return data.projects
      .filter(p => p.latest_analysis)
      .map(p => {
        const breakdown = p.latest_analysis!.issue_severity_breakdown;
        if (breakdown) {
          return { name: p.name, ...breakdown };
        }
        const total = p.latest_analysis!.total_issues_count;
        const critical = p.latest_analysis!.critical_issues_count;
        return { name: p.name, critical, major: total - critical, minor: 0, info: 0 };
      });
  }, [data]);

  // Auth loading state
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) return null;

  const agg = data?.aggregated;
  const noData = !data || data.projects.length === 0;

  return (
    <MainLayout>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: '#555555' }}>
            Bienvenido de nuevo, {user?.first_name || user?.username}
          </Typography>
        </Box>
        <Tooltip title="Actualizar datos">
          <IconButton onClick={fetchDashboard} disabled={loading} sx={{ color: '#888' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Loading skeletons */}
      {loading && !data && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3].map(i => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3, mb: 3 }} />
          <Skeleton variant="rounded" height={250} sx={{ borderRadius: 3 }} />
        </>
      )}

      {/* Error state */}
      {error && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" sx={{ color: RED, mb: 2 }}>{error}</Typography>
          <Button variant="outlined" onClick={fetchDashboard}>Reintentar</Button>
        </Box>
      )}

      {/* Main content */}
      {!loading && !error && data && (
        <>
          {/* ═══ Section A: KPI Cards ═══ */}
          <Grid container spacing={3} sx={{ mb: 4, mt: 1 }}>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                title="Proyectos"
                value={agg!.total_projects}
                chipLabel="Activos"
                chipColor={GREEN}
                icon={<FolderIcon sx={{ fontSize: 26 }} />}
                iconBgColor={GREEN}
                footer={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => router.push('/projects/new')}
                      sx={{
                        backgroundColor: GREEN,
                        color: '#fff',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        borderRadius: 2,
                        px: 1.5,
                        '&:hover': { backgroundColor: '#00A070' },
                      }}
                    >
                      Nuevo
                    </Button>
                    <Tooltip title="Ver proyectos">
                      <IconButton size="small" onClick={() => router.push('/projects')} sx={{ color: '#AAA' }}>
                        <ArrowForwardIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                title="Datasets"
                value={agg!.total_datasets}
                chipLabel="Datos"
                chipColor={GREEN}
                icon={<StorageIcon sx={{ fontSize: 26 }} />}
                iconBgColor={GREEN}
                footer={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => router.push('/datasets/upload')}
                      disabled={agg!.total_projects === 0}
                      sx={{
                        backgroundColor: GREEN,
                        color: '#fff',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        borderRadius: 2,
                        px: 1.5,
                        '&:hover': { backgroundColor: '#00A070' },
                      }}
                    >
                      Subir
                    </Button>
                    <Tooltip title="Ver datasets">
                      <IconButton size="small" onClick={() => router.push('/datasets')} sx={{ color: '#AAA' }}>
                        <ArrowForwardIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                title="Calidad Media"
                value={agg!.avg_quality_score !== null ? `${agg!.avg_quality_score}%` : '-'}
                chipLabel="Score"
                chipColor={GREEN}
                icon={<AssessmentIcon sx={{ fontSize: 26 }} />}
                iconBgColor={GREEN}
                footer={
                  agg!.avg_quality_score !== null ? (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {agg!.gate_distribution.passed > 0 && (
                        <Typography variant="caption" sx={{ color: GREEN, fontWeight: 600 }}>
                          {agg!.gate_distribution.passed} passed
                        </Typography>
                      )}
                      {agg!.gate_distribution.warning > 0 && (
                        <Typography variant="caption" sx={{ color: ORANGE, fontWeight: 600 }}>
                          {agg!.gate_distribution.warning} warning
                        </Typography>
                      )}
                      {agg!.gate_distribution.failed > 0 && (
                        <Typography variant="caption" sx={{ color: RED, fontWeight: 600 }}>
                          {agg!.gate_distribution.failed} failed
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#888' }}>Sin evaluaciones</Typography>
                  )
                }
              />
            </Grid>
          </Grid>

          {/* ═══ Section B: Donut + Issue Severity ═══ */}
          {agg!.total_projects > 0 && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={5}>
                <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #EEEEEE', boxShadow: '0px 2px 4px rgba(0,0,0,0.05)', height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2, fontSize: '1rem' }}>
                    Distribucion de calidad
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'center' }}>
                      <StatusDonut
                        passed={agg!.gate_distribution.passed}
                        warning={agg!.gate_distribution.warning}
                        failed={agg!.gate_distribution.failed}
                        noAnalysis={agg!.gate_distribution.no_analysis}
                        size={130}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[
                          { label: 'Passed', color: GREEN, count: agg!.gate_distribution.passed },
                          { label: 'Warning', color: ORANGE, count: agg!.gate_distribution.warning },
                          { label: 'Failed', color: RED, count: agg!.gate_distribution.failed },
                          { label: 'Sin analisis', color: '#CCCCCC', count: agg!.gate_distribution.no_analysis },
                        ].map(item => (
                          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{item.label}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.count}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </Card>
              </Grid>
              <Grid item xs={12} md={7}>
                <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #EEEEEE', boxShadow: '0px 2px 4px rgba(0,0,0,0.05)', height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2, fontSize: '1rem' }}>
                    Problemas de calidad por proyecto
                  </Typography>
                  <IssueSeverityChart projects={issuesByProject} maxProjects={8} />
                </Card>
              </Grid>
            </Grid>
          )}

          {/* ═══ Section C: Project Health Timeline ═══ */}
          {data.projects.length > 0 && (
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #EEEEEE', boxShadow: '0px 2px 4px rgba(0,0,0,0.05)', mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1, fontSize: '1rem' }}>
                Historial de salud de proyectos
              </Typography>
              <Typography variant="body2" sx={{ color: '#888', mb: 2, fontSize: '0.78rem' }}>
                Cada barra representa el resultado de las evaluaciones de un dia
              </Typography>
              <ProjectHealthTimeline
                projects={data.projects}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
              />
            </Card>
          )}

          {/* ═══ Section D: Requires Attention ═══ */}
          {data.projects.some(p => p.latest_analysis) && (
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #EEEEEE', boxShadow: '0px 2px 4px rgba(0,0,0,0.05)', mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2, fontSize: '1rem' }}>
                Requiere atencion
              </Typography>
              <AttentionTable projects={data.projects} />
            </Card>
          )}

          {/* Empty state */}
          {noData && (
            <Card sx={{ p: 6, borderRadius: 3, textAlign: 'center', border: '2px dashed #E0E0E0' }}>
              <FolderIcon sx={{ fontSize: 48, color: '#CCC', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#555', mb: 1 }}>
                Comienza creando tu primer proyecto
              </Typography>
              <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
                Sube datasets, configura metricas de calidad y ejecuta evaluaciones.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/projects/new')}
                sx={{
                  backgroundColor: GREEN,
                  color: '#fff',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                  '&:hover': { backgroundColor: '#00A070' },
                }}
              >
                Crear proyecto
              </Button>
            </Card>
          )}
        </>
      )}
    </MainLayout>
  );
}

export default Dashboard;
