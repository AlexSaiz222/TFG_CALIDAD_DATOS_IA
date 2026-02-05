import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  TextField,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI, projectsAPI } from '../../services/api';
import axios from 'axios';
import { Dataset, Project } from '../../types';

const DatasetsList = () => {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projects, setProjects] = useState<Record<number, Project>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Datos de ejemplo para usar cuando el endpoint falla
  const exampleDatasets: Dataset[] = [
    {
      id: 1,
      name: 'Customer Data Sample',
      description: 'Sample dataset with customer information',
      project_id: 1,
      file_path: '/data/customers.csv',
      file_size: 1024 * 1024 * 2.5, // 2.5 MB
      row_count: 5000,
      column_count: 12,
      schema: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      evaluation_count: 3,
      version: 1,
      is_latest: true,
    },
    {
      id: 2,
      name: 'Product Inventory',
      description: 'Current product inventory with stock levels',
      project_id: 1,
      file_path: '/data/inventory.csv',
      file_size: 1024 * 1024 * 1.8, // 1.8 MB
      row_count: 3200,
      column_count: 8,
      schema: [],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      evaluation_count: 1,
      version: 1,
      is_latest: true,
    },
    {
      id: 3,
      name: 'Sales Transactions 2024',
      description: 'All sales transactions from current year',
      project_id: 2,
      file_path: '/data/sales_2024.csv',
      file_size: 1024 * 1024 * 5.2, // 5.2 MB
      row_count: 12500,
      column_count: 15,
      schema: [],
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      evaluation_count: 2,
      version: 1,
      is_latest: true,
    },
  ];

  // Proyectos de ejemplo
  const exampleProjects: Record<number, Project> = {
    1: {
      id: 1,
      name: 'Customer Analytics',
      description: 'Analysis of customer data and behavior',
      owner_id: 1,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      dataset_count: 2
    },
    2: {
      id: 2,
      name: 'Sales Dashboard',
      description: 'Sales performance tracking and analysis',
      owner_id: 1,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      dataset_count: 1
    }
  };

  useEffect(() => {
    // Referencia para controlar si el componente está montado
    const isMountedRef = { current: true };
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      // Crear un controlador para cancelar peticiones
      const controller = new AbortController();
      
      // Establecer un timeout global para toda la operación
      const globalTimeoutId = setTimeout(() => {
        console.log('Timeout global alcanzado, cancelando todas las peticiones pendientes');
        controller.abort();
        
        // Solo actualizar el estado si el componente sigue montado
        if (isMountedRef.current) {
          setDatasets(exampleDatasets);
          setProjects(exampleProjects);
          setError('Se agotó el tiempo de espera. Mostrando datos de ejemplo.');
          setLoading(false);
        }
      }, 15000); // 15 segundos de timeout global

      try {
        // ESTRATEGIA Única: Usar datasetsAPI.getAllDatasets que es la que funciona
        console.log('Obteniendo datasets con datasetsAPI.getAllDatasets');
        const datasetsResponse = await datasetsAPI.getAllDatasets();
        const datasetsData = datasetsResponse?.data?.data ?? datasetsResponse?.data ?? [];
        
        // Solo continuar si el componente sigue montado
        if (!isMountedRef.current) return;
        
        if (Array.isArray(datasetsData) && datasetsData.length > 0) {
          console.log(`Obtenidos ${datasetsData.length} datasets correctamente`);
          setDatasets(datasetsData);
          
          // Extract unique project IDs
          const uniqueIds = new Set<number>();
          datasetsData.forEach(dataset => uniqueIds.add(dataset.project_id));
          const projectIds = Array.from(uniqueIds);
          
          // Fetch project details for each unique project ID
          const projectsMap: Record<number, Project> = {};
          
          await Promise.all(
            projectIds.map(async (projectId) => {
              try {
                const projectResponse = await projectsAPI.getProject(projectId);
                const projectData = projectResponse?.data?.data ?? projectResponse?.data ?? {};
                projectsMap[projectId] = projectData;
              } catch (err) {
                console.warn(`Error al obtener detalles del proyecto ${projectId}:`, err);
                // Use a placeholder for failed project fetches
                projectsMap[projectId] = { id: projectId, name: `Project ${projectId}` } as Project;
              }
            })
          );
          
          // Solo actualizar el estado si el componente sigue montado
          if (isMountedRef.current) {
            setProjects(projectsMap);
          }
        } else {
          console.warn('No se encontraron datasets, usando datos de ejemplo');
          setDatasets(exampleDatasets);
          setProjects(exampleProjects);
          setError('No se encontraron datasets en tus proyectos. Mostrando datos de ejemplo.');
        }
      } catch (err: any) {
        console.error('Error al obtener datasets:', err);
        
        // Solo actualizar el estado si el componente sigue montado
        if (isMountedRef.current) {
          // Si hay un error, usar datos de ejemplo
          console.log('Usando datos de ejemplo debido al error');
          setDatasets(exampleDatasets);
          setProjects(exampleProjects);
          
          // Mostrar mensaje de error más amigable
          setError('No se pudieron cargar los datasets del servidor. Mostrando datos de ejemplo para demostración.');
        }
      } finally {
        // Limpiar el timeout global si aún no se ha disparado
        clearTimeout(globalTimeoutId);
        
        // Solo actualizar el estado si el componente sigue montado
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    // Cleanup function para evitar actualizar el estado después de desmontar
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredDatasets = datasets.filter(dataset => {
    const searchLower = searchTerm.toLowerCase();
    return (
      dataset.name.toLowerCase().includes(searchLower) ||
      (dataset.description && dataset.description.toLowerCase().includes(searchLower)) ||
      (projects[dataset.project_id]?.name || '').toLowerCase().includes(searchLower)
    );
  });

  const handleCreateDataset = () => {
    router.push('/datasets/upload');
  };

  const handleViewDataset = (datasetId: number) => {
    router.push(`/datasets/${datasetId}`);
  };

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Datasets
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateDataset}
            sx={{
              backgroundColor: '#00B37E',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00A070',
              },
            }}
          >
            Create Dataset
          </Button>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
          }}
        >
          {error && (
            <Alert 
              severity="warning" 
              variant="outlined"
              sx={{ 
                mb: 3, 
                display: 'flex', 
                alignItems: 'center',
                '& .MuiAlert-icon': {
                  fontSize: '1.5rem',
                  color: '#FFB800',
                },
                border: '1px solid rgba(255, 184, 0, 0.3)',
                backgroundColor: 'rgba(255, 184, 0, 0.05)'
              }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Mostrando datos de ejemplo
                </Typography>
                <Typography variant="body2">
                  {error}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Nota: Puedes seguir explorando la interfaz con estos datos de demostración.
                </Typography>
              </Box>
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search datasets by name, description or project"
              variant="outlined"
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#999999' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                },
              }}
            />
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredDatasets.length > 0 ? (
            <TableContainer>
              <Table aria-label="datasets table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Version</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDatasets.map((dataset) => (
                    <TableRow 
                      key={dataset.id} 
                      hover 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 179, 126, 0.04)',
                        },
                      }}
                      onClick={() => handleViewDataset(dataset.id)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {dataset.name}
                          </Typography>
                          {dataset.is_latest && (
                            <Chip
                              label="Latest"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.7rem',
                                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                color: '#1976d2',
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={dataset.version_tag || `Versión ${dataset.version}`}>
                          <Chip
                            label={dataset.version_tag || `v${dataset.version}`}
                            size="small"
                            sx={{
                              backgroundColor: dataset.version > 1 ? 'rgba(156, 39, 176, 0.1)' : 'rgba(158, 158, 158, 0.1)',
                              color: dataset.version > 1 ? '#9c27b0' : '#757575',
                              fontWeight: 500,
                              minWidth: '40px',
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#555555',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dataset.description || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={projects[dataset.project_id]?.name || `Project ${dataset.project_id}`}
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(0, 179, 126, 0.1)',
                            color: '#00B37E',
                            fontWeight: 500,
                            '&:hover': {
                              backgroundColor: 'rgba(0, 179, 126, 0.2)',
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${dataset.project_id}`);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        {dataset.file_size ? `${(dataset.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Dataset">
                          <IconButton 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDataset(dataset.id);
                            }}
                            size="small"
                            sx={{
                              color: '#00B37E',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 179, 126, 0.1)',
                              },
                            }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                {searchTerm ? 'No datasets match your search criteria.' : 'No datasets available.'}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateDataset}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                Create Dataset
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </MainLayout>
  );
};

export default DatasetsList;
