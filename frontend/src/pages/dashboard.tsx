import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

// Import the MainLayout component
import MainLayout from '../components/layout/MainLayout';
import { StatusDonut } from '../components/dashboard/DashboardCharts';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI, analysisAPI } from '../services/api';
import type { AnalysisRun, QualityGateStatus } from '../types';

// Definición de tipos para asegurar consistencia
type SafeProject = {
  id: number;
  name: string;
  description: string | null;
  dataset_count: number;
  updated_at: string;
  created_at: string;
};

// Función para convertir un proyecto a un formato seguro
const toSafeProject = (project: any): SafeProject => {
  return {
    id: project?.id || 0,
    name: project?.name || 'Unnamed Project',
    description: project?.description || null,
    dataset_count: typeof project?.dataset_count === 'number' ? project.dataset_count : 0,
    updated_at: project?.updated_at || new Date().toISOString(),
    created_at: project?.created_at || new Date().toISOString(),
  };
};

// Tipo para estadísticas agregadas de análisis
type AnalysisStats = {
  totalAnalyses: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  avgQualityScore: number | null;
  totalIssues: number;
  criticalIssues: number;
};

// Tipo para proyecto con su análisis
type ProjectWithAnalysis = {
  project: SafeProject;
  analysis: AnalysisRun | null;
  qualityScore: number | null;
  gateStatus: 'PASSED' | 'FAILED' | 'WARNING' | null;
};

function Dashboard() {
  // Inicializar con un array vacío para evitar problemas de tipo
  const [projects, setProjects] = useState<SafeProject[]>([]);
  const [projectsWithAnalysis, setProjectsWithAnalysis] = useState<ProjectWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats>({
    totalAnalyses: 0,
    passedCount: 0,
    failedCount: 0,
    warningCount: 0,
    avgQualityScore: null,
    totalIssues: 0,
    criticalIssues: 0,
  });
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  
  // Redirección explícita para usuarios no autenticados
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('Dashboard: Usuario no autenticado, redirigiendo a login...');
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Efecto para cargar proyectos
  useEffect(() => {
    // Solo ejecutar si el usuario está autenticado y no está en proceso de autenticación
    if (authLoading || !isAuthenticated) {
      return;
    }
    
    let isMounted = true;
    
    const fetchProjects = async () => {
      // Don't show loading if we already have projects
      if (projects.length === 0) {
        setLoading(true);
      }
      setError(null);
      
      try {
        console.log('Fetching projects...');
        const response = await projectsAPI.getProjects();
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        console.log('API response:', response);
        
        // Asegurar que response sea un array y convertir cada proyecto a formato seguro
        let safeProjects: SafeProject[] = [];
        
        // Verificar si response es null o undefined antes de intentar procesarlo
        if (response) {
          // Si response no es un array, intentar encontrar la propiedad que contiene los proyectos
          const projectsData = Array.isArray(response) ? response : 
                              (response as any).data ? (response as any).data : 
                              (response as any).projects ? (response as any).projects : 
                              (response as any).results ? (response as any).results : 
                              null;
          
          // Si encontramos datos de proyectos y es un array, procesarlos
          if (Array.isArray(projectsData)) {
            for (let i = 0; i < projectsData.length; i++) {
              try {
                safeProjects.push(toSafeProject(projectsData[i]));
              } catch (e) {
                console.error('Error al procesar proyecto:', e);
              }
            }
          } else {
            console.warn('No se encontraron datos de proyectos en formato array');
          }
        } else {
          console.warn('La respuesta de la API es null o undefined');
        }
        
        console.log('Safe projects:', safeProjects);
        setProjects(safeProjects);
        setLoading(false);
      } catch (error: any) {
        // Only update state if component is still mounted
        if (!isMounted) return;
        
        console.error('Error fetching projects:', error);
        
        // Don't show error for cancelled requests
        if (error.name === 'CanceledError') {
          console.log('Request was cancelled, ignoring error');
        } else {
          setError('Failed to load projects. Please try again later.');
        }
        
        setLoading(false);
      }
    };

    // Solo llamar a fetchProjects si el usuario está autenticado
    fetchProjects();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Efecto para cargar estadísticas de análisis de todos los proyectos
  useEffect(() => {
    if (!isAuthenticated || projects.length === 0) return;

    let isMounted = true;

    const fetchAnalysisStats = async () => {
      try {
        // Obtener el último análisis de cada proyecto
        const analysisPromises = projects.map(async (project) => {
          try {
            const response = await analysisAPI.getLatestAnalysisRun(project.id);
            const analysisRun = response?.data?.data?.analysis_run || 
                               response?.data?.analysis_run || 
                               null;
            return { project, analysisRun };
          } catch {
            return { project, analysisRun: null };
          }
        });

        const results = await Promise.all(analysisPromises);
        
        if (!isMounted) return;

        // Crear array de proyectos con análisis
        const projectsAnalysis: ProjectWithAnalysis[] = results.map(({ project, analysisRun }) => ({
          project,
          analysis: analysisRun,
          qualityScore: analysisRun?.status === 'COMPLETED' ? (analysisRun.quality_score ?? null) : null,
          gateStatus: analysisRun?.status === 'COMPLETED' ? (analysisRun.quality_gate_status as 'PASSED' | 'FAILED' | 'WARNING' ?? null) : null,
        }));

        setProjectsWithAnalysis(projectsAnalysis);

        // Filtrar análisis válidos (completados)
        const validAnalyses = results
          .map(r => r.analysisRun)
          .filter((a): a is AnalysisRun => a !== null && a.status === 'COMPLETED');

        // Calcular estadísticas agregadas
        const stats: AnalysisStats = {
          totalAnalyses: validAnalyses.length,
          passedCount: validAnalyses.filter(a => a.quality_gate_status === 'PASSED').length,
          failedCount: validAnalyses.filter(a => a.quality_gate_status === 'FAILED').length,
          warningCount: validAnalyses.filter(a => a.quality_gate_status === 'WARNING').length,
          avgQualityScore: validAnalyses.length > 0
            ? Math.round(
                validAnalyses.reduce((sum, a) => sum + (a.quality_score || 0), 0) / validAnalyses.length
              )
            : null,
          totalIssues: validAnalyses.reduce((sum, a) => sum + (a.total_issues_count || 0), 0),
          criticalIssues: validAnalyses.reduce((sum, a) => sum + (a.critical_issues_count || 0), 0),
        };

        setAnalysisStats(stats);
      } catch (error) {
        console.error('Error fetching analysis stats:', error);
      }
    };

    fetchAnalysisStats();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, projects]);

  // Total de proyectos - simplemente la longitud del array
  const totalProjects = Array.isArray(projects) ? projects.length : 0;
  
  // Total de datasets - suma manual
  let totalDatasets = 0;
  try {
    if (Array.isArray(projects)) {
      for (let i = 0; i < projects.length; i++) {
        if (projects[i] && typeof projects[i].dataset_count === 'number') {
          totalDatasets += projects[i].dataset_count;
        }
      }
    }
  } catch (e) {
    console.error('Error al calcular totalDatasets:', e);
  }

  // Calcular proyectos sin análisis para el gráfico donut
  const projectsWithoutAnalysis = projectsWithAnalysis.filter(p => p.gateStatus === null).length;

  // Mostrar carga mientras se verifica la autenticación
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Si no está autenticado, no renderizar nada y esperar la redirección
  if (!isAuthenticated) {
    return null; // el useEffect hará la redirección
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 1, fontWeight: 600, color: '#1A1A1A' }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: '#555555' }}>
          ¡Bienvenido de nuevo, {user?.first_name || user?.username}!
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
              transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
              overflow: 'visible',
              position: 'relative',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box 
              sx={{
                position: 'absolute',
                top: '-16px',
                left: '24px',
                backgroundColor: '#00B37E',
                borderRadius: '12px',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 4px 8px rgba(0, 179, 126, 0.25)',
              }}
            >
              <StorageIcon sx={{ color: 'white', fontSize: '28px' }} />
            </Box>
            <CardContent sx={{ pt: 5, pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Typography variant="h6" component="div" sx={{ color: '#1A1A1A', fontWeight: 600 }}>
                  Proyectos
                </Typography>
                <Chip 
                  label="Activos" 
                  size="small" 
                  sx={{ 
                    backgroundColor: alpha('#00B37E', 0.1), 
                    color: '#00B37E',
                    fontWeight: 500,
                  }} 
                />
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 2 }}>
                {totalProjects}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon sx={{ color: '#FFFFFF' }} />}
                  onClick={() => router.push('/projects/new')}
                  sx={{
                    backgroundColor: '#00B37E',
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00A070',
                    },
                    boxShadow: '0px 2px 4px rgba(0, 179, 126, 0.25)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  Nuevo proyecto
                </Button>
                <Tooltip title="Ver todos los proyectos">
                  <IconButton 
                    onClick={() => router.push('/projects')}
                    sx={{ color: '#555555' }}
                  >
                    <ArrowForwardIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
              transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
              overflow: 'visible',
              position: 'relative',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box 
              sx={{
                position: 'absolute',
                top: '-16px',
                left: '24px',
                backgroundColor: '#FFB800',
                borderRadius: '12px',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 4px 8px rgba(255, 184, 0, 0.25)',
              }}
            >
              <AssessmentIcon sx={{ color: 'white', fontSize: '28px' }} />
            </Box>
            <CardContent sx={{ pt: 5, pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Typography variant="h6" component="div" sx={{ color: '#1A1A1A', fontWeight: 600 }}>
                  Datasets
                </Typography>
                <Chip 
                  label="Datos" 
                  size="small" 
                  sx={{ 
                    backgroundColor: alpha('#FFB800', 0.1), 
                    color: '#FFB800',
                    fontWeight: 500,
                  }} 
                />
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 2 }}>
                {totalDatasets}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon sx={{ color: 'white' }} />}
                  onClick={() => router.push('/datasets/upload')}
                  sx={{
                    backgroundColor: '#FFB800',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#E5A600',
                    },
                    boxShadow: '0px 2px 4px rgba(255, 184, 0, 0.25)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                  disabled={totalProjects === 0}
                >
                  Subir dataset
                </Button>
                <Tooltip title="Ver todos los datasets">
                  <span>
                    <IconButton 
                      onClick={() => router.push('/datasets')}
                      sx={{ color: '#555555' }}
                      disabled={totalDatasets === 0}
                    >
                      <ArrowForwardIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
              transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
              overflow: 'visible',
              position: 'relative',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <Box 
              sx={{
                position: 'absolute',
                top: '-16px',
                left: '24px',
                backgroundColor: '#00B37E',
                borderRadius: '12px',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 4px 8px rgba(0, 179, 126, 0.25)',
              }}
            >
              <AssessmentIcon sx={{ color: 'white', fontSize: '28px' }} />
            </Box>
            <CardContent sx={{ pt: 5, pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Typography variant="h6" component="div" sx={{ color: '#1A1A1A', fontWeight: 600 }}>
                  Calidad de datos
                </Typography>
                {analysisStats.totalAnalyses > 0 ? (
                  <Chip 
                    label={
                      analysisStats.failedCount > 0 ? 'FAILED' :
                      analysisStats.warningCount > 0 ? 'WARNING' : 'PASSED'
                    }
                    size="small" 
                    sx={{ 
                      backgroundColor: alpha(
                        analysisStats.failedCount > 0 ? '#E5484D' :
                        analysisStats.warningCount > 0 ? '#FFB800' : '#00B37E',
                        0.1
                      ), 
                      color: analysisStats.failedCount > 0 ? '#E5484D' :
                             analysisStats.warningCount > 0 ? '#FFB800' : '#00B37E',
                      fontWeight: 600,
                    }} 
                  />
                ) : (
                  <Chip 
                    label="Sin análisis" 
                    size="small" 
                    sx={{ 
                      backgroundColor: alpha('#888', 0.1), 
                      color: '#888',
                      fontWeight: 500,
                    }} 
                  />
                )}
              </Box>
              {analysisStats.totalAnalyses > 0 ? (
                <>
                  <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 2 }}>
                    {analysisStats.avgQualityScore !== null ? `${analysisStats.avgQualityScore}%` : '-'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ color: '#555555' }}>
                      Score promedio de calidad
                    </Typography>
                    <Chip 
                      label={`${analysisStats.passedCount} passed`} 
                      size="small" 
                      onClick={() => router.push('/projects?status=passed')}
                      sx={{ 
                        backgroundColor: alpha('#00B37E', 0.1), 
                        color: '#00B37E', 
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: alpha('#00B37E', 0.2) },
                      }} 
                    />
                    {analysisStats.warningCount > 0 && (
                      <Chip 
                        label={`${analysisStats.warningCount} warning`} 
                        size="small" 
                        onClick={() => router.push('/projects?status=warning')}
                        sx={{ 
                          backgroundColor: alpha('#FFB800', 0.1), 
                          color: '#FFB800', 
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: alpha('#FFB800', 0.2) },
                        }} 
                      />
                    )}
                    {analysisStats.failedCount > 0 && (
                      <Chip 
                        label={`${analysisStats.failedCount} failed`} 
                        size="small" 
                        onClick={() => router.push('/projects?status=failed')}
                        sx={{ 
                          backgroundColor: alpha('#E5484D', 0.1), 
                          color: '#E5484D', 
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: alpha('#E5484D', 0.2) },
                        }} 
                      />
                    )}
                  </Box>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Ejecuta análisis de calidad en tus datasets para ver métricas y detectar problemas.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sección de Distribución de Estados */}
      {projectsWithAnalysis.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2 }}>
            Distribución de Calidad
          </Typography>
          <Card sx={{ p: 3, borderRadius: 2, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
                <StatusDonut
                  passed={analysisStats.passedCount}
                  warning={analysisStats.warningCount}
                  failed={analysisStats.failedCount}
                  noAnalysis={projectsWithoutAnalysis}
                  size={140}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#00B37E' }} />
                      <Typography variant="body2">Passed</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysisStats.passedCount} proyectos</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFB800' }} />
                      <Typography variant="body2">Warning</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysisStats.warningCount} proyectos</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#E5484D' }} />
                      <Typography variant="body2">Failed</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysisStats.failedCount} proyectos</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#CCCCCC' }} />
                      <Typography variant="body2">Sin análisis</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{projectsWithoutAnalysis} proyectos</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Box>
      )}

      {/* Sección Requiere Atención - Top 5 proyectos con peor score */}
      {projectsWithAnalysis.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 2 }}>
            Requiere atención
          </Typography>
          
          {(() => {
            // Filtrar proyectos con análisis y ordenar por score (peor primero)
            const projectsNeedingAttention = projectsWithAnalysis
              .filter(p => p.gateStatus === 'FAILED' || p.gateStatus === 'WARNING' || (p.qualityScore !== null && p.qualityScore < 80))
              .sort((a, b) => (a.qualityScore ?? 100) - (b.qualityScore ?? 100))
              .slice(0, 5);

            if (projectsNeedingAttention.length === 0) {
              return (
                <Card sx={{ p: 3, borderRadius: 2, backgroundColor: alpha('#00B37E', 0.05), border: '1px solid', borderColor: alpha('#00B37E', 0.2) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AssessmentIcon sx={{ color: '#00B37E', fontSize: 32 }} />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1A1A1A' }}>
                        ¡Todo en orden!
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555555' }}>
                        No hay proyectos que requieran atención inmediata.
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              );
            }

            return (
              <Grid container spacing={2}>
                {projectsNeedingAttention.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.project.id}>
                    <Card 
                      sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: item.gateStatus === 'FAILED' ? alpha('#E5484D', 0.3) : alpha('#FFB800', 0.3),
                        backgroundColor: item.gateStatus === 'FAILED' ? alpha('#E5484D', 0.02) : alpha('#FFB800', 0.02),
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
                        },
                      }}
                      onClick={() => router.push(`/projects/${item.project.id}`)}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                          {item.project.name}
                        </Typography>
                        <Chip 
                          label={item.gateStatus || 'N/A'} 
                          size="small" 
                          sx={{ 
                            backgroundColor: alpha(item.gateStatus === 'FAILED' ? '#E5484D' : '#FFB800', 0.1),
                            color: item.gateStatus === 'FAILED' ? '#E5484D' : '#FFB800',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }} 
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: item.gateStatus === 'FAILED' ? '#E5484D' : '#FFB800' }}>
                          {item.qualityScore !== null ? `${item.qualityScore}%` : '-'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#555555' }}>
                          {item.project.dataset_count} dataset{item.project.dataset_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            );
          })()}
        </Box>
      )}

    </MainLayout>
  );
}

export default Dashboard;
