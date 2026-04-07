import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Grid,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import QualityGateBadge from '../../components/QualityGateBadge';
import { projectsAPI, analysisAPI, datasetsAPI } from '../../services/api';
import type { AnalysisRun } from '../../types';

// Colores consistentes
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';

interface Project {
  id: number;
  name: string;
}

interface Dataset {
  id: number;
  name: string;
  project_id: number;
  version?: number;
}

const EvaluationsIndex = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allRuns, setAllRuns] = useState<AnalysisRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  
  // Filtros
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Cargar proyectos y sus análisis
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Obtener proyectos - getProjects devuelve directamente el array
        const projectsList = await projectsAPI.getProjects();
        setProjects(Array.isArray(projectsList) ? projectsList : []);

        // Obtener análisis de todos los proyectos
        const allAnalysisRuns: AnalysisRun[] = [];
        const allDatasets: Dataset[] = [];
        
        for (const project of projectsList) {
          try {
            // Obtener análisis del proyecto
            const runsRes = await analysisAPI.getProjectAnalysisRuns(project.id);
            const runs = runsRes?.data?.data?.analysis_runs || 
                        runsRes?.data?.analysis_runs || 
                        runsRes?.data || 
                        [];
            
            // Añadir project_id y project_name a cada run
            const runsWithProject = (Array.isArray(runs) ? runs : []).map((run: AnalysisRun) => ({
              ...run,
              project_id: project.id,
              project_name: project.name,
            }));
            allAnalysisRuns.push(...runsWithProject);

            // Obtener datasets del proyecto
            const datasetsRes: any = await datasetsAPI.getDatasets(project.id);
            const projectDatasets = datasetsRes?.data?.data?.datasets || 
                                   datasetsRes?.data?.data ||
                                   datasetsRes?.data?.datasets || 
                                   [];
            allDatasets.push(...(Array.isArray(projectDatasets) ? projectDatasets : []));
          } catch (err) {
            console.warn(`Error fetching data for project ${project.id}:`, err);
          }
        }

        setAllRuns(allAnalysisRuns);
        setDatasets(allDatasets);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrar y ordenar runs
  const filteredRuns = useMemo(() => {
    let filtered = [...allRuns];

    // Filtrar por proyecto
    if (selectedProject !== '') {
      filtered = filtered.filter(run => run.project_id === selectedProject);
    }

    // Filtrar por estado
    if (selectedStatus) {
      filtered = filtered.filter(run => run.status === selectedStatus);
    }

    // Filtrar por búsqueda (nombre de proyecto o dataset)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(run => {
        const projectName = (run as any).project_name?.toLowerCase() || '';
        const datasetName = getDatasetName(run.dataset_id).toLowerCase();
        return projectName.includes(search) || datasetName.includes(search);
      });
    }

    // Ordenar por fecha (más reciente primero)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.completed_at || a.created_at).getTime();
      const dateB = new Date(b.completed_at || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [allRuns, selectedProject, selectedStatus, searchTerm]);

  // Paginación
  const paginatedRuns = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRuns.slice(start, start + rowsPerPage);
  }, [filteredRuns, page, rowsPerPage]);

  // Helpers
  const getDatasetName = (datasetId?: number) => {
    if (!datasetId) return '—';
    const dataset = datasets.find(d => d.id === datasetId);
    return dataset ? dataset.name : `Dataset #${datasetId}`;
  };

  const getDatasetVersion = (datasetId?: number): number => {
    if (!datasetId) return 1;
    const dataset = datasets.find(d => d.id === datasetId);
    return dataset?.version || 1;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Chip label="Completado" size="small" sx={{ backgroundColor: 'rgba(0, 179, 126, 0.1)', color: GREEN }} />;
      case 'RUNNING':
        return <Chip label="En progreso" size="small" sx={{ backgroundColor: 'rgba(255, 184, 0, 0.1)', color: ORANGE }} />;
      case 'FAILED':
        return <Chip label="Fallido" size="small" sx={{ backgroundColor: 'rgba(229, 72, 77, 0.1)', color: RED }} />;
      case 'PENDING':
        return <Chip label="Pendiente" size="small" sx={{ backgroundColor: 'rgba(136, 136, 136, 0.1)', color: GRAY }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const handleViewRun = (run: AnalysisRun) => {
    router.push(`/evaluations/${run.id}`);
  };

  // Estadísticas
  const stats = useMemo(() => {
    const completed = allRuns.filter(r => r.status === 'COMPLETED');
    const avgScore = completed.length > 0
      ? Math.round(completed.reduce((sum, r) => sum + (r.quality_score || 0), 0) / completed.length)
      : null;
    
    return {
      total: allRuns.length,
      completed: completed.length,
      passed: completed.filter(r => r.quality_gate_status === 'PASSED').length,
      failed: completed.filter(r => r.quality_gate_status === 'FAILED').length,
      avgScore,
    };
  }, [allRuns]);

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Historial de análisis
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: '#666666' }}>
          Vista global de todos los análisis de calidad ejecutados en la plataforma
        </Typography>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E5E5', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>{stats.total}</Typography>
            <Typography variant="body2" sx={{ color: GRAY }}>Total análisis</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E5E5', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: GREEN }}>{stats.passed}</Typography>
            <Typography variant="body2" sx={{ color: GRAY }}>Aprobados</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E5E5', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: RED }}>{stats.failed}</Typography>
            <Typography variant="body2" sx={{ color: GRAY }}>Fallidos</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E5E5', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
            </Typography>
            <Typography variant="body2" sx={{ color: GRAY }}>Score promedio</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filtros */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #E5E5E5', borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por proyecto o dataset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: GRAY }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Proyecto</InputLabel>
              <Select
                value={selectedProject}
                label="Proyecto"
                onChange={(e) => setSelectedProject(e.target.value as number | '')}
              >
                <MenuItem value="">Todos los proyectos</MenuItem>
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Estado</InputLabel>
              <Select
                value={selectedStatus}
                label="Estado"
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="COMPLETED">Completado</MenuItem>
                <MenuItem value="RUNNING">En progreso</MenuItem>
                <MenuItem value="FAILED">Fallido</MenuItem>
                <MenuItem value="PENDING">Pendiente</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabla */}
      <Paper elevation={0} sx={{ border: '1px solid #E5E5E5', borderRadius: 2, overflow: 'hidden' }}>
        {loading && <LinearProgress />}
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
                <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Proyecto</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Dataset</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Quality Gate</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Issues</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 60 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" sx={{ color: GRAY }}>
                      {loading ? 'Cargando análisis...' : 'No se encontraron análisis'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    sx={{
                      '&:hover': { backgroundColor: '#FAFAFA' },
                      cursor: 'pointer',
                    }}
                    onClick={() => handleViewRun(run)}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(run.completed_at || run.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(run as any).project_name || `Proyecto #${run.project_id}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getDatasetName(run.dataset_id)}>
                          {getDatasetName(run.dataset_id)}
                        </Typography>
                        {run.dataset_id && (
                          <Chip
                            label={`v${getDatasetVersion(run.dataset_id)}`}
                            size="small"
                            sx={{
                              height: '18px',
                              fontSize: '0.65rem',
                              backgroundColor: 'rgba(0, 179, 126, 0.1)',
                              color: GREEN,
                              fontWeight: 500,
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(run.status)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {run.status === 'COMPLETED' && run.quality_gate_status ? (
                        <QualityGateBadge status={run.quality_gate_status} size="small" />
                      ) : (
                        <Typography variant="body2" sx={{ color: GRAY }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {run.status === 'COMPLETED' && run.quality_score !== null ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: (run.quality_score || 0) >= 80 ? GREEN : (run.quality_score || 0) >= 60 ? ORANGE : RED,
                          }}
                        >
                          {Number(run.quality_score).toFixed(1)}%
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ color: GRAY }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {run.status === 'COMPLETED' ? (
                        <Typography variant="body2" sx={{ color: run.total_issues_count > 0 ? RED : GRAY }}>
                          {run.total_issues_count || 0}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ color: GRAY }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Ver detalles">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRun(run);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredRuns.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Paper>
    </MainLayout>
  );
};

export default EvaluationsIndex;
