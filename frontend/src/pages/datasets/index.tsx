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
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountTree as AccountTreeIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI, projectsAPI } from '../../services/api';
import { Dataset, Project } from '../../types';

interface DatasetGroup {
  rootId: number;
  latestDataset: Dataset;
  allVersions: Dataset[];
}

const DatasetsList = () => {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projects, setProjects] = useState<Record<number, Project>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await datasetsAPI.getAllDatasets();
        const data: Dataset[] = res?.data?.data ?? res?.data ?? [];
        if (cancelled) return;

        const list = Array.isArray(data) ? data : [];
        setDatasets(list);

        // Fetch project names for all unique project IDs
        const uniqueProjectIds = [...new Set(list.map(d => d.project_id).filter(Boolean))];
        const projectsMap: Record<number, Project> = {};
        await Promise.all(
          uniqueProjectIds.map(async (pid) => {
            try {
              const pr = await projectsAPI.getProject(pid);
              projectsMap[pid] = pr?.data?.data ?? pr?.data ?? ({ id: pid, name: `Proyecto ${pid}` } as Project);
            } catch {
              projectsMap[pid] = { id: pid, name: `Proyecto ${pid}` } as Project;
            }
          })
        );
        if (!cancelled) setProjects(projectsMap);
      } catch {
        if (!cancelled) setError('No se pudieron cargar los datasets. Verifica la conexión con el servidor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Group datasets by version chain (parent_dataset_id)
  const groupedDatasets = React.useMemo<DatasetGroup[]>(() => {
    const idMap = new Map(datasets.map(d => [d.id, d]));

    const findRoot = (d: Dataset): number => {
      if (!d.parent_dataset_id) return d.id;
      const parent = idMap.get(d.parent_dataset_id);
      return parent ? findRoot(parent) : d.id;
    };

    const groupMap = new Map<number, Dataset[]>();
    datasets.forEach(d => {
      const rootId = findRoot(d);
      if (!groupMap.has(rootId)) groupMap.set(rootId, []);
      groupMap.get(rootId)!.push(d);
    });

    return Array.from(groupMap.entries())
      .map(([rootId, versions]) => {
        versions.sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
        const latest = versions.find(v => v.is_latest) ?? versions[0];
        return { rootId, latestDataset: latest, allVersions: versions };
      })
      .sort((a, b) => {
        const ta = new Date(a.latestDataset.updated_at || a.latestDataset.created_at).getTime();
        const tb = new Date(b.latestDataset.updated_at || b.latestDataset.created_at).getTime();
        return tb - ta;
      });
  }, [datasets]);

  const filteredGroups = groupedDatasets.filter(group => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return group.allVersions.some(d =>
      d.name.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      (projects[d.project_id]?.name ?? '').toLowerCase().includes(q)
    );
  });

  const toggleGroup = (rootId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(rootId) ? next.delete(rootId) : next.add(rootId);
      return next;
    });
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const fmtSize = (bytes?: number | null) => {
    if (!bytes) return null;
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const renderStats = (d: Dataset) => {
    const parts: string[] = [];
    const size = fmtSize(d.file_size);
    if (size) parts.push(size);
    if (d.row_count) parts.push(`${d.row_count.toLocaleString('es-ES')} filas`);
    if (d.column_count) parts.push(`${d.column_count} cols`);
    return parts.join(' · ') || '—';
  };

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* ── Header ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Datasets
            </Typography>
            {!loading && !error && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {groupedDatasets.length} dataset{groupedDatasets.length !== 1 ? 's' : ''}
                {datasets.length > groupedDatasets.length && (
                  <> · {datasets.length} versiones totales</>
                )}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/datasets/upload')}
            sx={{ backgroundColor: '#00B37E', color: '#fff', '&:hover': { backgroundColor: '#00A070' }, textTransform: 'none' }}
          >
            Subir dataset
          </Button>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          {/* ── Search bar ── */}
          <Box sx={{ p: 2, borderBottom: '1px solid #F0F0F0', backgroundColor: '#FAFAFA' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre, descripción o proyecto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#999', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, backgroundColor: '#fff' } }}
            />
          </Box>

          {/* ── Error ── */}
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
          )}

          {/* ── Loading ── */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>

          ) : filteredGroups.length === 0 ? (
            /* ── Empty state ── */
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <StorageIcon sx={{ fontSize: 52, color: '#D0D0D0', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
                {searchTerm
                  ? 'No hay datasets que coincidan con la búsqueda.'
                  : 'Aún no hay datasets. Sube el primero.'}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => router.push('/datasets/upload')}
                  sx={{ backgroundColor: '#00B37E', color: '#fff', '&:hover': { backgroundColor: '#00A070' }, textTransform: 'none' }}
                >
                  Subir dataset
                </Button>
              )}
            </Box>

          ) : (
            /* ── Table ── */
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{
                    backgroundColor: '#F8F8F8',
                    '& th': { fontWeight: 600, fontSize: '0.78rem', color: '#555', borderBottom: '2px solid #EEEEEE', py: 1.25 },
                  }}>
                    <TableCell sx={{ width: 36, px: 1 }} />
                    <TableCell>Nombre</TableCell>
                    <TableCell>Proyecto</TableCell>
                    <TableCell>Versión</TableCell>
                    <TableCell>Tamaño · Filas · Cols</TableCell>
                    <TableCell>Actualizado</TableCell>
                    <TableCell align="right" sx={{ pr: 2 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGroups.map(group => {
                    const { rootId, latestDataset: d, allVersions } = group;
                    const isExpanded = expandedGroups.has(rootId);
                    const hasVersions = allVersions.length > 1;

                    return (
                      <React.Fragment key={rootId}>
                        {/* ── Main row (latest version) ── */}
                        <TableRow
                          hover
                          onClick={() => router.push(`/datasets/${d.id}`)}
                          sx={{
                            cursor: 'pointer',
                            '& td': { borderBottom: isExpanded ? '1px solid #F0F0F0' : undefined },
                            '&:hover': { backgroundColor: 'rgba(0,179,126,0.03)' },
                          }}
                        >
                          {/* Expand toggle */}
                          <TableCell sx={{ px: 1, py: 0.5, width: 36 }}>
                            {hasVersions && (
                              <IconButton
                                size="small"
                                onClick={e => { e.stopPropagation(); toggleGroup(rootId); }}
                                sx={{ color: '#9c27b0', p: 0.5 }}
                              >
                                {isExpanded
                                  ? <ExpandLessIcon sx={{ fontSize: 18 }} />
                                  : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                              </IconButton>
                            )}
                          </TableCell>

                          {/* Name + description */}
                          <TableCell sx={{ py: 1.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                                {d.name}
                              </Typography>
                              <Chip label="Latest" size="small" sx={{
                                height: 18, fontSize: '0.62rem', fontWeight: 600,
                                backgroundColor: 'rgba(0,179,126,0.1)', color: '#00B37E',
                              }} />
                            </Box>
                            {d.description && (
                              <Typography variant="caption" color="text.secondary" sx={{
                                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', maxWidth: 280, fontSize: '0.72rem',
                              }}>
                                {d.description}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Project */}
                          <TableCell>
                            <Chip
                              label={projects[d.project_id]?.name ?? `Proyecto ${d.project_id}`}
                              size="small"
                              onClick={e => { e.stopPropagation(); router.push(`/projects/${d.project_id}`); }}
                              sx={{
                                height: 22, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer',
                                backgroundColor: 'rgba(0,179,126,0.08)', color: '#00B37E',
                                '&:hover': { backgroundColor: 'rgba(0,179,126,0.16)' },
                              }}
                            />
                          </TableCell>

                          {/* Version */}
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Chip
                                label={d.version_tag || `v${d.version ?? 1}`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.06)', color: '#444' }}
                              />
                              {hasVersions && (
                                <Tooltip title={`${allVersions.length} versiones disponibles`}>
                                  <Chip
                                    icon={<AccountTreeIcon sx={{ fontSize: '11px !important' }} />}
                                    label={allVersions.length}
                                    size="small"
                                    onClick={e => { e.stopPropagation(); toggleGroup(rootId); }}
                                    sx={{
                                      height: 20, fontSize: '0.7rem', cursor: 'pointer',
                                      backgroundColor: 'rgba(156,39,176,0.08)', color: '#9c27b0',
                                      '&:hover': { backgroundColor: 'rgba(156,39,176,0.15)' },
                                    }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>

                          {/* Stats */}
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                              {renderStats(d)}
                            </Typography>
                          </TableCell>

                          {/* Date */}
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                              {fmtDate(d.updated_at || d.created_at)}
                            </Typography>
                          </TableCell>

                          {/* Actions */}
                          <TableCell align="right" sx={{ pr: 1.5 }}>
                            <Tooltip title="Ver dataset">
                              <IconButton
                                size="small"
                                onClick={e => { e.stopPropagation(); router.push(`/datasets/${d.id}`); }}
                                sx={{ color: '#00B37E', '&:hover': { backgroundColor: 'rgba(0,179,126,0.08)' } }}
                              >
                                <VisibilityIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>

                        {/* ── Expanded: previous versions ── */}
                        {hasVersions && (
                          <TableRow sx={{ '& > td': { p: 0 } }}>
                            <TableCell colSpan={7}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ backgroundColor: 'rgba(156,39,176,0.015)', borderBottom: '1px solid #F0F0F0' }}>
                                  {allVersions
                                    .filter(v => v.id !== d.id)
                                    .map((v, idx, arr) => (
                                      <Box
                                        key={v.id}
                                        onClick={() => router.push(`/datasets/${v.id}`)}
                                        sx={{
                                          display: 'flex', alignItems: 'center', gap: 2,
                                          pl: 2, pr: 1.5, py: 1,
                                          cursor: 'pointer',
                                          borderBottom: idx < arr.length - 1 ? '1px solid #F5F5F5' : 'none',
                                          '&:hover': { backgroundColor: 'rgba(156,39,176,0.04)' },
                                        }}
                                      >
                                        {/* Branch indicator */}
                                        <Box sx={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Box sx={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            border: '2px solid #9c27b0', opacity: 0.45,
                                          }} />
                                        </Box>

                                        {/* Version chip */}
                                        <Chip
                                          label={v.version_tag || `v${v.version ?? 1}`}
                                          size="small"
                                          sx={{
                                            height: 20, fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                                            backgroundColor: 'rgba(156,39,176,0.08)', color: '#9c27b0',
                                          }}
                                        />

                                        {/* Name */}
                                        <Typography variant="body2" sx={{ flex: 1, color: '#555', fontSize: '0.8rem', minWidth: 0,
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {v.name}
                                        </Typography>

                                        {/* Stats */}
                                        <Typography variant="caption" color="text.secondary"
                                          sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', minWidth: 150 }}>
                                          {renderStats(v)}
                                        </Typography>

                                        {/* Date */}
                                        <Typography variant="caption" color="text.secondary"
                                          sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', minWidth: 90 }}>
                                          {fmtDate(v.created_at)}
                                        </Typography>

                                        {/* Action */}
                                        <Tooltip title="Ver esta versión">
                                          <IconButton
                                            size="small"
                                            onClick={e => { e.stopPropagation(); router.push(`/datasets/${v.id}`); }}
                                            sx={{ color: '#9c27b0', flexShrink: 0,
                                              '&:hover': { backgroundColor: 'rgba(156,39,176,0.08)' } }}
                                          >
                                            <VisibilityIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    ))}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </MainLayout>
  );
};

export default DatasetsList;
