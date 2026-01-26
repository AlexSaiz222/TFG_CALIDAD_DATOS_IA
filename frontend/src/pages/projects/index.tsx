import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import QualityGateBadge from '../../components/QualityGateBadge';
import { useAuth } from '../../contexts/AuthContext';
import { projectsAPI, analysisAPI } from '../../services/api';
import { Project, AnalysisRun } from '../../types';

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState<Record<number, AnalysisRun | null>>({});
  
  const { isAuthenticated } = useAuth();
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
        // getProjects ahora devuelve directamente el array de proyectos
        setProjects(response);
        setFilteredProjects(response);
        setLoading(false);
        
        // Fetch latest analysis for each project
        const analysisPromises = response.map(async (project: Project) => {
          try {
            const analysis = await analysisAPI.getLatestAnalysisRun(project.id);
            return { projectId: project.id, analysis };
          } catch {
            return { projectId: project.id, analysis: null };
          }
        });
        
        const analysisResults = await Promise.all(analysisPromises);
        const analysisMap: Record<number, AnalysisRun | null> = {};
        analysisResults.forEach(({ projectId, analysis }) => {
          analysisMap[projectId] = analysis;
        });
        setProjectAnalysis(analysisMap);
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

  useEffect(() => {
    // Filter projects based on search term
    if (searchTerm.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(
        (project) =>
          project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEditProject = () => {
    handleMenuClose();
    if (selectedProject) {
      router.push(`/projects/edit/${selectedProject.id}`);
    }
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;
    
    setDeleteLoading(true);
    try {
      await projectsAPI.deleteProject(selectedProject.id);
      
      // Remove deleted project from state
      setProjects((prevProjects) => 
        prevProjects.filter((project) => project.id !== selectedProject.id)
      );
      
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project. Please try again later.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleProjectClick = (projectId: number) => {
    router.push(`/projects/${projectId}`);
  };

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Projects
          </Typography>
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
            }}
          >
            New Project
          </Button>
        </Box>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#555555' }} />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3, backgroundColor: 'rgba(229, 72, 77, 0.05)', borderRadius: 2 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : filteredProjects.length > 0 ? (
          <Grid container spacing={3}>
            {filteredProjects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography 
                        variant="h6" 
                        component="div" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 600, 
                          color: '#1A1A1A',
                          cursor: 'pointer',
                          '&:hover': {
                            color: '#00B37E',
                          },
                        }}
                        onClick={() => handleProjectClick(project.id)}
                      >
                        {project.name}
                      </Typography>
                      <IconButton
                        aria-label="project options"
                        onClick={(e) => handleMenuOpen(e, project)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        height: '40px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {project.description || 'No description'}
                    </Typography>
                    
                    {/* Quality Gate Badge - Sonar-Lite */}
                    <Box 
                      sx={{ 
                        mb: 2,
                        cursor: projectAnalysis[project.id] ? 'pointer' : 'default',
                        '&:hover': projectAnalysis[project.id] ? {
                          opacity: 0.8,
                        } : {},
                      }}
                      onClick={(e) => {
                        if (projectAnalysis[project.id]) {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/runs/${projectAnalysis[project.id]?.id}`);
                        }
                      }}
                    >
                      <QualityGateBadge
                        status={projectAnalysis[project.id]?.quality_gate_status}
                        newIssuesCount={projectAnalysis[project.id]?.new_issues_count || 0}
                        fixedIssuesCount={projectAnalysis[project.id]?.fixed_issues_count || 0}
                        size="small"
                        showLabel={true}
                        showIssuesCounts={true}
                      />
                    </Box>
                    
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#555555' }}>
                        {project.dataset_count} {project.dataset_count === 1 ? 'dataset' : 'datasets'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555555' }}>
                        {new Date(project.updated_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
              {searchTerm ? 'No projects match your search criteria.' : "You don't have any projects yet."}
            </Typography>
            {!searchTerm && (
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
                }}
              >
                Create Your First Project
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Project options menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
            mt: 1.5,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleEditProject}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: '#E5484D' }} />
          </ListItemIcon>
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Delete Project?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete the project "{selectedProject?.name}"? This action cannot be undone and will delete all associated datasets and evaluations.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            autoFocus
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default Projects;
