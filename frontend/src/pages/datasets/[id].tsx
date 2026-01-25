import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  LinearProgress,
  Alert,
  Paper,
  Divider,
  IconButton,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI, evaluationsAPI, projectsAPI } from '../../services/api';
import { Dataset, Evaluation, Issue } from '../../types';

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
      id={`dataset-tabpanel-${index}`}
      aria-labelledby={`dataset-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const DatasetDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const datasetId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [runningEvaluation, setRunningEvaluation] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    const fetchDatasetData = async () => {
      // Check if datasetId is valid
      if (datasetId === undefined || isNaN(datasetId)) {
        console.error('Invalid dataset ID:', datasetId);
        setLoading(false);
        setError('ID de dataset inválido o no especificado.');
        return;
      }

      // Evitar doble fetch en modo desarrollo (React Strict Mode)
      if (fetchedRef.current) {
        return;
      }
      fetchedRef.current = true;

      setLoading(true);
      setError(null);
      setPreviewError(null);

      try {
        console.log('Fetching dataset with ID:', datasetId);
        
        // Fetch dataset details
        const datasetResponse = await datasetsAPI.getDataset(datasetId);
        
        // Check if we got a valid response
        if (!datasetResponse?.data) {
          console.error('No data returned for dataset:', datasetId);
          setError('No se pudo cargar la información del dataset.');
          setLoading(false);
          return;
        }
        
        // Normalizar el objeto dataset para manejar diferentes formatos de respuesta
        const raw = datasetResponse?.data?.data ?? datasetResponse?.data ?? {};
        const normalized: Dataset = {
          id: raw.id,
          name: raw.name || 'Dataset sin nombre',
          description: raw.description ?? '',
          project_id: raw.project_id ?? raw.projectId,
          file_path: raw.file_path ?? raw.filePath ?? '',
          file_size: raw.file_size ?? raw.fileSize ?? 0,
          row_count: raw.row_count ?? raw.rowCount ?? raw.rows ?? 0,
          column_count: raw.column_count ?? raw.columnCount ?? (Array.isArray(raw.columns) ? raw.columns.length : 0),
          schema: raw.schema ?? [],
          created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
          updated_at: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
          evaluation_count: raw.evaluation_count ?? raw.evaluationCount ?? 0
        };
        
        setDataset(normalized);

        // Fetch project details to get the project name
        try {
          if (normalized.project_id) {
            const projectResponse = await projectsAPI.getProject(normalized.project_id);
            if (projectResponse?.data) {
              // Extract project name from response
              const projectData = projectResponse.data.data || projectResponse.data;
              setProjectName(projectData.name || `Project ${normalized.project_id}`);
            }
          }
        } catch (projectError) {
          console.warn('Error fetching project details:', projectError);
          // Don't fail the whole page load if project details can't be fetched
          setProjectName(`Project ${normalized.project_id}`);
        }

        // Fetch evaluations for this dataset
        try {
          const evaluationsResponse = await evaluationsAPI.getEvaluations(datasetId);
          // Extraer las evaluaciones de la estructura de respuesta
          const evaluationsData = evaluationsResponse?.data?.data || evaluationsResponse?.data || [];
          setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : []);
          
          // Fetch issues if there are evaluations
          if (Array.isArray(evaluationsData) && evaluationsData.length > 0) {
            const latestEvaluation = evaluationsData[0];
            try {
              const issuesResponse = await evaluationsAPI.getIssues(latestEvaluation.id);
              // Extraer las issues de la estructura de respuesta
              const issuesData = issuesResponse?.data?.data || issuesResponse?.data || [];
              setIssues(Array.isArray(issuesData) ? issuesData : []);
            } catch (issueError) {
              console.warn('Error fetching issues:', issueError);
              // Don't fail the whole page load for issues
            }
          }
        } catch (evalError: any) {
          console.warn('Error fetching evaluations:', evalError);
          
          // Si es un error 404, simplemente consideramos que no hay evaluaciones
          if (evalError?.response?.status === 404) {
            console.log('No evaluations endpoint found, treating as empty evaluations');
            setEvaluations([]);
          } else {
            // Otro tipo de error, pero no bloqueamos la carga de la página
            console.error('Error al cargar evaluaciones:', evalError?.message);
          }
        }

        // Fetch preview data
        try {
          const previewResponse = await datasetsAPI.previewDataset(datasetId);
          if (previewResponse?.data?.data) {
            setPreviewData(previewResponse.data.data);
            if (previewResponse.data.columns) {
              setPreviewColumns(previewResponse.data.columns);
            } else if (previewResponse.data.data.length > 0) {
              // Si no hay columnas explícitas pero sí hay datos, usar las claves del primer objeto
              setPreviewColumns(Object.keys(previewResponse.data.data[0] || {}));
            }
          }
        } catch (previewError: any) {
          console.warn('Error fetching preview data:', previewError);
          
          // Extraer mensaje de error para mostrar al usuario
          const errorMessage = previewError?.response?.data?.message || 
                              previewError?.message || 
                              'No se pudo cargar la vista previa';
          
          // Si es un error de CSV sin columnas o vacío, mostrar mensaje más amigable
          if (errorMessage.includes('No columns to parse') || 
              errorMessage.includes('Error reading CSV')) {
            setPreviewError('El archivo CSV podría estar vacío o tener un formato incorrecto. ' + 
                          'Verifica que tenga encabezados y contenido válido.');
          } else {
            setPreviewError(errorMessage);
          }
        }

        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching dataset data:', error);
        setError(error.response?.data?.message || 'Failed to load dataset data. Please try again.');
        setLoading(false);
      }
    };

    // Only fetch if router is ready and we have an ID
    if (router.isReady && datasetId !== undefined) {
      fetchDatasetData();
    } else if (router.isReady && (datasetId === undefined || isNaN(datasetId))) {
      // If router is ready but ID is invalid, show error
      setLoading(false);
      setError('ID de dataset inválido o no especificado.');
    }
  }, [datasetId, router.isReady]);

  // Ref para mantener las evaluaciones actualizadas sin causar re-renders del useEffect
  const evaluationsRef = useRef(evaluations);
  evaluationsRef.current = evaluations;

  // Polling automático para evaluaciones en proceso
  useEffect(() => {
    // Verificar si hay evaluaciones pendientes o en proceso
    const hasPendingEvaluations = evaluations.some(
      (e: Evaluation) => e.status === 'pending' || e.status === 'processing'
    );

    if (!hasPendingEvaluations) return;

    // Hacer polling cada 3 segundos (más lento para evitar sobrecarga)
    const pollInterval = setInterval(async () => {
      const currentEvaluations = evaluationsRef.current;
      const pendingIds = currentEvaluations
        .filter((e: Evaluation) => e.status === 'pending' || e.status === 'processing')
        .map((e: Evaluation) => e.id);

      if (pendingIds.length === 0) {
        clearInterval(pollInterval);
        return;
      }

      try {
        // Actualizar el estado de cada evaluación pendiente
        for (const evalId of pendingIds) {
          try {
            const statusResponse = await evaluationsAPI.getEvaluationStatus(evalId);
            // La respuesta tiene estructura: { success, data: { status: { status, progress, current_step, ... } } }
            const statusData = statusResponse.data?.data?.status || statusResponse.data?.data || statusResponse.data;
            
            console.log(`Polling evaluation ${evalId}:`, statusData);
            
            setEvaluations((prev: Evaluation[]) => prev.map((evaluation: Evaluation) => {
              if (evaluation.id === evalId) {
                const newStatus = statusData.status;
                const wasCompleted = evaluation.status !== 'completed' && newStatus === 'completed';
                const wasFailed = evaluation.status !== 'failed' && newStatus === 'failed';
                
                if (wasCompleted || wasFailed) {
                  setRunningEvaluation(false);
                }
                
                if (wasCompleted) {
                  // Cargar issues cuando se complete
                  evaluationsAPI.getIssues(evalId)
                    .then(issuesResponse => {
                      const issuesData = issuesResponse.data?.data || issuesResponse.data || [];
                      setIssues(issuesData);
                    })
                    .catch(err => console.warn('Error fetching issues:', err));
                }
                
                return {
                  ...evaluation,
                  status: statusData.status,
                  progress: statusData.progress,
                  current_step: statusData.current_step,
                  completed_at: statusData.completed_at,
                  started_at: statusData.started_at,
                  error: statusData.error,
                };
              }
              return evaluation;
            }));
          } catch (err) {
            console.warn(`Error polling evaluation ${evalId}:`, err);
          }
        }
      } catch (error) {
        console.error('Error in evaluation polling:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [evaluations.filter((e: Evaluation) => e.status === 'pending' || e.status === 'processing').length]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!dataset) return;
    
    setDeleteLoading(true);
    try {
      await datasetsAPI.deleteDataset(dataset.id);
      
      // Redirect to project page
      router.push(`/projects/${dataset.project_id}`);
    } catch (error) {
      console.error('Error deleting dataset:', error);
      setError('Failed to delete dataset. Please try again later.');
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!dataset) return;
    
    setRunningEvaluation(true);
    setError(null);
    
    try {
      // Pass an empty metrics config as the second parameter
      const response = await evaluationsAPI.createEvaluation(dataset.id, {});
      
      // Extraer la evaluación de la estructura de respuesta
      // La respuesta tiene formato: { success: true, data: { evaluation: {...} } }
      const newEvaluation = response.data?.data?.evaluation || response.data;
      
      console.log('Evaluation response:', response.data);
      console.log('Extracted evaluation:', newEvaluation);
      
      // Add the new evaluation to the list - el useEffect de polling se encargará de actualizar el estado
      setEvaluations((prev: Evaluation[]) => [newEvaluation, ...prev]);
      
      // No necesitamos polling aquí - el useEffect de polling automático se encarga de todo
    } catch (error: any) {
      console.error('Error running evaluation:', error);
      setError(error.response?.data?.message || 'Failed to run evaluation. Please try again.');
      setRunningEvaluation(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: '#00B37E' }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: '#E5484D' }} />;
      case 'running':
        return <HourglassEmptyIcon sx={{ color: '#FFB800' }} />;
      default:
        return <HourglassEmptyIcon sx={{ color: '#999999' }} />;
    }
  };

  const getIssueSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon sx={{ color: '#E5484D' }} />;
      case 'medium':
        return <WarningIcon sx={{ color: '#FFB800' }} />;
      case 'low':
        return <WarningIcon sx={{ color: '#00B37E' }} />;
      default:
        return <WarningIcon sx={{ color: '#999999' }} />;
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

  if (error || !dataset) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Dataset Not Found
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Dataset not found'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: '#00B37E',
              color: '#FFFFFF',
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
          <IconButton onClick={() => router.push(`/projects/${dataset.project_id}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {dataset.name}
            </Typography>
            {dataset.description && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {dataset.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              sx={{
                borderColor: '#E5484D',
                color: '#E5484D',
                '&:hover': {
                  borderColor: '#D03E43',
                  backgroundColor: 'rgba(229, 72, 77, 0.04)',
                },
              }}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
              onClick={handleRunEvaluation}
              disabled={runningEvaluation}
              sx={{
                backgroundColor: '#00B37E',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
            >
              {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Run evaluation'}
            </Button>
          </Box>
        </Box>

        {/* Dataset Info Card */}
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
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Project
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': {
                    color: '#00B37E',
                  },
                }}
                onClick={() => router.push(`/projects/${dataset.project_id}`)}
              >
                {projectName || `Project ${dataset.project_id}`}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Rows
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {typeof dataset.row_count === 'number' ? dataset.row_count.toLocaleString() : '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Columns
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {typeof dataset.column_count === 'number' ? dataset.column_count : '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Uploaded
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : '—'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="dataset tabs"
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
            <Tab label="Preview" id="dataset-tab-0" aria-controls="dataset-tabpanel-0" />
            <Tab label="Evaluations" id="dataset-tab-1" aria-controls="dataset-tabpanel-1" />
            <Tab label="Issues" id="dataset-tab-2" aria-controls="dataset-tabpanel-2" />
          </Tabs>
        </Box>

        {/* Preview Tab */}
        <TabPanel value={tabValue} index={0}>
          {previewError ? (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {previewError}
            </Alert>
          ) : null}
          
          {previewData.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table stickyHeader aria-label="dataset preview table" size="small">
                <TableHead>
                  <TableRow>
                    {previewColumns.map((column, index) => (
                      <TableCell key={index} sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {previewColumns.map((column, colIndex) => (
                        <TableCell key={`${rowIndex}-${colIndex}`}>
                          {row[column] !== null && row[column] !== undefined ? String(row[column]) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ color: '#555555' }}>
                {previewError ? 'No se pudo cargar la vista previa del dataset.' : 'No hay datos de vista previa disponibles.'}
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Evaluations Tab */}
        <TabPanel value={tabValue} index={1}>
          {evaluations.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table aria-label="evaluations table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Issues</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id} hover>
                      <TableCell>{evaluation.id}</TableCell>
                      <TableCell>
                        {(evaluation.status === 'pending' || evaluation.status === 'processing') ? (
                          <Tooltip title={evaluation.current_step || (evaluation.status === 'pending' ? 'Esperando worker de Celery...' : 'Procesando...')} arrow>
                            <Box sx={{ minWidth: 200 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                {evaluation.status === 'pending' ? (
                                  <CircularProgress size={16} sx={{ color: '#FFB800' }} />
                                ) : (
                                  <HourglassEmptyIcon sx={{ color: '#00B37E', fontSize: 18 }} />
                                )}
                                <Typography variant="body2" sx={{ 
                                  fontWeight: 500,
                                  color: evaluation.status === 'pending' ? '#FFB800' : '#00B37E' 
                                }}>
                                  {evaluation.status === 'pending' ? 'En cola' : 'Procesando'}
                                </Typography>
                                {evaluation.status === 'processing' && (
                                  <Typography variant="body2" sx={{ color: '#666', ml: 'auto' }}>
                                    {evaluation.progress || 0}%
                                  </Typography>
                                )}
                              </Box>
                              <LinearProgress 
                                variant={evaluation.status === 'pending' ? 'indeterminate' : 'determinate'}
                                value={evaluation.progress || 0}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#E0E0E0',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 3,
                                    backgroundColor: evaluation.status === 'pending' ? '#FFB800' : '#00B37E',
                                  },
                                }}
                              />
                              <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                                {evaluation.current_step || (evaluation.status === 'pending' ? 'Esperando en cola...' : 'Procesando...')}
                              </Typography>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getStatusIcon(evaluation.status)}
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {evaluation.status}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{new Date(evaluation.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {(() => {
                          if (evaluation.status === 'completed' && evaluation.started_at && evaluation.completed_at) {
                            const start = new Date(evaluation.started_at).getTime();
                            const end = new Date(evaluation.completed_at).getTime();
                            const durationMs = end - start;
                            const seconds = Math.floor(durationMs / 1000);
                            const minutes = Math.floor(seconds / 60);
                            const remainingSeconds = seconds % 60;
                            if (minutes > 0) {
                              return `${minutes}m ${remainingSeconds}s`;
                            }
                            return `${seconds}s`;
                          } else if (evaluation.status === 'processing' && evaluation.started_at) {
                            const start = new Date(evaluation.started_at).getTime();
                            const now = Date.now();
                            const durationMs = now - start;
                            const seconds = Math.floor(durationMs / 1000);
                            const minutes = Math.floor(seconds / 60);
                            const remainingSeconds = seconds % 60;
                            if (minutes > 0) {
                              return `${minutes}m ${remainingSeconds}s...`;
                            }
                            return `${seconds}s...`;
                          }
                          return '-';
                        })()}
                      </TableCell>
                      <TableCell>{evaluation.issue_count || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => router.push(`/evaluations/${evaluation.id}`)}
                          disabled={evaluation.status !== 'completed'}
                          sx={{
                            backgroundColor: '#00B37E',
                            color: '#FFFFFF',
                            mr: 1,
                            '&:hover': {
                              backgroundColor: '#00A070',
                            },
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            // Fetch issues for this evaluation
                            evaluationsAPI.getIssues(evaluation.id)
                              .then(response => {
                                setIssues(response.data);
                                setTabValue(2); // Switch to Issues tab
                              })
                              .catch(error => {
                                console.error('Error fetching issues:', error);
                                setError('Failed to fetch issues for this evaluation.');
                              });
                          }}
                          disabled={evaluation.status !== 'completed'}
                          sx={{
                            borderColor: '#00B37E',
                            color: '#00B37E',
                            '&:hover': {
                              borderColor: '#00A070',
                              backgroundColor: 'rgba(0, 179, 126, 0.04)',
                            },
                          }}
                        >
                          View Issues
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                No evaluations have been run for this dataset.
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
                onClick={handleRunEvaluation}
                disabled={runningEvaluation}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'run Evaluation'}
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Issues Tab */}
        <TabPanel value={tabValue} index={2}>
          {issues.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table aria-label="issues table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getIssueSeverityIcon(issue.severity)}
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              textTransform: 'capitalize',
                              color: issue.severity === 'high' ? '#E5484D' : 
                                     issue.severity === 'medium' ? '#FFB800' : '#00B37E'
                            }}
                          >
                            {issue.severity}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{issue.metric_id ? `Metric ${issue.metric_id}` : 'System'}</TableCell>
                      <TableCell>{issue.affected_columns && issue.affected_columns.length > 0 ? issue.affected_columns[0] : 'N/A'}</TableCell>
                      <TableCell>{issue.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                {evaluations.length > 0 
                  ? 'No issues found in the latest evaluation.' 
                  : 'Run an evaluation to identify data quality issues.'}
              </Typography>
              {evaluations.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
                  onClick={handleRunEvaluation}
                  disabled={runningEvaluation}
                  sx={{
                    backgroundColor: '#00B37E',
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00A070',
                    },
                  }}
                >
                  {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Run evaluation'}
                </Button>
              )}
            </Box>
          )}
        </TabPanel>
      </Box>

      {/* Delete confirmation dialog */}
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
            Are you sure you want to delete the dataset "{dataset.name}"? This action cannot be undone and will delete all associated evaluations and issues.
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

export default DatasetDetail;
