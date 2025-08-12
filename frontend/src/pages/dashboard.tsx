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
import { Project } from '../types';

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsAPI.getProjects();
        setProjects(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects. Please try again later.');
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  // Calculate summary statistics
  const totalProjects = projects.length;
  const totalDatasets = projects.reduce((sum, project) => sum + project.dataset_count, 0);
  
  // Get recent projects (last 3)
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

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
                        Updated {new Date(project.updated_at).toLocaleDateString()}
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
