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
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI } from '../services/api';

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

function Dashboard() {
  // Inicializar con un array vacío para evitar problemas de tipo
  const [projects, setProjects] = useState<SafeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          Welcome back, {user?.first_name || user?.username}!
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
                  Projects
                </Typography>
                <Chip 
                  label="Active" 
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
                  New Project
                </Button>
                <Tooltip title="View all projects">
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
                  label="Analytics" 
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
                  Upload Dataset
                </Button>
                <Tooltip title="View all datasets">
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
                backgroundColor: '#E5484D',
                borderRadius: '12px',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 4px 8px rgba(229, 72, 77, 0.25)',
              }}
            >
              <WarningIcon sx={{ color: 'white', fontSize: '28px' }} />
            </Box>
            <CardContent sx={{ pt: 5, pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Typography variant="h6" component="div" sx={{ color: '#1A1A1A', fontWeight: 600 }}>
                  Evaluaciones
                </Typography>
                <Chip 
                  label="Análisis" 
                  size="small" 
                  sx={{ 
                    backgroundColor: alpha('#E5484D', 0.1), 
                    color: '#E5484D',
                    fontWeight: 500,
                  }} 
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#555555', mb: 2 }}>
                Ejecuta análisis de calidad en tus datasets para detectar problemas.
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<AssessmentIcon sx={{ color: 'white' }} />}
                  onClick={() => router.push('/projects')}
                  sx={{
                    backgroundColor: '#E5484D',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#D03B40',
                    },
                    boxShadow: '0px 2px 4px rgba(229, 72, 77, 0.25)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  Ver Proyectos
                </Button>
                <Tooltip title="Ver historial de análisis">
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
      </Grid>

    </MainLayout>
  );
}

export default Dashboard;
