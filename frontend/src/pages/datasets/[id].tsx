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
  FileUpload as FileUploadIcon,
  History as HistoryIcon,
  VisibilityOff as VisibilityOffIcon,
  ViewList as ViewListIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import DatasetVersionHistory from '../../components/DatasetVersionHistory';
import DatasetLineageCanvas from '../../components/DatasetLineageCanvas';
import DataProfilingTab from '../../components/DataProfilingTab';
import { datasetsAPI, evaluationsAPI, projectsAPI, analysisAPI } from '../../services/api';
import { Dataset, Evaluation, Issue, AnalysisRun } from '../../types';
import QualityGateBadge from '../../components/QualityGateBadge';

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
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [lineageView, setLineageView] = useState<'list' | 'canvas'>('list');
  const [runningEvaluation, setRunningEvaluation] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [projectMetricsConfig, setProjectMetricsConfig] = useState<any[]>([]);
  const [sensitiveColumns, setSensitiveColumns] = useState<string[]>([]);
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
          sensitive_columns: raw.sensitive_columns ?? raw.sensitiveColumns ?? [],
          created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
          updated_at: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
          evaluation_count: raw.evaluation_count ?? raw.evaluationCount ?? 0,
          // Versioning fields
          parent_dataset_id: raw.parent_dataset_id ?? raw.parentDatasetId,
          version: raw.version ?? 1,
          version_tag: raw.version_tag ?? raw.versionTag,
          is_latest: raw.is_latest ?? raw.isLatest ?? true,
        };

        setDataset(normalized);

        // Fetch project name for breadcrumb
        if (normalized.project_id) {
          try {
            const projectResponse = await projectsAPI.getProject(normalized.project_id);
            const projectData = projectResponse.data.data || projectResponse.data;
            setProjectName(projectData.name || `Project ${normalized.project_id}`);
            if (Array.isArray(projectData.metrics_config)) {
              setProjectMetricsConfig(projectData.metrics_config);
            }
          } catch (projErr) {
            console.warn('Could not load project name:', projErr);
            setProjectName(`Project ${normalized.project_id}`);
          }
        }

        // Set sensitive columns from dataset
        if (normalized.sensitive_columns && Array.isArray(normalized.sensitive_columns)) {
          setSensitiveColumns(normalized.sensitive_columns);
        }

        // Fetch evaluations for this dataset
        try {
          const evaluationsResponse = await evaluationsAPI.getEvaluations(datasetId);
          // Extraer las evaluaciones de la estructura de respuesta
          const evaluationsData = evaluationsResponse?.data?.data || evaluationsResponse?.data || [];
          // Sort evaluations by ID descending (newest first)
          const sortedEvaluations = Array.isArray(evaluationsData)
            ? evaluationsData.sort((a: Evaluation, b: Evaluation) => b.id - a.id)
            : [];
          setEvaluations(sortedEvaluations);

          // Fetch issues if there are evaluations
          if (Array.isArray(evaluationsData) && evaluationsData.length > 0) {
            const latestEvaluation = evaluationsData[0];
            try {
              const issuesResponse = await evaluationsAPI.getIssues(latestEvaluation.id);
              // Extraer las issues de la estructura de respuesta
              const issuesData = issuesResponse?.data?.data?.issues || issuesResponse?.data?.data || issuesResponse?.data || [];
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

        // Fetch AnalysisRuns for this dataset (server-side filtered)
        if (normalized.project_id && datasetId) {
          try {
            const runsResponse = await analysisAPI.getProjectAnalysisRuns(
              normalized.project_id,
              { dataset_id: datasetId, per_page: 100 }
            );
            const runsData = runsResponse?.data?.data?.analysis_runs || runsResponse?.data?.data || runsResponse?.data || [];
            const datasetRuns: AnalysisRun[] = Array.isArray(runsData)
              ? [...runsData].sort((a: AnalysisRun, b: AnalysisRun) => b.id - a.id)
              : [];
            setAnalysisRuns(datasetRuns);
          } catch (runError) {
            console.warn('Error fetching analysis runs:', runError);
            setAnalysisRuns([]);
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
            console.log(`Quality score from status:`, statusData.quality_score, typeof statusData.quality_score);

            setEvaluations((prev: Evaluation[]) => prev.map((evaluation: Evaluation) => {
              if (evaluation.id === evalId) {
                const newStatus = statusData.status;
                const wasCompleted = evaluation.status !== 'completed' && newStatus === 'completed';
                const wasFailed = evaluation.status !== 'failed' && newStatus === 'failed';

                if (wasCompleted || wasFailed) {
                  setRunningEvaluation(false);
                }

                // Actualizar el AnalysisRun correspondiente en la tabla
                setAnalysisRuns((prevRuns: AnalysisRun[]) =>
                  prevRuns.map((r: AnalysisRun) => {
                    if (r.id === statusData.analysis_run_id || r.id === evalId) {
                      return {
                        ...r,
                        status: (statusData.status?.toUpperCase() ?? r.status) as AnalysisRun['status'],
                        progress: statusData.progress ?? r.progress,
                        current_step: statusData.current_step ?? r.current_step,
                        quality_score: statusData.quality_score ?? r.quality_score,
                        quality_gate_status: statusData.quality_gate_status ?? r.quality_gate_status,
                        total_issues_count: statusData.total_issues_count ?? r.total_issues_count,
                        new_issues_count: statusData.new_issues_count ?? r.new_issues_count,
                        fixed_issues_count: statusData.fixed_issues_count ?? r.fixed_issues_count,
                        completed_at: statusData.completed_at ?? r.completed_at,
                        started_at: statusData.started_at ?? r.started_at,
                      };
                    }
                    return r;
                  })
                );

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
                  issue_count: statusData.issue_count,
                  quality_score: statusData.quality_score,
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

  // Polling dedicado para AnalysisRuns en PENDING/RUNNING
  const analysisRunsRef = useRef(analysisRuns);
  analysisRunsRef.current = analysisRuns;

  useEffect(() => {
    const hasPending = analysisRuns.some(
      (r: AnalysisRun) => r.status === 'PENDING' || r.status === 'RUNNING'
    );
    if (!hasPending) return;

    const pollInterval = setInterval(async () => {
      const current = analysisRunsRef.current;
      const pendingRuns = current.filter(
        (r: AnalysisRun) => r.status === 'PENDING' || r.status === 'RUNNING'
      );
      if (pendingRuns.length === 0) {
        clearInterval(pollInterval);
        return;
      }

      for (const run of pendingRuns) {
        try {
          const res = await analysisAPI.getAnalysisRunStatus(run.id);
          const d = res.data?.data || res.data;
          const newStatus: string = (d.status ?? run.status).toUpperCase();
          const wasCompleted = run.status !== 'COMPLETED' && newStatus === 'COMPLETED';
          const wasFailed = run.status !== 'FAILED' && newStatus === 'FAILED';

          if (wasCompleted || wasFailed) {
            setRunningEvaluation(false);
          }

          setAnalysisRuns((prev: AnalysisRun[]) =>
            prev.map((r: AnalysisRun) => {
              if (r.id !== run.id) return r;
              return {
                ...r,
                status: newStatus as AnalysisRun['status'],
                progress: d.progress ?? r.progress,
                current_step: d.current_step ?? r.current_step,
                quality_score: d.quality_score ?? r.quality_score,
                quality_gate_status: d.quality_gate_status ?? r.quality_gate_status,
                total_issues_count: d.total_issues_count ?? r.total_issues_count,
                new_issues_count: d.new_issues_count ?? r.new_issues_count,
                fixed_issues_count: d.fixed_issues_count ?? r.fixed_issues_count,
                completed_at: d.completed_at ?? r.completed_at,
                started_at: d.started_at ?? r.started_at,
              };
            })
          );
        } catch (err) {
          console.warn(`Error polling analysis run ${run.id}:`, err);
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [analysisRuns.filter((r: AnalysisRun) => r.status === 'PENDING' || r.status === 'RUNNING').length]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // If switching to Issues tab (index 3), load issues from latest completed evaluation
    if (newValue === 3 && evaluations.length > 0) {
      const latestCompletedEval = evaluations.find((e: Evaluation) => e.status === 'completed');
      if (latestCompletedEval) {
        evaluationsAPI.getIssues(latestCompletedEval.id)
          .then(response => {
            const data = response.data?.data?.issues || response.data?.data || response.data || [];
            setIssues(Array.isArray(data) ? data : []);
          })
          .catch(error => {
            console.error('Error fetching issues:', error);
            setError('Failed to fetch issues for this evaluation.');
          });
      }
    }
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

    if (projectMetricsConfig.length === 0) {
      setError('Este proyecto no tiene métricas configuradas. Ve a la configuración del proyecto para añadir métricas antes de ejecutar una evaluación.');
      return;
    }

    setRunningEvaluation(true);
    setEvalError(null);

    try {
      // Preparar métricas con el mismo cleaning que el endpoint legacy
      const metricsConfig: any = projectMetricsConfig;
      const rawMetrics: any[] = Array.isArray(metricsConfig?.metrics)
        ? metricsConfig.metrics
        : Array.isArray(metricsConfig)
        ? metricsConfig
        : [];
      const cleanedMetrics = rawMetrics.map((metric: any) => {
        const cleanedParams: any = {};
        Object.entries(metric.parameters || {}).forEach(([key, value]) => {
          if (value !== null && value !== undefined) cleanedParams[key] = value;
        });
        return { id: metric.name || metric.id, name: metric.name, parameters: cleanedParams };
      });

      // Usar el endpoint Sonar-Lite que devuelve analysis_run_id directamente
      const response = await analysisAPI.startAnalysis(
        dataset.project_id,
        dataset.id,
        cleanedMetrics,
        metricsConfig?.options || {}
      );

      const newRunId = response.data?.data?.analysis_run_id;
      console.log('Analysis run started:', response.data);

      // Añadir AnalysisRun optimista para que aparezca inmediatamente en la tabla
      if (newRunId) {
        const optimisticRun: AnalysisRun = {
          id: newRunId,
          project_id: dataset.project_id,
          dataset_id: dataset.id,
          status: 'PENDING',
          progress: 0,
          critical_issues_count: 0,
          total_issues_count: 0,
          new_issues_count: 0,
          fixed_issues_count: 0,
          recurrent_issues_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setAnalysisRuns((prev: AnalysisRun[]) => [optimisticRun, ...prev]);
      }
    } catch (error: any) {
      console.error('Error running evaluation:', error);
      setEvalError(error.response?.data?.message || 'Error al lanzar la evaluación. Por favor, inténtalo de nuevo.');
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
              Dataset no encontrado
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Dataset no encontrado'}</Alert>
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
            Volver a proyectos
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout currentPage={dataset.name}>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/projects/${dataset.project_id}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {dataset.name}
              </Typography>
              <Chip
                label={dataset.version_tag || `v${dataset.version}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(23, 69, 79, 0.1)',
                  color: '#17454F',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              />
              {dataset.is_latest && (
                <Chip
                  label="Latest"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 179, 126, 0.1)',
                    color: '#00B37E',
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>
            {dataset.description && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {dataset.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={() => router.push(`/datasets/upload?parentId=${dataset.id}&projectId=${dataset.project_id}`)}
              sx={{
                borderColor: '#17454F',
                color: '#17454F',
                '&:hover': {
                  borderColor: '#0f2f36',
                  backgroundColor: 'rgba(23, 69, 79, 0.04)',
                },
              }}
            >
              Nueva versión
            </Button>
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
              {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Ejecutar evaluación'}
            </Button>
          </Box>
        </Box>

        {/* Inline evaluation error - does NOT trigger full-page error view */}
        {evalError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEvalError(null)}>
            {evalError}
          </Alert>
        )}

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
            <Tab label="Data Profiling" id="dataset-tab-1" aria-controls="dataset-tabpanel-1" />
            <Tab label="Evaluaciones" id="dataset-tab-2" aria-controls="dataset-tabpanel-2" />
            <Tab label="Issues" id="dataset-tab-3" aria-controls="dataset-tabpanel-3" />
            <Tab label="Versiones & Linaje" id="dataset-tab-4" aria-controls="dataset-tabpanel-4" />
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
            <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 300, overflow: 'auto' }}>
              <Table stickyHeader aria-label="dataset preview table" size="small">
                <TableHead>
                  <TableRow>
                    {previewColumns.map((column, index) => {
                      const isSensitive = sensitiveColumns.includes(column);
                      return (
                        <TableCell key={index} sx={{ fontWeight: 600, backgroundColor: isSensitive ? 'rgba(229,72,77,0.06)' : '#F5F5F5' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {column}
                            {isSensitive && (
                              <Tooltip title="Columna sensible – valores ofuscados">
                                <VisibilityOffIcon sx={{ fontSize: 14, color: '#E5484D' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {previewColumns.map((column, colIndex) => {
                        const isSensitive = sensitiveColumns.includes(column);
                        const rawValue = row[column] !== null && row[column] !== undefined ? String(row[column]) : '';
                        return (
                          <TableCell key={`${rowIndex}-${colIndex}`} sx={isSensitive ? { filter: 'blur(5px)', userSelect: 'none' } : undefined}>
                            {isSensitive ? '••••••' : rawValue}
                          </TableCell>
                        );
                      })}
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

        {/* Data Profiling Tab */}
        <TabPanel value={tabValue} index={1}>
          <DataProfilingTab datasetId={dataset.id} sensitiveColumns={sensitiveColumns} />
        </TabPanel>

        {/* Evaluations Tab — shows AnalysisRuns for this dataset */}
        <TabPanel value={tabValue} index={2}>
          {analysisRuns.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 200, overflow: 'auto' }}>
              <Table aria-label="analysis runs table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duraci&oacute;n</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Quality Gate</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Issues</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysisRuns.map((run) => {
                    const isPending = run.status === 'PENDING';
                    const isRunning = run.status === 'RUNNING';
                    const isActive = isPending || isRunning;
                    const dur = (() => {
                      if (run.started_at && run.completed_at) {
                        const s = Math.floor((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000);
                        return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
                      }
                      if (isRunning) return 'En curso…';
                      return '—';
                    })();
                    const sc = run.quality_score;
                    const scColor = sc == null ? '#888' : sc >= 80 ? '#00B37E' : sc >= 60 ? '#FFB800' : '#E5484D';
                    return (
                      <TableRow key={run.id} hover sx={isActive ? { backgroundColor: 'rgba(0,179,126,0.04)' } : {}}>
                        <TableCell>{run.id}</TableCell>
                        <TableCell>{new Date(run.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell>{dur}</TableCell>
                        <TableCell>
                          {isActive ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={14} thickness={5} sx={{ color: isPending ? '#FFB800' : '#00B37E' }} />
                              <Typography variant="body2" sx={{ color: isPending ? '#FFB800' : '#00B37E', fontWeight: 600, fontSize: 12 }}>
                                {isPending ? 'En cola' : `Ejecutando ${run.progress ?? 0}%`}
                              </Typography>
                            </Box>
                          ) : (
                            <QualityGateBadge status={run.quality_gate_status} size="small" showIssuesCounts={false} />
                          )}
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Box>
                              <Typography variant="body2" sx={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>
                                {run.current_step ?? (isPending ? 'Esperando worker…' : 'Procesando…')}
                              </Typography>
                              {isRunning && (
                                <LinearProgress
                                  variant={run.progress ? 'determinate' : 'indeterminate'}
                                  value={run.progress ?? 0}
                                  sx={{ mt: 0.5, height: 3, borderRadius: 2, backgroundColor: 'rgba(0,179,126,0.15)', '& .MuiLinearProgress-bar': { backgroundColor: '#00B37E' } }}
                                />
                              )}
                            </Box>
                          ) : sc != null ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: scColor }}>{sc.toFixed(1)}%</Typography>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#888' }}>{'—'}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{run.total_issues_count ?? 0}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={isActive}
                            onClick={() => router.push(`/evaluations/${run.id}`)}
                            sx={{ backgroundColor: '#00B37E', color: '#FFFFFF', '&:hover': { backgroundColor: '#00A070' }, '&.Mui-disabled': { backgroundColor: '#CCCCCC', color: '#888' } }}
                          >
                            {isActive ? 'Procesando…' : 'Ver detalles'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ color: '#555555' }}>
                No hay evaluaciones ejecutadas para este dataset
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Issues Tab */}
        <TabPanel value={tabValue} index={3}>
          {issues.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 200, overflow: 'auto' }}>
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
                      <TableCell sx={{ textTransform: 'capitalize' }}>{issue.issue_type || 'System'}</TableCell>
                      <TableCell>
                        {issue.affected_columns && issue.affected_columns.length > 0
                          ? issue.affected_columns.map((col: any) => {
                            if (typeof col === 'string') return col;
                            if (col?.column) return col.column;
                            if (col?.name) return col.name;
                            return JSON.stringify(col);
                          }).join(', ')
                          : 'N/A'}
                      </TableCell>
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
                  ? 'No hay issues encontrados en la última evaluación'
                  : 'Ejecuta una evaluación para identificar problemas de calidad de datos'}
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
                  {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Ejecuta una evaluación'}
                </Button>
              )}
            </Box>
          )}
        </TabPanel>

        {/* Versions & Lineage Tab — unified */}
        <TabPanel value={tabValue} index={4}>
          {/* View toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {lineageView === 'list' ? 'Historial de versiones' : 'Linaje visual'}
            </Typography>
            <Box sx={{ display: 'flex', border: '1px solid #E0E0E0', borderRadius: 1.5, overflow: 'hidden' }}>
              <Box
                onClick={() => setLineageView('list')}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 0.75,
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                  backgroundColor: lineageView === 'list' ? '#00B37E' : 'transparent',
                  color: lineageView === 'list' ? '#fff' : '#555',
                  transition: 'all 0.15s',
                  '&:hover': lineageView !== 'list' ? { backgroundColor: '#F5F5F5' } : {},
                }}
              >
                <ViewListIcon sx={{ fontSize: 17 }} />
                Lista
              </Box>
              <Box
                onClick={() => setLineageView('canvas')}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 0.75,
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                  backgroundColor: lineageView === 'canvas' ? '#00B37E' : 'transparent',
                  color: lineageView === 'canvas' ? '#fff' : '#555',
                  borderLeft: '1px solid #E0E0E0',
                  transition: 'all 0.15s',
                  '&:hover': lineageView !== 'canvas' ? { backgroundColor: '#F5F5F5' } : {},
                }}
              >
                <AccountTreeIcon sx={{ fontSize: 17 }} />
                Canvas
              </Box>
            </Box>
          </Box>

          {lineageView === 'list' ? (
            <DatasetVersionHistory
              datasetId={dataset.id}
              projectId={dataset.project_id}
              onCompare={(versionA, versionB) => {
                router.push(`/datasets/${versionA}?compare=${versionB}`);
              }}
            />
          ) : (
            <DatasetLineageCanvas
              datasetId={dataset.id}
              projectId={dataset.project_id}
              currentDatasetId={dataset.id}
            />
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
            Estás seguro de que quieres eliminar el dataset "{dataset.name}"? Esta acción no se puede deshacer y eliminará todas las evaluaciones y problemas asociados.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancelar
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
