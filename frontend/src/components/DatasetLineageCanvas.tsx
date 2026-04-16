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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Refresh as ResetIcon,
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

const NODE_W = 240;
const NODE_H = 148;
const GAP_X = 96;
const GAP_Y = 48;
const CANVAS_PAD = 60;

function buildLayout(versions: VersionWithAnalysis[]): NodeLayout[] {
  if (versions.length === 0) return [];

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

  function assignPositions(node: VersionWithAnalysis, depth: number, slot: number): number {
    const children = childrenOf[node.id] || [];
    if (children.length === 0) {
      layout.push({ version: node, x: CANVAS_PAD + depth * (NODE_W + GAP_X), y: CANVAS_PAD + slot * (NODE_H + GAP_Y) });
      return slot + 1;
    }
    let currentSlot = slot;
    const childFirstSlots: number[] = [];
    for (const child of children) {
      childFirstSlots.push(currentSlot);
      currentSlot = assignPositions(child, depth + 1, currentSlot);
    }
    const firstChildY = CANVAS_PAD + childFirstSlots[0] * (NODE_H + GAP_Y);
    const lastChildY = CANVAS_PAD + (currentSlot - 1) * (NODE_H + GAP_Y);
    layout.push({ version: node, x: CANVAS_PAD + depth * (NODE_W + GAP_X), y: (firstChildY + lastChildY) / 2 });
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

  // Pan state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0,
  });

  // Node drag state
  const [nodeOffsets, setNodeOffsets] = useState<Record<number, { dx: number; dy: number }>>({});
  const dragRef = useRef<{ nodeId: number; startMouseX: number; startMouseY: number; startDx: number; startDy: number } | null>(null);
  const didDragRef = useRef(false);

  // Inline edit
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

  useEffect(() => { if (datasetId && projectId) fetchVersions(); }, [fetchVersions]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        return Math.min(2.5, Math.max(0.3, s * factor));
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const baseLayout = buildLayout(versions);

  // Compute effective positions (layout + offsets)
  const effectiveLayout = baseLayout.map(n => ({
    ...n,
    ex: n.x + (nodeOffsets[n.version.id]?.dx ?? 0),
    ey: n.y + (nodeOffsets[n.version.id]?.dy ?? 0),
  }));

  const idToEffective: Record<number, { ex: number; ey: number; version: VersionWithAnalysis }> = {};
  for (const n of effectiveLayout) idToEffective[n.version.id] = n;

  const canvasW = effectiveLayout.length > 0 ? Math.max(...effectiveLayout.map(n => n.ex + NODE_W)) + CANVAS_PAD : 500;
  const canvasH = effectiveLayout.length > 0 ? Math.max(...effectiveLayout.map(n => n.ey + NODE_H)) + CANVAS_PAD : 400;

  // Canvas pointer handlers (pan)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: panOffset.x, startPanY: panOffset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const { nodeId, startMouseX, startMouseY, startDx, startDy } = dragRef.current;
      const dx = (e.clientX - startMouseX) / scale + startDx;
      const dy = (e.clientY - startMouseY) / scale + startDy;
      if (Math.abs(e.clientX - startMouseX) > 4 || Math.abs(e.clientY - startMouseY) > 4) {
        didDragRef.current = true;
      }
      setNodeOffsets(prev => ({ ...prev, [nodeId]: { dx, dy } }));
      return;
    }
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPanOffset({ x: panRef.current.startPanX + dx, y: panRef.current.startPanY + dy });
    }
  };
  const handleCanvasPointerUp = () => {
    panRef.current.active = false;
    dragRef.current = null;
  };

  // Node drag handlers
  const handleNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (editingId === nodeId) return;
    e.stopPropagation();
    didDragRef.current = false;
    const current = nodeOffsets[nodeId] ?? { dx: 0, dy: 0 };
    dragRef.current = { nodeId, startMouseX: e.clientX, startMouseY: e.clientY, startDx: current.dx, startDy: current.dy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleReset = () => {
    setNodeOffsets({});
    setPanOffset({ x: 0, y: 0 });
    setScale(1);
  };

  const startEdit = (v: VersionWithAnalysis) => { setEditingId(v.id); setEditTag(v.version_tag || ''); };
  const cancelEdit = () => { setEditingId(null); setEditTag(''); };
  const saveEdit = async (v: VersionWithAnalysis) => {
    setSavingId(v.id);
    try {
      await (datasetsAPI as any).patchVersionTag(projectId, v.id, { version_tag: editTag.trim() || null });
      setVersions(prev => prev.map(ver => ver.id === v.id ? { ...ver, version_tag: editTag.trim() || undefined } : ver));
    } catch { /* keep original */ } finally { setSavingId(null); setEditingId(null); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress size={32} /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (versions.length === 0) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No hay versiones para mostrar</Typography></Box>;

  const isDragging = dragRef.current !== null;
  const isPanning = panRef.current.active;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={versions.length === 1 ? '1 versión' : `${versions.length} versiones`}
            size="small"
            sx={{ height: 22, fontSize: '0.73rem', backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E', fontWeight: 500 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.75rem', opacity: 0.7 }}>
            Arrastra el fondo para desplazar · rueda para zoom · arrastra nodos para reorganizar
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
            {Math.round(scale * 100)}%
          </Typography>
          <Tooltip title="Zoom in"><IconButton size="small" onClick={() => setScale(s => Math.min(2.5, s * 1.15))}><ZoomInIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Zoom out"><IconButton size="small" onClick={() => setScale(s => Math.max(0.3, s / 1.15))}><ZoomOutIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Resetear posiciones y zoom">
            <IconButton size="small" onClick={handleReset}><ResetIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Canvas container */}
      <Box
        ref={containerRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        sx={{
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#F8F9FA',
          backgroundImage: 'radial-gradient(circle, #D4D6D8 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          position: 'relative',
          cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        {/* Scrollable inner */}
        <Box sx={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          overflow: 'auto',
        }}>
          {/* Transform group for pan */}
          <Box sx={{
            position: 'relative',
            width: canvasW * scale + Math.abs(panOffset.x) + 80,
            height: Math.max(520, canvasH * scale + Math.abs(panOffset.y) + 80),
          }}>
            {/* SVG for arrows */}
            <svg
              style={{
                position: 'absolute',
                top: panOffset.y,
                left: panOffset.x,
                width: canvasW * scale,
                height: canvasH * scale,
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#C0C0C0" />
                </marker>
              </defs>
              {versions.map(v => {
                if (!v.parent_dataset_id) return null;
                const from = idToEffective[v.parent_dataset_id];
                const to = idToEffective[v.id];
                if (!from || !to) return null;

                const x1 = (from.ex + NODE_W) * scale;
                const y1 = (from.ey + NODE_H / 2) * scale;
                const x2 = to.ex * scale;
                const y2 = (to.ey + NODE_H / 2) * scale;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const cp1x = x1 + (x2 - x1) * 0.45;
                const cp2x = x1 + (x2 - x1) * 0.55;

                // Delta quality score label
                const scoreFrom = from.version.latestAnalysis?.quality_score;
                const scoreTo = to.version.latestAnalysis?.quality_score;
                let deltaLabel = '';
                let deltaColor = '#999';
                if (scoreFrom != null && scoreTo != null) {
                  const delta = scoreTo - scoreFrom;
                  deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
                  deltaColor = delta > 0 ? '#00B37E' : delta < 0 ? '#E5484D' : '#999';
                }

                return (
                  <g key={`arrow-${v.id}`}>
                    <path
                      d={`M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`}
                      stroke="#C0C0C0"
                      strokeWidth={2}
                      fill="none"
                      markerEnd="url(#arrowhead)"
                    />
                    {deltaLabel && (
                      <>
                        <rect
                          x={mx - 22}
                          y={my - 10}
                          width={44}
                          height={20}
                          rx={10}
                          fill="white"
                          stroke={deltaColor}
                          strokeWidth={1.5}
                        />
                        <text
                          x={mx}
                          y={my + 4}
                          textAnchor="middle"
                          fill={deltaColor}
                          fontSize={11 * scale}
                          fontWeight="600"
                          fontFamily="inherit"
                        >
                          {deltaLabel}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {effectiveLayout.map(({ version: v, ex, ey }) => {
              const isCurrentDataset = v.id === (currentDatasetId ?? datasetId);
              const gateStatus = v.latestAnalysis?.quality_gate_status;
              const gateColor = getGateColor(gateStatus);
              const isEditing = editingId === v.id;
              const score = v.latestAnalysis?.quality_score;

              return (
                <Paper
                  key={v.id}
                  data-node="true"
                  elevation={isCurrentDataset ? 6 : 2}
                  onPointerDown={e => handleNodePointerDown(e, v.id)}
                  onClick={() => { if (!didDragRef.current && !isEditing) router.push(`/datasets/${v.id}`); }}
                  sx={{
                    position: 'absolute',
                    left: panOffset.x + ex * scale,
                    top: panOffset.y + ey * scale,
                    width: NODE_W * scale,
                    p: `${12 * scale}px`,
                    border: `2px solid ${isCurrentDataset ? gateColor : '#E8E8E8'}`,
                    borderLeft: `5px solid ${gateColor}`,
                    borderRadius: 2.5,
                    backgroundColor: isCurrentDataset ? `${gateColor}08` : '#FFFFFF',
                    cursor: isEditing ? 'default' : 'pointer',
                    transition: 'box-shadow 0.15s',
                    '&:hover': isEditing ? {} : { boxShadow: '0 6px 20px rgba(0,0,0,0.14)' },
                    boxSizing: 'border-box',
                    touchAction: 'none',
                  }}
                >
                  {/* Top row: chips + edit */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      {isEditing ? (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                        >
                          <TextField
                            size="small"
                            value={editTag}
                            onChange={e => setEditTag(e.target.value)}
                            placeholder={`v${v.version}`}
                            sx={{ width: 100, '& input': { fontSize: '0.72rem', py: '2px', px: '6px' } }}
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
                              height: 22,
                              fontSize: `${0.7 * scale}rem`,
                              backgroundColor: v.version > 1 ? 'rgba(156,39,176,0.1)' : 'rgba(158,158,158,0.1)',
                              color: v.version > 1 ? '#9c27b0' : '#757575',
                              fontWeight: 700,
                            }}
                          />
                          {v.is_latest && (
                            <Chip label="Última" size="small" sx={{ height: 20, fontSize: '0.65rem', backgroundColor: 'rgba(25,118,210,0.1)', color: '#1976d2', fontWeight: 600 }} />
                          )}
                          {isCurrentDataset && (
                            <Chip label="Actual" size="small" sx={{ height: 20, fontSize: '0.65rem', backgroundColor: `${gateColor}20`, color: gateColor, fontWeight: 600 }} />
                          )}
                        </>
                      )}
                    </Box>
                    {!isEditing && (
                      <Tooltip title="Editar etiqueta">
                        <IconButton
                          size="small"
                          onClick={e => { e.stopPropagation(); startEdit(v); }}
                          onPointerDown={e => e.stopPropagation()}
                          sx={{ opacity: 0.35, '&:hover': { opacity: 1 }, p: 0.3, ml: 0.5 }}
                        >
                          <EditIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Quality score — prominent */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                    <GateIcon status={gateStatus} size={20 * scale} />
                    <Typography sx={{ fontSize: `${1.15 * scale}rem`, fontWeight: 700, color: gateColor, lineHeight: 1 }}>
                      {score != null ? `${Number(score).toFixed(1)}%` : '—'}
                    </Typography>
                    {v.latestAnalysis?.total_issues_count != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.68 * scale}rem` }}>
                        {v.latestAnalysis.total_issues_count} issues
                      </Typography>
                    )}
                  </Box>

                  {/* Stats row */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.68 * scale}rem` }}>
                      {v.row_count?.toLocaleString() ?? '—'} filas
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.68 * scale}rem` }}>
                      {v.column_count ?? '—'} cols
                    </Typography>
                  </Box>

                  {/* Date */}
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.63 * scale}rem`, mt: 0.75, display: 'block', opacity: 0.7 }}>
                    {v.created_at ? new Date(v.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </Typography>

                  {/* Description */}
                  {v.description && (
                    <Typography variant="caption" color="text.secondary" sx={{
                      fontSize: `${0.63 * scale}rem`, mt: 0.5, display: 'block',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      opacity: 0.7,
                    }}>
                      {v.description}
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, px: 2, py: 1, borderTop: '1px solid #F0F0F0', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: 'Aprobado', color: '#00B37E' },
          { label: 'Advertencia', color: '#FFB800' },
          { label: 'Fallido', color: '#E5484D' },
          { label: 'Sin análisis', color: '#BDBDBD' },
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>{label}</Typography>
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', opacity: 0.55, fontSize: '0.7rem' }}>
          Click en nodo para navegar · ✏️ editar etiqueta · etiqueta en flecha = cambio de calidad
        </Typography>
      </Box>
    </Box>
  );
};

export default DatasetLineageCanvas;
