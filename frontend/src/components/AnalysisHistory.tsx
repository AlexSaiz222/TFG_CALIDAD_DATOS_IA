import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import QualityGateBadge from './QualityGateBadge';
import type { AnalysisRun } from '../types';

// Colores consistentes
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';

interface AnalysisHistoryProps {
  runs: AnalysisRun[];
  currentRunId?: number;
  projectId: number;
  loading?: boolean;
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  runs,
  currentRunId,
  projectId,
  loading = false,
}) => {
  const router = useRouter();
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Ordenar runs por fecha (más reciente primero)
  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const dateA = new Date(a.completed_at || a.created_at).getTime();
      const dateB = new Date(b.completed_at || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [runs]);

  // Paginación
  const paginatedRuns = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedRuns.slice(start, start + rowsPerPage);
  }, [sortedRuns, page, rowsPerPage]);

  // Handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewRun = (runId: number) => {
    router.push(`/projects/${projectId}/runs/${runId}`);
  };

  // Calcular duración
  const calculateDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return '—';
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${mins}m ${secs}s`;
  };

  // Formatear fecha
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calcular tendencia comparando con el run anterior
  const getTrend = (currentIndex: number) => {
    if (currentIndex >= sortedRuns.length - 1) return null;
    
    const current = sortedRuns[currentIndex];
    const previous = sortedRuns[currentIndex + 1];
    
    if (!current.quality_score || !previous.quality_score) return null;
    
    const diff = current.quality_score - previous.quality_score;
    
    if (Math.abs(diff) < 0.5) return { type: 'flat', diff: 0 };
    if (diff > 0) return { type: 'up', diff };
    return { type: 'down', diff };
  };

  // Renderizar indicador de tendencia
  const renderTrend = (index: number) => {
    const trend = getTrend(index);
    if (!trend) return null;

    const { type, diff } = trend;
    
    if (type === 'flat') {
      return (
        <Tooltip title="Sin cambios">
          <TrendingFlatIcon sx={{ fontSize: 16, color: GRAY, ml: 0.5 }} />
        </Tooltip>
      );
    }
    
    if (type === 'up') {
      return (
        <Tooltip title={`+${diff.toFixed(1)}% vs anterior`}>
          <TrendingUpIcon sx={{ fontSize: 16, color: GREEN, ml: 0.5 }} />
        </Tooltip>
      );
    }
    
    return (
      <Tooltip title={`${diff.toFixed(1)}% vs anterior`}>
        <TrendingDownIcon sx={{ fontSize: 16, color: RED, ml: 0.5 }} />
      </Tooltip>
    );
  };

  if (runs.length === 0 && !loading) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
        <ScheduleIcon sx={{ fontSize: 48, color: GRAY, mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#555555' }}>
          No hay análisis ejecutados
        </Typography>
        <Typography variant="body2" sx={{ color: '#888888' }}>
          Ejecuta un análisis para ver el historial aquí.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #EEEEEE', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #EEEEEE', backgroundColor: '#FAFAFA' }}>
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          Historial de Análisis ({runs.length})
        </Typography>
      </Box>

      {loading && <LinearProgress />}

      {/* Tabla */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={{ fontWeight: 600, width: 50 }}></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Quality Gate</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Score</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Issues</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Nuevos</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Corregidos</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Duración</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 60 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRuns.map((run, index) => {
              const isCurrentRun = run.id === currentRunId;
              const globalIndex = page * rowsPerPage + index;
              const isLatest = globalIndex === 0;
              
              return (
                <TableRow
                  key={run.id}
                  sx={{
                    '&:hover': { backgroundColor: '#FAFAFA' },
                    backgroundColor: isCurrentRun ? 'rgba(0, 179, 126, 0.05)' : 'transparent',
                    borderLeft: isCurrentRun ? `3px solid ${GREEN}` : '3px solid transparent',
                  }}
                >
                  {/* Indicador de run actual/más reciente */}
                  <TableCell>
                    {isLatest && (
                      <Tooltip title="Análisis más reciente">
                        <StarIcon sx={{ fontSize: 18, color: ORANGE }} />
                      </Tooltip>
                    )}
                    {isCurrentRun && !isLatest && (
                      <Tooltip title="Análisis actual">
                        <Chip
                          label="Actual"
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            height: 18,
                            backgroundColor: 'rgba(0, 179, 126, 0.1)',
                            color: GREEN,
                          }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  
                  {/* Fecha */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: isLatest ? 600 : 400 }}>
                      {formatDate(run.completed_at || run.created_at)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: GRAY }}>
                      #{run.id}
                    </Typography>
                  </TableCell>
                  
                  {/* Quality Gate */}
                  <TableCell>
                    <QualityGateBadge
                      status={run.quality_gate_status}
                      size="small"
                      showLabel={true}
                      showIssuesCounts={false}
                    />
                  </TableCell>
                  
                  {/* Score */}
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: 
                            (run.quality_score || 0) >= 80 ? GREEN :
                            (run.quality_score || 0) >= 60 ? ORANGE : RED,
                        }}
                      >
                        {run.quality_score?.toFixed(1) || 0}%
                      </Typography>
                      {renderTrend(globalIndex)}
                    </Box>
                  </TableCell>
                  
                  {/* Total Issues */}
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Typography variant="body2">
                      {run.total_issues_count || 0}
                    </Typography>
                  </TableCell>
                  
                  {/* New Issues */}
                  <TableCell sx={{ textAlign: 'center' }}>
                    {(run.new_issues_count || 0) > 0 ? (
                      <Chip
                        label={`+${run.new_issues_count}`}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          height: 20,
                          backgroundColor: 'rgba(229, 72, 77, 0.1)',
                          color: RED,
                          fontWeight: 600,
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: GREEN }}>
                        0
                      </Typography>
                    )}
                  </TableCell>
                  
                  {/* Fixed Issues */}
                  <TableCell sx={{ textAlign: 'center' }}>
                    {(run.fixed_issues_count || 0) > 0 ? (
                      <Chip
                        label={`-${run.fixed_issues_count}`}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          height: 20,
                          backgroundColor: 'rgba(0, 179, 126, 0.1)',
                          color: GREEN,
                          fontWeight: 600,
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: GRAY }}>
                        0
                      </Typography>
                    )}
                  </TableCell>
                  
                  {/* Duración */}
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: GRAY }}>
                      {calculateDuration(run.started_at, run.completed_at)}
                    </Typography>
                  </TableCell>
                  
                  {/* Acción */}
                  <TableCell>
                    <Tooltip title="Ver detalle">
                      <IconButton
                        size="small"
                        onClick={() => handleViewRun(run.id)}
                        sx={{
                          color: GREEN,
                          '&:hover': { backgroundColor: 'rgba(0, 179, 126, 0.1)' },
                        }}
                      >
                        <VisibilityIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Paginación */}
      {runs.length > 5 && (
        <TablePagination
          component="div"
          count={runs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          sx={{ borderTop: '1px solid #EEEEEE' }}
        />
      )}
    </Paper>
  );
};

export default AnalysisHistory;
