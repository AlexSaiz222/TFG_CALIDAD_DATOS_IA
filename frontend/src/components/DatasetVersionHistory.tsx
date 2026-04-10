import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  TextField,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  CompareArrows as CompareArrowsIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import Button from '@mui/material/Button';
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
  row: number;
  lane: number;
  colorIdx: number;
}

interface DatasetVersionHistoryProps {
  datasetId: number;
  projectId: number;
  onCompare?: (versionA: number, versionB: number) => void;
  onOpenCanvas?: () => void;
}

const LANE_COLORS = ['#00B37E', '#9c27b0', '#1976d2', '#f57c00', '#e91e63', '#00bcd4'];
const ROW_H = 62;    // px per row — must match card row height
const LANE_W = 22;   // px between lane centers
const DOT_R = 5.5;   // circle radius
const SVG_PAD = 12;  // left padding inside SVG

function laneColor(idx: number) {
  return LANE_COLORS[idx % LANE_COLORS.length];
}

/**
 * Assigns each version a (row, lane, colorIdx) using DFS pre-order:
 *   - First child (chronologically oldest) inherits the parent's lane (main branch continues).
 *   - Subsequent children get new lanes to the right (branches).
 * This produces a git-log style layout where the primary lineage stays in lane 0
 * and branches fan out to the right.
 */
function buildLayout(versions: VersionWithAnalysis[]): NodeLayout[] {
  if (!versions.length) return [];

  const childrenMap = new Map<number | null, VersionWithAnalysis[]>();
  versions.forEach(v => {
    const p = v.parent_dataset_id ?? null;
    if (!childrenMap.has(p)) childrenMap.set(p, []);
    childrenMap.get(p)!.push(v);
  });
  // Oldest child first so chronological order is preserved
  childrenMap.forEach(children =>
    children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );

  const result: NodeLayout[] = [];
  let nextLane = 1;
  let currentRow = 0;

  function dfs(parentId: number | null, lane: number, colorIdx: number) {
    const children = childrenMap.get(parentId) || [];
    children.forEach((v, i) => {
      const myLane = i === 0 ? lane : nextLane;
      const myColorIdx = i === 0 ? colorIdx : nextLane % LANE_COLORS.length;
      if (i > 0) nextLane++;
      result.push({ version: v, row: currentRow++, lane: myLane, colorIdx: myColorIdx });
      dfs(v.id, myLane, myColorIdx);
    });
  }

  dfs(null, 0, 0);
  return result;
}

// ─── SVG graph component ───────────────────────────────────────────────────

interface TreeSVGProps {
  layout: NodeLayout[];
  datasetId: number;
  onNavigate: (id: number) => void;
}

function TreeSVG({ layout, datasetId, onNavigate }: TreeSVGProps) {
  const [hoveredId, setHoveredId] = React.useState<number | null>(null);
  if (!layout.length) return null;

  const nodeMap = new Map<number, NodeLayout>();
  layout.forEach(n => nodeMap.set(n.version.id, n));

  const maxLane = Math.max(...layout.map(n => n.lane));
  const svgW = SVG_PAD + (maxLane + 1) * LANE_W;
  const svgH = layout.length * ROW_H;

  // Center of lane `l` on the X axis
  const cx = (l: number) => SVG_PAD + l * LANE_W;
  // Center of row `r` on the Y axis
  const cy = (r: number) => r * ROW_H + ROW_H / 2;

  const edgePaths: JSX.Element[] = [];
  const dotEls: JSX.Element[] = [];

  // ── Edges ──────────────────────────────────────────────────────────────
  layout.forEach(child => {
    const parentId = child.version.parent_dataset_id;
    if (!parentId) return;
    const parent = nodeMap.get(parentId);
    if (!parent) return;

    const x1 = cx(parent.lane);
    const y1 = cy(parent.row);
    const x2 = cx(child.lane);
    const y2 = cy(child.row);
    const col = laneColor(child.colorIdx);

    let d: string;
    if (parent.lane === child.lane) {
      // Straight vertical — main branch continues
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
      // Branch: leave parent going down, curve to the branch lane, then straight down.
      // The curve is contained within the top portion of the parent's row so the
      // branch line appears to split cleanly from the parent node.
      const curveDepth = ROW_H * 0.42;
      d = [
        `M ${x1} ${y1}`,
        `C ${x1} ${y1 + curveDepth} ${x2} ${y1 + curveDepth} ${x2} ${y1 + curveDepth * 1.55}`,
        `L ${x2} ${y2}`,
      ].join(' ');
    }

    edgePaths.push(
      <path
        key={`e-${parent.version.id}-${child.version.id}`}
        d={d}
        fill="none"
        stroke={col}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.65}
      />
    );
  });

  // ── Dots ───────────────────────────────────────────────────────────────
  layout.forEach(node => {
    const x = cx(node.lane);
    const y = cy(node.row);
    const col = laneColor(node.colorIdx);
    const isCurrent = node.version.id === datasetId;
    const isHovered = hoveredId === node.version.id;

    dotEls.push(
      <g
        key={`node-${node.version.id}`}
        onClick={() => onNavigate(node.version.id)}
        onMouseEnter={() => setHoveredId(node.version.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{ cursor: isCurrent ? 'default' : 'pointer' }}
      >
        {/* Glow ring — current node or hover */}
        {(isCurrent || isHovered) && (
          <circle
            cx={x} cy={y} r={DOT_R + 4.5}
            fill={isCurrent ? `${col}22` : `${col}18`}
            stroke={col}
            strokeWidth={isCurrent ? 1.2 : 1}
            opacity={isCurrent ? 1 : 0.7}
          />
        )}
        {/* Visible dot */}
        <circle
          cx={x} cy={y} r={DOT_R}
          fill={isCurrent || isHovered ? col : '#fff'}
          stroke={col}
          strokeWidth={2.5}
        />
        {/* Invisible hit area — makes it easier to click the small dot */}
        <circle
          cx={x} cy={y} r={DOT_R + 8}
          fill="transparent"
        />
      </g>
    );
  });

  return (
    <svg
      width={svgW}
      height={svgH}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
    >
      {edgePaths}
      {dotEls}
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

const DatasetVersionHistory: React.FC<DatasetVersionHistoryProps> = ({
  datasetId,
  projectId,
  onCompare,
  onOpenCanvas,
}) => {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTag, setEditTag] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const startEdit = (v: VersionWithAnalysis) => { setEditingId(v.id); setEditTag(v.version_tag || ''); };
  const cancelEdit = () => { setEditingId(null); setEditTag(''); };

  const saveEdit = async (v: VersionWithAnalysis) => {
    setSavingId(v.id);
    try {
      await (datasetsAPI as any).patchVersionTag(projectId, v.id, { version_tag: editTag.trim() || null });
      setVersions(prev =>
        prev.map(ver => ver.id === v.id ? { ...ver, version_tag: editTag.trim() || undefined } : ver)
      );
    } catch { /* keep original */ } finally { setSavingId(null); setEditingId(null); }
  };

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setLoading(true);
        const response = await datasetsAPI.getDatasetVersions(projectId, datasetId);
        const data = response?.data?.data || response?.data || {};
        setVersions(data.versions || []);
        setError(null);
      } catch {
        setError('No se pudieron cargar las versiones del dataset');
      } finally {
        setLoading(false);
      }
    };
    if (datasetId && projectId) fetchVersions();
  }, [datasetId, projectId]);

  const layout = useMemo(() => buildLayout(versions), [versions]);
  const isBranched = layout.some(n => n.lane > 0);

  const qualityIcon = (status: string | null | undefined) => {
    if (status === 'PASSED') return <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 17 }} />;
    if (status === 'FAILED') return <ErrorIcon sx={{ color: '#E5484D', fontSize: 17 }} />;
    if (status === 'WARNING') return <WarningIcon sx={{ color: '#FFB800', fontSize: 17 }} />;
    return <ScheduleIcon sx={{ color: '#BDBDBD', fontSize: 17 }} />;
  };

  const scoreColor = (score: number | null | undefined) =>
    score == null ? '#BDBDBD' : score >= 70 ? '#00B37E' : '#E5484D';

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const handleCompare = (versionId: number) => {
    if (selectedForCompare === null) {
      setSelectedForCompare(versionId);
    } else if (selectedForCompare === versionId) {
      setSelectedForCompare(null);
    } else {
      router.push(`/datasets/compare?a=${selectedForCompare}&b=${versionId}&projectId=${projectId}`);
      setSelectedForCompare(null);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={32} /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }
  if (versions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No hay historial de versiones disponible
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={versions.length === 1 ? '1 versión' : `${versions.length} versiones`}
            size="small"
            sx={{ backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E', fontWeight: 500, height: 22 }}
          />
          {isBranched && (
            <Chip
              label="Ramificado"
              size="small"
              sx={{ backgroundColor: 'rgba(156,39,176,0.1)', color: '#9c27b0', fontWeight: 500, height: 22 }}
            />
          )}
        </Box>
        {onOpenCanvas && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
            onClick={onOpenCanvas}
            sx={{
              fontSize: '0.78rem',
              textTransform: 'none',
              borderColor: '#E0E0E0',
              color: '#555',
              '&:hover': { borderColor: '#00B37E', color: '#00B37E', backgroundColor: 'rgba(0,179,126,0.04)' },
            }}
          >
            Ver árbol visual
          </Button>
        )}
      </Box>

      {selectedForCompare && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona otra versión para comparar con{' '}
          <strong>
            {versions.find(v => v.id === selectedForCompare)?.version_tag
              || `v${versions.find(v => v.id === selectedForCompare)?.version}`}
          </strong>
        </Alert>
      )}

      {/* ── Tree ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>

        {/* SVG graph — renders all edges and dots on a shared canvas */}
        <TreeSVG
          layout={layout}
          datasetId={datasetId}
          onNavigate={id => router.push(`/datasets/${id}`)}
        />

        {/* Cards — one per row, fixed height to align with SVG rows */}
        <Box sx={{ flex: 1, ml: 1.5, minWidth: 0 }}>
          {layout.map(node => {
            const v = node.version;
            const isCurrent = v.id === datasetId;
            const col = laneColor(node.colorIdx);

            return (
              <Box
                key={v.id}
                sx={{ height: ROW_H, display: 'flex', alignItems: 'center' }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    flex: 1,
                    px: 1.75,
                    py: 0.9,
                    border: '1px solid',
                    borderColor: isCurrent
                      ? '#00B37E'
                      : selectedForCompare === v.id ? '#9c27b0' : '#EDEDED',
                    borderRadius: 1.5,
                    backgroundColor: isCurrent
                      ? 'rgba(0,179,126,0.04)'
                      : selectedForCompare === v.id ? 'rgba(156,39,176,0.04)' : '#fff',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    '&:hover': { borderColor: col, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' },
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>

                    {/* Left: tag / edit, badges, date */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
                      {editingId === v.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            size="small"
                            value={editTag}
                            onChange={e => setEditTag(e.target.value)}
                            placeholder={`v${v.version}`}
                            sx={{ width: 110, '& input': { fontSize: '0.75rem', py: '3px', px: '8px' } }}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(v);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                          <IconButton size="small" onClick={() => saveEdit(v)} disabled={savingId === v.id}>
                            {savingId === v.id
                              ? <CircularProgress size={13} />
                              : <CheckIcon sx={{ fontSize: 13, color: '#00B37E' }} />}
                          </IconButton>
                          <IconButton size="small" onClick={cancelEdit}>
                            <CloseIcon sx={{ fontSize: 13, color: '#999' }} />
                          </IconButton>
                        </Box>
                      ) : (
                        <>
                          <Chip
                            label={v.version_tag || `v${v.version}`}
                            size="small"
                            sx={{
                              height: 22, fontSize: '0.73rem', fontWeight: 700,
                              backgroundColor: `${col}1a`, color: col,
                            }}
                          />
                          {v.is_latest && (
                            <Chip
                              label="Latest" size="small"
                              sx={{ height: 18, fontSize: '0.63rem', backgroundColor: 'rgba(25,118,210,0.1)', color: '#1976d2', fontWeight: 600 }}
                            />
                          )}
                          {isCurrent && (
                            <Chip
                              label="Actual" size="small"
                              sx={{ height: 18, fontSize: '0.63rem', backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E', fontWeight: 600 }}
                            />
                          )}
                          {node.lane > 0 && (
                            <Chip
                              label="rama" size="small"
                              sx={{ height: 18, fontSize: '0.63rem', backgroundColor: `${col}18`, color: col, fontWeight: 500 }}
                            />
                          )}
                          <Tooltip title="Editar etiqueta">
                            <IconButton size="small" onClick={() => startEdit(v)} sx={{ opacity: 0.3, '&:hover': { opacity: 1 }, p: 0.2 }}>
                              <EditIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {formatDate(v.created_at)}
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Right: quality score + actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                        {qualityIcon(v.latestAnalysis?.quality_gate_status)}
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, fontSize: '0.82rem', color: scoreColor(v.latestAnalysis?.quality_score) }}
                        >
                          {v.latestAnalysis?.quality_score != null
                            ? `${Number(v.latestAnalysis.quality_score).toFixed(1)}%`
                            : '—'}
                        </Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {v.row_count?.toLocaleString() || '—'} filas · {v.column_count || '—'} cols
                      </Typography>
                      <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                      <Tooltip title="Ver dataset">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/datasets/${v.id}`)}
                          sx={{ color: '#00B37E', p: 0.5 }}
                        >
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {onCompare && versions.length > 1 && (
                        <Tooltip title={selectedForCompare === v.id ? 'Cancelar comparación' : 'Comparar'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCompare(v.id)}
                            sx={{
                              p: 0.5,
                              color: selectedForCompare === v.id ? '#9c27b0' : '#bbb',
                              backgroundColor: selectedForCompare === v.id ? 'rgba(156,39,176,0.1)' : 'transparent',
                            }}
                          >
                            <CompareArrowsIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {v.description && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {v.description}
                    </Typography>
                  )}
                </Paper>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default DatasetVersionHistory;
