import React, { useState, useEffect } from 'react';
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

interface FlatNode {
  version: VersionWithAnalysis;
  depth: number;
  /** For each depth level 0..depth, whether that level has more siblings after current subtree */
  hasMoreSiblings: boolean[];
  branchColorIdx: number;
}

interface DatasetVersionHistoryProps {
  datasetId: number;
  projectId: number;
  onCompare?: (versionA: number, versionB: number) => void;
}

const BRANCH_COLORS = ['#00B37E', '#9c27b0', '#1976d2', '#f57c00', '#e91e63', '#00bcd4'];
const COL_W = 22; // px per depth column in the graph

/** Look ahead in flatNodes to find which branchColorIdx will appear next at depth d after nodeIdx */
function getAncestorLineColor(flatNodes: FlatNode[], nodeIdx: number, d: number): string {
  for (let j = nodeIdx + 1; j < flatNodes.length; j++) {
    if (flatNodes[j].depth === d) return BRANCH_COLORS[flatNodes[j].branchColorIdx % BRANCH_COLORS.length];
  }
  return BRANCH_COLORS[0];
}

function buildFlatTree(
  parentId: number | null,
  depth: number,
  siblingsStack: boolean[],
  childrenMap: Map<number | null, VersionWithAnalysis[]>,
  parentColorIdx: number,
  nextColorIdx: { value: number },
  result: FlatNode[]
) {
  const children = (childrenMap.get(parentId) || []).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  children.forEach((v, i) => {
    const isLast = i === children.length - 1;
    const colorIdx = i === 0 ? parentColorIdx : nextColorIdx.value++;
    result.push({
      version: v,
      depth,
      hasMoreSiblings: [...siblingsStack, !isLast],
      branchColorIdx: colorIdx,
    });
    buildFlatTree(v.id, depth + 1, [...siblingsStack, !isLast], childrenMap, colorIdx, nextColorIdx, result);
  });
}

const DatasetVersionHistory: React.FC<DatasetVersionHistoryProps> = ({
  datasetId,
  projectId,
  onCompare,
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
      setVersions(prev => prev.map(ver => ver.id === v.id ? { ...ver, version_tag: editTag.trim() || undefined } : ver));
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
      } catch (err: any) {
        setError('No se pudieron cargar las versiones del dataset');
      } finally {
        setLoading(false);
      }
    };
    if (datasetId && projectId) fetchVersions();
  }, [datasetId, projectId]);

  const qualityIcon = (status: string | null | undefined) => {
    if (status === 'PASSED') return <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 17 }} />;
    if (status === 'FAILED') return <ErrorIcon sx={{ color: '#E5484D', fontSize: 17 }} />;
    if (status === 'WARNING') return <WarningIcon sx={{ color: '#FFB800', fontSize: 17 }} />;
    return <ScheduleIcon sx={{ color: '#BDBDBD', fontSize: 17 }} />;
  };

  const scoreColor = (score: number | null | undefined) => {
    if (score == null) return '#BDBDBD';
    return score >= 70 ? '#00B37E' : '#E5484D';
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleCompare = (versionId: number) => {
    if (selectedForCompare === null) { setSelectedForCompare(versionId); }
    else if (selectedForCompare === versionId) { setSelectedForCompare(null); }
    else {
      router.push(`/datasets/compare?a=${selectedForCompare}&b=${versionId}&projectId=${projectId}`);
      setSelectedForCompare(null);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={32} /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (versions.length === 0) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary">No hay historial de versiones disponible</Typography>
    </Box>
  );

  // Build tree structure
  const childrenMap = new Map<number | null, VersionWithAnalysis[]>();
  versions.forEach(v => {
    const p = v.parent_dataset_id ?? null;
    if (!childrenMap.has(p)) childrenMap.set(p, []);
    childrenMap.get(p)!.push(v);
  });

  const flatNodes: FlatNode[] = [];
  buildFlatTree(null, 0, [], childrenMap, 0, { value: 1 }, flatNodes);

  const isBranched = versions.some(v => {
    const siblings = childrenMap.get(v.parent_dataset_id ?? null) || [];
    return siblings.length > 1;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Árbol de versiones</Typography>
          <Chip
            label={`${versions.length} versión${versions.length !== 1 ? 'es' : ''}`}
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
      </Box>

      {selectedForCompare && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona otra versión para comparar con{' '}
          <strong>{versions.find(v => v.id === selectedForCompare)?.version_tag || `v${versions.find(v => v.id === selectedForCompare)?.version}`}</strong>
        </Alert>
      )}

      {/* Tree rows */}
      <Box>
        {flatNodes.map((node, nodeIdx) => {
          const v = node.version;
          const isCurrent = v.id === datasetId;
          const col = BRANCH_COLORS[node.branchColorIdx % BRANCH_COLORS.length];
          const graphWidth = node.depth * COL_W + 28;
          const dotLeft = node.depth * COL_W + 4;
          const hasChildren = (childrenMap.get(v.id) || []).length > 0;
          const hasMoreSelf = node.hasMoreSiblings[node.depth];

          return (
            <Box key={v.id} sx={{ display: 'flex', alignItems: 'stretch', mb: 0.75, minHeight: 54 }}>
              {/* ── Graph column ── */}
              <Box sx={{ width: graphWidth, flexShrink: 0, position: 'relative', mr: 1.5 }}>

                {/* Ancestor continuation lines (vertical, one per ancestor depth that still has siblings) */}
                {node.hasMoreSiblings.slice(0, node.depth + 1).map((active, di) => active && (
                  <Box key={di} sx={{
                    position: 'absolute',
                    left: Math.max(di - 1, 0) * COL_W + 11,
                    top: '-3px', bottom: '-3px', width: 2,
                    backgroundColor: getAncestorLineColor(flatNodes, nodeIdx, di),
                    opacity: 0.55,
                  }} />
                ))}

                {/* Line from previous row into this dot */}
                {nodeIdx > 0 && (
                  <Box sx={{
                    position: 'absolute',
                    left: dotLeft + 7,
                    top: '-3px', height: 'calc(50% + 3px)', width: 2,
                    backgroundColor: col, opacity: 0.55,
                  }} />
                )}

                {/* Line from this dot downward (if has children or more siblings follow) */}
                {hasChildren && (
                  <Box sx={{
                    position: 'absolute',
                    left: dotLeft + 7,
                    top: '50%', bottom: '-3px', width: 2,
                    backgroundColor: col, opacity: 0.55,
                  }} />
                )}

                {/* Horizontal branch connector (depth > 0 → L-turn from parent column) */}
                {node.depth > 0 && (
                  <Box sx={{
                    position: 'absolute',
                    left: (node.depth - 1) * COL_W + 11,
                    top: '50%', marginTop: '-1px',
                    width: COL_W + 1, height: 2,
                    backgroundColor: col, opacity: 0.65,
                  }} />
                )}

                {/* Node dot */}
                <Box sx={{
                  position: 'absolute',
                  left: dotLeft,
                  top: '50%', transform: 'translateY(-50%)',
                  width: 14, height: 14, borderRadius: '50%',
                  backgroundColor: isCurrent ? col : 'white',
                  border: `2.5px solid ${col}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${col}33` : '0 1px 3px rgba(0,0,0,0.15)',
                  zIndex: 2,
                }} />
              </Box>

              {/* ── Version card ── */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  px: 1.75, py: 1,
                  border: '1px solid',
                  borderColor: isCurrent ? '#00B37E' : selectedForCompare === v.id ? '#9c27b0' : '#EDEDED',
                  borderRadius: 1.5,
                  backgroundColor: isCurrent
                    ? 'rgba(0,179,126,0.04)'
                    : selectedForCompare === v.id ? 'rgba(156,39,176,0.04)' : 'white',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: col, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  {/* Left: tag, badges, date */}
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
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(v); if (e.key === 'Escape') cancelEdit(); }}
                        />
                        <IconButton size="small" onClick={() => saveEdit(v)} disabled={savingId === v.id}>
                          {savingId === v.id ? <CircularProgress size={13} /> : <CheckIcon sx={{ fontSize: 13, color: '#00B37E' }} />}
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
                          sx={{ height: 22, fontSize: '0.73rem', fontWeight: 700, backgroundColor: `${col}1a`, color: col }}
                        />
                        {v.is_latest && (
                          <Chip label="Latest" size="small" sx={{ height: 18, fontSize: '0.63rem', backgroundColor: 'rgba(25,118,210,0.1)', color: '#1976d2', fontWeight: 600 }} />
                        )}
                        {isCurrent && (
                          <Chip label="Actual" size="small" sx={{ height: 18, fontSize: '0.63rem', backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E', fontWeight: 600 }} />
                        )}
                        {node.depth > 0 && (
                          <Chip label="rama" size="small" sx={{ height: 18, fontSize: '0.63rem', backgroundColor: `${col}18`, color: col, fontWeight: 500 }} />
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

                  {/* Right: metrics + actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      {qualityIcon(v.latestAnalysis?.quality_gate_status)}
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', color: scoreColor(v.latestAnalysis?.quality_score) }}>
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
                      <IconButton size="small" onClick={() => router.push(`/datasets/${v.id}`)} sx={{ color: '#00B37E', p: 0.5 }}>
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
                    sx={{ mt: 0.25, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
  );
};

export default DatasetVersionHistory;
