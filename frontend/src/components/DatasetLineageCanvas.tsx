import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  TextField,
  Button,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FitIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { datasetsAPI } from '../services/api';
import { Dataset } from '../types';

interface VersionWithAnalysis extends Dataset {
  latestAnalysis?: {
    quality_score: number | null;
    quality_gate_status: 'PASSED' | 'FAILED' | 'WARNING' | null;
    total_issues_count: number;
    completed_at: string | null;
  } | null;
}

interface NodeLayout {
  version: VersionWithAnalysis;
  x: number;
  y: number;
}

interface DatasetLineageCanvasProps {
  datasetId: number;
  projectId: number;
  currentDatasetId?: number;
}

const NODE_W = 196;
const NODE_H = 116;
const GAP_X = 80;
const GAP_Y = 40;
const CANVAS_PAD = 48;

function buildLayout(versions: VersionWithAnalysis[]): NodeLayout[] {
  if (versions.length === 0) return [];

  // Build adjacency: parentId -> children[]
  const childrenOf: Record<number, VersionWithAnalysis[]> = {};
  const rootVersions: VersionWithAnalysis[] = [];

  for (const v of versions) {
    if (!v.parent_dataset_id) {
      rootVersions.push(v);
    } else {
      if (!childrenOf[v.parent_dataset_id]) childrenOf[v.parent_dataset_id] = [];
      childrenOf[v.parent_dataset_id].push(v);
    }
  }

  const layout: NodeLayout[] = [];

  // DFS to assign positions. depth = column (x-axis), siblings = rows (y-axis)
  function assignPositions(node: VersionWithAnalysis, depth: number, slot: number): number {
    const children = childrenOf[node.id] || [];
    if (children.length === 0) {
      layout.push({
        version: node,
        x: CANVAS_PAD + depth * (NODE_W + GAP_X),
        y: CANVAS_PAD + slot * (NODE_H + GAP_Y),
      });
      return slot + 1;
    }
    let currentSlot = slot;
    const childSlots: number[] = [];
    for (const child of children) {
      childSlots.push(currentSlot);
      currentSlot = assignPositions(child, depth + 1, currentSlot);
    }
    // Center parent vertically among its children
    const firstChildY = CANVAS_PAD + childSlots[0] * (NODE_H + GAP_Y);
    const lastChildY = CANVAS_PAD + (currentSlot - 1) * (NODE_H + GAP_Y);
    layout.push({
      version: node,
      x: CANVAS_PAD + depth * (NODE_W + GAP_X),
      y: (firstChildY + lastChildY) / 2,
    });
    return currentSlot;
  }

  let slot = 0;
  for (const root of rootVersions) {
    slot = assignPositions(root, 0, slot);
  }

  return layout;
}

function getGateColor(status: string | null | undefined): string {
  switch (status) {
    case 'PASSED': return '#00B37E';
    case 'FAILED': return '#E5484D';
    case 'WARNING': return '#FFB800';
    default: return '#BDBDBD';
  }
}

function GateIcon({ status, size = 18 }: { status: string | null | undefined; size?: number }) {
  const sx = { fontSize: size };
  switch (status) {
    case 'PASSED': return <CheckCircleIcon sx={{ ...sx, color: '#00B37E' }} />;
    case 'FAILED': return <ErrorIcon sx={{ ...sx, color: '#E5484D' }} />;
    case 'WARNING': return <WarningIcon sx={{ ...sx, color: '#FFB800' }} />;
    default: return <ScheduleIcon sx={{ ...sx, color: '#BDBDBD' }} />;
  }
}

const DatasetLineageCanvas: React.FC<DatasetLineageCanvasProps> = ({
  datasetId,
  projectId,
  currentDatasetId,
}) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [versions, setVersions] = useState<VersionWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTag, setEditTag] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await datasetsAPI.getDatasetVersions(projectId, datasetId);
      const data = response?.data?.data || response?.data || {};
      setVersions(data.versions || []);
      setError(null);
    } catch {
      setError('No se pudieron cargar las versiones');
    } finally {
      setLoading(false);
    }
  }, [datasetId, projectId]);

  useEffect(() => {
    if (datasetId && projectId) fetchVersions();
  }, [fetchVersions]);

  const layout = buildLayout(versions);

  const canvasW = layout.length > 0
    ? Math.max(...layout.map(n => n.x + NODE_W)) + CANVAS_PAD
    : 400;
  const canvasH = layout.length > 0
    ? Math.max(...layout.map(n => n.y + NODE_H)) + CANVAS_PAD
    : 300;

  // Build parent->child lookup for SVG arrows
  const idToLayout: Record<number, NodeLayout> = {};
  for (const n of layout) idToLayout[n.version.id] = n;

  const handleZoomIn = () => setScale(s => Math.min(s + 0.15, 2));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.15, 0.4));
  const handleFit = () => setScale(1);

  const startEdit = (v: VersionWithAnalysis) => {
    setEditingId(v.id);
    setEditTag(v.version_tag || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTag('');
  };

  const saveEdit = async (v: VersionWithAnalysis) => {
    setSavingId(v.id);
    try {
      await (datasetsAPI as any).patchVersionTag(projectId, v.id, { version_tag: editTag.trim() || null });
      setVersions(prev => prev.map(ver =>
        ver.id === v.id ? { ...ver, version_tag: editTag.trim() || undefined } : ver
      ));
    } catch {
      // ignore, tag stays
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  if (versions.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No hay versiones para mostrar</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 1.5, px: 0.5,
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Linaje de versiones
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            {Math.round(scale * 100)}%
          </Typography>
          <Tooltip title="Zoom in">
            <IconButton size="small" onClick={handleZoomIn}><ZoomInIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton size="small" onClick={handleZoomOut}><ZoomOutIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Restablecer zoom">
            <IconButton size="small" onClick={handleFit}><FitIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Canvas */}
      <Box
        ref={containerRef}
        sx={{
          overflow: 'auto',
          border: '1px solid #E0E0E0',
          borderRadius: 2,
          backgroundColor: '#FAFAFA',
          backgroundImage:
            'radial-gradient(circle, #D0D0D0 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          minHeight: 280,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: canvasW * scale,
            height: canvasH * scale,
            transformOrigin: 'top left',
          }}
        >
          {/* SVG arrows */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: canvasW * scale,
              height: canvasH * scale,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#BDBDBD" />
              </marker>
            </defs>
            {versions.map(v => {
              if (!v.parent_dataset_id) return null;
              const from = idToLayout[v.parent_dataset_id];
              const to = idToLayout[v.id];
              if (!from || !to) return null;

              const x1 = (from.x + NODE_W) * scale;
              const y1 = (from.y + NODE_H / 2) * scale;
              const x2 = to.x * scale;
              const y2 = (to.y + NODE_H / 2) * scale;
              const cx1 = x1 + (x2 - x1) * 0.5;
              const cy1 = y1;
              const cx2 = x1 + (x2 - x1) * 0.5;
              const cy2 = y2;

              return (
                <path
                  key={`arrow-${v.id}`}
                  d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                  stroke="#BDBDBD"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {layout.map(({ version: v, x, y }) => {
            const isCurrentDataset = v.id === (currentDatasetId ?? datasetId);
            const gateStatus = v.latestAnalysis?.quality_gate_status;
            const gateColor = getGateColor(gateStatus);
            const isEditing = editingId === v.id;

            return (
              <Paper
                key={v.id}
                elevation={isCurrentDataset ? 4 : 1}
                sx={{
                  position: 'absolute',
                  left: x * scale,
                  top: y * scale,
                  width: NODE_W * scale,
                  minHeight: NODE_H * scale,
                  p: `${10 * scale}px`,
                  border: `2px solid ${isCurrentDataset ? gateColor : '#E0E0E0'}`,
                  borderLeft: `4px solid ${gateColor}`,
                  borderRadius: 2,
                  backgroundColor: isCurrentDataset ? 'rgba(0,179,126,0.04)' : '#fff',
                  cursor: isEditing ? 'default' : 'pointer',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  '&:hover': isEditing ? {} : {
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    borderColor: gateColor,
                  },
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
                onClick={() => {
                  if (!isEditing) router.push(`/datasets/${v.id}`);
                }}
              >
                {/* Header row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={e => e.stopPropagation()}>
                        <TextField
                          size="small"
                          value={editTag}
                          onChange={e => setEditTag(e.target.value)}
                          placeholder={`v${v.version}`}
                          sx={{ width: 90, '& input': { fontSize: '0.72rem', py: '2px', px: '6px' } }}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(v); if (e.key === 'Escape') cancelEdit(); }}
                        />
                        <IconButton size="small" onClick={() => saveEdit(v)} disabled={savingId === v.id}>
                          {savingId === v.id ? <CircularProgress size={12} /> : <CheckIcon sx={{ fontSize: 14, color: '#00B37E' }} />}
                        </IconButton>
                        <IconButton size="small" onClick={cancelEdit}>
                          <CloseIcon sx={{ fontSize: 14, color: '#999' }} />
                        </IconButton>
                      </Box>
                    ) : (
                      <>
                        <Chip
                          label={v.version_tag || `v${v.version}`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: `${0.68 * scale}rem`,
                            backgroundColor: v.version > 1 ? 'rgba(156,39,176,0.1)' : 'rgba(158,158,158,0.1)',
                            color: v.version > 1 ? '#9c27b0' : '#757575',
                            fontWeight: 600,
                          }}
                        />
                        {v.is_latest && (
                          <Chip label="Latest" size="small" sx={{ height: 18, fontSize: '0.62rem', backgroundColor: 'rgba(25,118,210,0.1)', color: '#1976d2', fontWeight: 600 }} />
                        )}
                        {isCurrentDataset && (
                          <Chip label="Actual" size="small" sx={{ height: 18, fontSize: '0.62rem', backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E', fontWeight: 600 }} />
                        )}
                      </>
                    )}
                  </Box>
                  {!isEditing && (
                    <Tooltip title="Editar etiqueta">
                      <IconButton
                        size="small"
                        onClick={e => { e.stopPropagation(); startEdit(v); }}
                        sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, p: 0.3 }}
                      >
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Quality score + gate */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                  <GateIcon status={gateStatus} size={16 * scale} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: `${0.78 * scale}rem`, color: gateColor }}>
                    {v.latestAnalysis?.quality_score != null
                      ? `${Number(v.latestAnalysis.quality_score).toFixed(1)}%`
                      : 'Sin análisis'}
                  </Typography>
                  {v.latestAnalysis?.total_issues_count != null && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.65 * scale}rem` }}>
                      · {v.latestAnalysis.total_issues_count} issues
                    </Typography>
                  )}
                </Box>

                {/* Stats */}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.65 * scale}rem` }}>
                    {v.row_count?.toLocaleString() ?? '—'} filas
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.65 * scale}rem` }}>
                    {v.column_count ?? '—'} cols
                  </Typography>
                </Box>

                {/* Date */}
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.62 * scale}rem`, mt: 0.5, display: 'block' }}>
                  {v.created_at ? new Date(v.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}>
        {[
          { label: 'Passed', color: '#00B37E' },
          { label: 'Warning', color: '#FFB800' },
          { label: 'Failed', color: '#E5484D' },
          { label: 'Sin análisis', color: '#BDBDBD' },
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontStyle: 'italic' }}>
          Haz clic en un nodo para navegar · Edita la etiqueta con el lápiz
        </Typography>
      </Box>
    </Box>
  );
};

export default DatasetLineageCanvas;
