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
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI } from '../services/api';
// Eliminamos la importación de Project para evitar problemas de tipo
// import { Project } from '../types';

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

const Dashboard = () => {
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

  // Mostrar carga mientras se verifica la autenticación
  if (authLoading) {
      return (
        <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
          <CircularProgress />
        </Box>
      );
  }
  
  // Si no está autenticado, no renderizar nada y esperar la redirección
  if (!isAuthenticated) {
    console.log('Dashboard: No autenticado, esperando redirección...');
    return null; // el useEffect hará la redirección
  }

  useEffect(() => {
    // Solo ejecutar si el usuario está autenticado
    if (!isAuthenticated) {
      return;
    }
    
    const fetchProjects = async () => {
      try {
        console.log('Fetching projects...');
        const response = await projectsAPI.getProjects();
        console.log('API response:', response);
        
        // Asegurar que response sea un array y convertir cada proyecto a formato seguro
        let safeProjects: SafeProject[] = [];
        
        try {
          // Verificar si response es null o undefined antes de intentar procesarlo
          if (response) {
            // Si response no es un array, intentar encontrar la propiedad que contiene los proyectos
            let projectsData = null;
            
            try {
              if (Array.isArray(response)) {
                projectsData = response;
              } else if (typeof response === 'object') {
                if (Array.isArray((response as any).data)) {
                  projectsData = (response as any).data;
                } else if (Array.isArray((response as any).projects)) {
                  projectsData = (response as any).projects;
                } else if (Array.isArray((response as any).results)) {
                  projectsData = (response as any).results;
                }
              }
            } catch (e) {
              console.error('Error al extraer datos de proyectos:', e);
              projectsData = null;
            }
            
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
        } catch (processingError) {
          console.error('Error al procesar la respuesta de proyectos:', processingError);
        }
        
        console.log('Safe projects:', safeProjects);
        setProjects(safeProjects);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects. Please try again later.');
        setLoading(false);
        // En caso de error, asegurar que projects sea un array vacío
        setProjects([]);
      }
    };

    // Solo llamar a fetchProjects si el usuario está autenticado
    fetchProjects();
  }, [isAuthenticated]);

  // Usar variables simples para evitar cualquier problema con arrays
  // Estas variables se calculan de forma segura sin métodos avanzados
  
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
  
  // Proyectos recientes - máximo 3
  let recentProjects: SafeProject[] = [];
  try {
    // Si hay proyectos, tomar hasta 3 sin ordenar para evitar problemas
    if (Array.isArray(projects) && projects.length > 0) {
      // Simplemente tomar los primeros 3 sin ordenar
      recentProjects = projects.slice(0, 3);
    }
  } catch (e) {
    console.error('Error al obtener proyectos recientes:', e);
    recentProjects = [];
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
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
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    backgroundColor: 'rgba(0, 179, 126, 0.1)',
                    borderRadius: '50%',
                    p: 1,
                    mr: 2,
                  }}
                >
                  <StorageIcon sx={{ color: '#00B37E' }} />
                </Box>
                <Typography variant="h6" component="div" sx={{ color: '#555555' }}>
                  Projects
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {totalProjects}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => router.push('/projects/new')}
                sx={{
                  mt: 2,
                  borderColor: '#00B37E',
                  color: '#00B37E',
                  '&:hover': {
                    borderColor: '#00A070',
                    backgroundColor: 'rgba(0, 179, 126, 0.04)',
                  },
                }}
              >
                New Project
              </Button>
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
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    backgroundColor: 'rgba(255, 184, 0, 0.1)',
                    borderRadius: '50%',
                    p: 1,
                    mr: 2,
                  }}
                >
                  <AssessmentIcon sx={{ color: '#FFB800' }} />
                </Box>
                <Typography variant="h6" component="div" sx={{ color: '#555555' }}>
                  Datasets
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {totalDatasets}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => router.push('/datasets/upload')}
                sx={{
                  mt: 2,
                  borderColor: '#FFB800',
                  color: '#FFB800',
                  '&:hover': {
                    borderColor: '#E5A600',
                    backgroundColor: 'rgba(255, 184, 0, 0.04)',
                  },
                }}
                disabled={totalProjects === 0}
              >
                Upload Dataset
              </Button>
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
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    backgroundColor: 'rgba(229, 72, 77, 0.1)',
                    borderRadius: '50%',
                    p: 1,
                    mr: 2,
                  }}
                >
                  <WarningIcon sx={{ color: '#E5484D' }} />
                </Box>
                <Typography variant="h6" component="div" sx={{ color: '#555555' }}>
                  Quality Issues
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                0
              </Typography>
              <Button
                variant="outlined"
                onClick={() => router.push('/evaluations')}
                sx={{
                  mt: 2,
                  borderColor: '#E5484D',
                  color: '#E5484D',
                  '&:hover': {
                    borderColor: '#D03B40',
                    backgroundColor: 'rgba(229, 72, 77, 0.04)',
                  },
                }}
              >
                View Issues
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Projects */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Recent Projects
          </Typography>
          <Button
            variant="text"
            onClick={() => router.push('/projects')}
            sx={{
              color: '#00B37E',
              '&:hover': {
                backgroundColor: 'rgba(0, 179, 126, 0.04)',
              },
            }}
          >
            View All
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Paper sx={{ p: 3, backgroundColor: 'rgba(229, 72, 77, 0.05)', borderRadius: 2 }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : recentProjects.length > 0 ? (
          <Grid container spacing={3}>
            {recentProjects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderRadius: 2,
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
                    },
                  }}
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <CardContent>
                    <Typography variant="h6" component="div" sx={{ mb: 1, fontWeight: 600, color: '#1A1A1A' }}>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {project.description || 'No description'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#555555' }}>
                        {project.dataset_count} {project.dataset_count === 1 ? 'dataset' : 'datasets'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555555' }}>
                        {/* Usar try-catch para manejar posibles errores de fecha */}
                        {(() => {
                          try {
                            return `Updated ${new Date(project.updated_at).toLocaleDateString()}`;
                          } catch (e) {
                            return 'Recently updated';
                          }
                        })()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
              You don't have any projects yet.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/projects/new')}
              sx={{
                backgroundColor: '#00B37E',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
            >
              Create Your First Project
            </Button>
          </Paper>
        )}
      </Box>
    </MainLayout>
  );
};

export default Dashboard;
