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
  Chip,
  IconButton,
  Tooltip,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { AnalysisRun } from '../types';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';
const PAGE_SIZE = 15;
const LOAD_MORE = 10;

interface AnalysisHistoryProps {
  runs: AnalysisRun[];
  currentRunId?: number;
  projectId: number;
  loading?: boolean;
  datasets?: Array<{ id: number; name: string; version?: number }>;
  selectedDatasetId?: number | null;
}

function getGateColor(status: string | null | undefined): string {
  switch (status) {
    case 'PASSED': return GREEN;
    case 'WARNING': return ORANGE;
    case 'FAILED': return RED;
    default: return GRAY;
  }
}

function relativeDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function fullDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function duration(started?: string, completed?: string): string | null {
  if (!started || !completed) return null;
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

// Mini inline score bar: "83% ████████░░"
const ScoreBar: React.FC<{ score: number | null | undefined }> = ({ score }) => {
  if (score == null) return <Typography sx={{ fontSize: '0.82rem', color: GRAY }}>—</Typography>;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? GREEN : pct >= 60 ? ORANGE : RED;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 110 }}>
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>
        {score.toFixed(1)}%
      </Typography>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EBEBEB', overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  );
};

// Δ chip always visible
const DeltaChip: React.FC<{ delta: number | null }> = ({ delta }) => {
  if (delta === null) return <Typography sx={{ fontSize: '0.75rem', color: '#CCC' }}>—</Typography>;
  if (Math.abs(delta) < 0.5) return <Typography sx={{ fontSize: '0.75rem', color: GRAY }}>=</Typography>;
  const color = delta > 0 ? GREEN : RED;
  return (
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color }}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
    </Typography>
  );
};

// Gate status dot + label (compact)
const GateDot: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const color = getGateColor(status);
  const label = status === 'PASSED' ? 'Aprobado' : status === 'WARNING' ? 'Advertencia' : status === 'FAILED' ? 'Fallido' : '—';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.78rem', color: status ? '#333' : GRAY, fontWeight: status ? 500 : 400 }}>
        {label}
      </Typography>
    </Box>
  );
};

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  runs,
  currentRunId,
  projectId,
  loading = false,
  datasets = [],
  selectedDatasetId = null,
}) => {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const getDatasetVersion = (datasetId?: number): number => {
    if (!datasetId) return 1;
    return datasets.find(d => d.id === datasetId)?.version || 1;
  };

  const sortedRuns = useMemo(() =>
    [...runs].sort((a, b) =>
      new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
    ), [runs]);

  const visibleRuns = sortedRuns.slice(0, visibleCount);
  const hasMore = visibleCount < sortedRuns.length;

  // Pre-compute Δ for all runs
  const deltas = useMemo(() => {
    const map: Record<number, number | null> = {};
    sortedRuns.forEach((run, i) => {
      const prev = sortedRuns[i + 1];
      if (run.quality_score != null && prev?.quality_score != null) {
        map[run.id] = run.quality_score - prev.quality_score;
      } else {
        map[run.id] = null;
      }
    });
    return map;
  }, [sortedRuns]);

  const showDatasetCol = selectedDatasetId === null;

  if (runs.length === 0 && !loading) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
        <ScheduleIcon sx={{ fontSize: 40, color: GRAY, mb: 1.5 }} />
        <Typography variant="h6" sx={{ color: '#555' }}>Sin análisis ejecutados</Typography>
        <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
          Ejecuta un análisis para ver el historial aquí.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #EEEEEE', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        px: 2.5, py: 1.5,
        borderBottom: '1px solid #F0F0F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A1A1A' }}>
          Análisis
          <Box component="span" sx={{ ml: 1, px: 0.8, py: 0.1, borderRadius: '10px', backgroundColor: '#F0F0F0', fontSize: '0.75rem', fontWeight: 700, color: '#555' }}>
            {runs.length}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: GRAY }}>
          Más reciente primero
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ height: 2 }} />}

      {/* Table */}
      <TableContainer sx={{ maxHeight: 520, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Gate</TableCell>
              <TableCell sx={thSx}>Fecha</TableCell>
              {showDatasetCol && <TableCell sx={thSx}>Dataset</TableCell>}
              <TableCell sx={{ ...thSx, minWidth: 150 }}>Score</TableCell>
              <TableCell sx={thSx}>Δ</TableCell>
              <TableCell sx={thSx}>Issues</TableCell>
              <TableCell sx={{ ...thSx, textAlign: 'center' }}>Dur.</TableCell>
              <TableCell sx={{ ...thSx, width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRuns.map((run, index) => {
              const isLatest = index === 0;
              const isCurrent = run.id === currentRunId;
              const dur = duration(run.started_at, run.completed_at);
              const durLong = dur && dur !== '—' && parseInt(dur) > 60;

              return (
                <TableRow
                  key={run.id}
                  sx={{
                    '&:hover': { backgroundColor: '#FAFAFA' },
                    backgroundColor: isCurrent ? 'rgba(0,179,126,0.04)' : 'transparent',
                    borderLeft: isCurrent ? `3px solid ${GREEN}` : '3px solid transparent',
                  }}
                >
                  {/* Gate */}
                  <TableCell sx={tdSx}>
                    <GateDot status={run.quality_gate_status} />
                  </TableCell>

                  {/* Fecha */}
                  <TableCell sx={tdSx}>
                    <Tooltip title={fullDate(run.completed_at || run.created_at)} placement="top">
                      <Typography sx={{
                        fontSize: '0.8rem',
                        fontWeight: isLatest ? 600 : 400,
                        color: isLatest ? '#1A1A1A' : '#555',
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        cursor: 'default',
                      }}>
                        {isLatest && (
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GREEN, flexShrink: 0 }} />
                        )}
                        {relativeDate(run.completed_at || run.created_at)}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Dataset (solo si no hay filtro activo) */}
                  {showDatasetCol && (
                    <TableCell sx={tdSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '0.8rem', color: '#333', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {datasets.find(d => d.id === run.dataset_id)?.name || (run.dataset_id ? `#${run.dataset_id}` : '—')}
                        </Typography>
                        {run.dataset_id && (
                          <Box sx={{ px: 0.5, py: 0.1, borderRadius: '3px', backgroundColor: 'rgba(0,179,126,0.1)', fontSize: '0.62rem', fontWeight: 700, color: GREEN, flexShrink: 0 }}>
                            v{getDatasetVersion(run.dataset_id)}
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                  )}

                  {/* Score con barra */}
                  <TableCell sx={{ ...tdSx, pr: 2 }}>
                    <ScoreBar score={run.quality_score} />
                  </TableCell>

                  {/* Δ siempre visible */}
                  <TableCell sx={tdSx}>
                    <DeltaChip delta={deltas[run.id] ?? null} />
                  </TableCell>

                  {/* Issues */}
                  <TableCell sx={tdSx}>
                    {run.total_issues_count != null ? (
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, color: run.total_issues_count > 0 ? '#333' : GRAY }}>
                          {run.total_issues_count}
                        </Typography>
                        {(run.critical_issues_count || 0) > 0 && (
                          <Typography sx={{ fontSize: '0.68rem', color: RED, fontWeight: 600 }}>
                            {run.critical_issues_count}c
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.82rem', color: GRAY }}>—</Typography>
                    )}
                  </TableCell>

                  {/* Duración — solo si > 1min */}
                  <TableCell sx={{ ...tdSx, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: GRAY }}>
                      {dur && dur !== '—' ? dur : '—'}
                    </Typography>
                  </TableCell>

                  {/* Acción */}
                  <TableCell sx={{ ...tdSx, pr: 1 }}>
                    <Tooltip title="Ver análisis">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/evaluations/${run.id}`)}
                        sx={{ color: '#BBBBBB', '&:hover': { color: GREEN, backgroundColor: `${GREEN}15` }, p: 0.5 }}
                      >
                        <ChevronRightIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load more */}
      {hasMore && (
        <Box sx={{ p: 1.5, borderTop: '1px solid #F5F5F5', textAlign: 'center' }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setVisibleCount(c => c + LOAD_MORE)}
            sx={{ color: GRAY, fontSize: '0.8rem', textTransform: 'none', '&:hover': { color: '#333', backgroundColor: '#F5F5F5' } }}
          >
            Ver {Math.min(LOAD_MORE, sortedRuns.length - visibleCount)} más de {sortedRuns.length - visibleCount} restantes
          </Button>
        </Box>
      )}
    </Paper>
  );
};

const thSx = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#999',
  backgroundColor: '#FAFAFA',
  borderBottom: '1px solid #EEEEEE',
  py: 1,
  px: 1.5,
  whiteSpace: 'nowrap' as const,
};

const tdSx = {
  py: 0.75,
  px: 1.5,
  borderBottom: '1px solid #F5F5F5',
};

export default AnalysisHistory;
