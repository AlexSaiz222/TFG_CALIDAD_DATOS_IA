import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Chip,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { projectsAPI, datasetsAPI } from '../../services/api';
import { Project, Dataset } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const ProjectDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectDeleteDialogOpen, setProjectDeleteDialogOpen] = useState(false);
  const [projectDeleteLoading, setProjectDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch project details
        const projectResponse = await projectsAPI.getProject(projectId);
        setProject(projectResponse.data);

        try {
          // Fetch datasets for this project
          const datasetsResponse = await datasetsAPI.getDatasets(projectId);
          setDatasets(datasetsResponse.data);
        } catch (datasetError: any) {
          console.error('Error fetching datasets:', datasetError);
          // Si hay un error al obtener datasets, simplemente establecemos un array vacío
          // pero no mostramos error al usuario ya que el proyecto se cargó correctamente
          setDatasets([]);
        }

        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching project data:', error);
        setError(error.response?.data?.message || 'Failed to load project data. Please try again.');
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, dataset: Dataset) => {
    setAnchorEl(event.currentTarget);
    setSelectedDataset(dataset);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleProjectDeleteClick = () => {
    setProjectDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleProjectDeleteCancel = () => {
    setProjectDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDataset) return;
    
    setDeleteLoading(true);
    try {
      await datasetsAPI.deleteDataset(selectedDataset.id);
      
      // Remove deleted dataset from state
      setDatasets((prevDatasets) => 
        prevDatasets.filter((dataset) => dataset.id !== selectedDataset.id)
      );
      
      setDeleteDialogOpen(false);
      setSelectedDataset(null);
    } catch (error) {
      console.error('Error deleting dataset:', error);
      setError('Failed to delete dataset. Please try again later.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleProjectDeleteConfirm = async () => {
    if (!project) return;
    
    setProjectDeleteLoading(true);
    try {
      await projectsAPI.deleteProject(project.id);
      
      // Redirect to projects list after successful deletion
      router.push('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      setProjectDeleteLoading(false);
      setProjectDeleteDialogOpen(false);
    }
  };

  const handleDatasetClick = (datasetId: number) => {
    router.push(`/datasets/${datasetId}`);
  };

  const handleUploadDataset = () => {
    if (projectId) {
      router.push(`/datasets/upload?projectId=${projectId}`);
    }
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

  if (error || !project) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Project Not Found
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Project not found'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: '#00B37E',
              '&:hover': {
                backgroundColor: '#00A070',
              },
            }}
          >
            Back to Projects
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/projects')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {project.name}
            </Typography>
            {project.description && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {project.description}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => router.push(`/metrics/configure?id=${project.id}`)}
            sx={{
              borderColor: '#00B37E',
              color: '#00B37E',
              mr: 2,
              '&:hover': {
                borderColor: '#00A070',
                backgroundColor: 'rgba(0, 179, 126, 0.04)',
              },
            }}
          >
            Configure Metrics
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/projects/edit/${project.id}`)}
            sx={{
              borderColor: '#00B37E',
              color: '#00B37E',
              mr: 2,
              '&:hover': {
                borderColor: '#00A070',
                backgroundColor: 'rgba(0, 179, 126, 0.04)',
              },
            }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleProjectDeleteClick}
            sx={{
              borderColor: '#E5484D',
              color: '#E5484D',
              '&:hover': {
                borderColor: '#C73D42',
                backgroundColor: 'rgba(229, 72, 77, 0.04)',
              },
            }}
          >
            Delete
          </Button>
        </Box>

        {/* Project Info Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            backgroundColor: '#FAFAFA',
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Created
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(project.created_at).toLocaleDateString()}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Last Updated
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(project.updated_at).toLocaleDateString()}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Datasets
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {project.dataset_count}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="project tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
              },
              '& .Mui-selected': {
                color: '#00B37E',
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#00B37E',
              },
            }}
          >
            <Tab label="Datasets" id="project-tab-0" aria-controls="project-tabpanel-0" />
            <Tab label="Evaluations" id="project-tab-1" aria-controls="project-tabpanel-1" />
          </Tabs>
        </Box>

        {/* Datasets Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleUploadDataset}
              sx={{
                backgroundColor: '#00B37E',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
            >
              Upload Dataset
            </Button>
          </Box>

          {datasets.length > 0 ? (
            <Grid container spacing={3}>
              {datasets.map((dataset) => (
                <Grid item xs={12} sm={6} md={4} key={dataset.id}>
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
                          onClick={() => handleDatasetClick(dataset.id)}
                        >
                          {dataset.name}
                        </Typography>
                        <IconButton
                          aria-label="dataset options"
                          onClick={(e) => handleMenuOpen(e, dataset)}
                          size="small"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      {dataset.description && (
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
                          {dataset.description}
                        </Typography>
                      )}
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip 
                          label={`${dataset.row_count} rows`} 
                          size="small" 
                          sx={{ mr: 1, mb: 1, backgroundColor: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }} 
                        />
                        <Chip 
                          label={`${dataset.column_count} columns`} 
                          size="small" 
                          sx={{ mr: 1, mb: 1, backgroundColor: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }} 
                        />
                      </Box>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555555' }}>
                          {dataset.evaluation_count} {dataset.evaluation_count === 1 ? 'evaluation' : 'evaluations'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#555555' }}>
                          {new Date(dataset.updated_at).toLocaleDateString()}
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
                No datasets available for this project.
              </Typography>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handleUploadDataset}
                sx={{
                  backgroundColor: '#00B37E',
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                Upload Your First Dataset
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Evaluations Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
              No evaluations available for this project.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              onClick={() => datasets.length > 0 ? router.push(`/datasets/${datasets[0].id}`) : handleUploadDataset()}
              sx={{
                backgroundColor: '#00B37E',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
              disabled={datasets.length === 0}
            >
              {datasets.length > 0 ? 'Create Evaluation' : 'Upload Dataset First'}
            </Button>
          </Box>
        </TabPanel>
      </Box>

      {/* Dataset options menu */}
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
        <MenuItem onClick={() => {
          handleMenuClose();
          if (selectedDataset) {
            router.push(`/datasets/${selectedDataset.id}`);
          }
        }}>
          <ListItemIcon>
            <AssessmentIcon fontSize="small" />
          </ListItemIcon>
          View Details
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: '#E5484D' }} />
          </ListItemIcon>
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* Delete dataset confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Delete Dataset?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete the dataset "{selectedDataset?.name}"? This action cannot be undone and will delete all associated evaluations.
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

      {/* Delete project confirmation dialog */}
      <Dialog
        open={projectDeleteDialogOpen}
        onClose={handleProjectDeleteCancel}
        aria-labelledby="project-delete-dialog-title"
        aria-describedby="project-delete-dialog-description"
      >
        <DialogTitle id="project-delete-dialog-title">
          {"Delete Project?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="project-delete-dialog-description">
            Are you sure you want to delete the project "{project?.name}"? This action cannot be undone and will delete all associated datasets and evaluations.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleProjectDeleteCancel} disabled={projectDeleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleProjectDeleteConfirm} 
            color="error" 
            autoFocus
            disabled={projectDeleteLoading}
          >
            {projectDeleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default ProjectDetail;
