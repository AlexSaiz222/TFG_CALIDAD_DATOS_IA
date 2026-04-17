import React, { useState, useMemo } from 'react';
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
  TableSortLabel,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Collapse,
  Grid,
  Button,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  NewReleases as NewReleasesIcon,
  Replay as ReplayIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { DataQualityIssue } from '../types';
import { useTranslation } from 'react-i18next';

// Colores consistentes
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const BLUE = '#3B82F6';
const GRAY = '#888888';

// Severity config without labels (labels resolved via i18n inside component)
const SEVERITY_CONFIG_BASE = {
  critical: { color: RED, bgColor: 'rgba(229, 72, 77, 0.1)', icon: ErrorIcon, order: 0 },
  major:    { color: ORANGE, bgColor: 'rgba(255, 184, 0, 0.1)', icon: WarningIcon, order: 1 },
  minor:    { color: BLUE, bgColor: 'rgba(59, 130, 246, 0.1)', icon: InfoIcon, order: 2 },
  info:     { color: GRAY, bgColor: 'rgba(136, 136, 136, 0.1)', icon: CheckCircleIcon, order: 3 },
};

type SeverityBase = typeof SEVERITY_CONFIG_BASE;
const SEVERITY_CONFIG = SEVERITY_CONFIG_BASE as Record<string, { color: string; bgColor: string; icon: any; order: number }>;

type SeverityType = keyof typeof SEVERITY_CONFIG;
type SortField = 'severity' | 'issue_type' | 'created_at' | 'is_new';
type SortOrder = 'asc' | 'desc';

interface IssuesListProps {
  issues: DataQualityIssue[];
  loading?: boolean;
}

const IssuesList: React.FC<IssuesListProps> = ({ issues, loading = false }) => {
  const { t } = useTranslation();
  // Filtros
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Ordenación
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Obtener tipos únicos de issues
  const issueTypes = useMemo(() => {
    const types = new Set(issues.map((issue) => issue.issue_type));
    return Array.from(types).sort();
  }, [issues]);

  // Filtrar y ordenar issues
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...issues];

    // Aplicar filtro de severidad
    if (severityFilter !== 'all') {
      result = result.filter((issue) => issue.severity === severityFilter);
    }

    // Aplicar filtro de estado (new vs recurrent)
    if (statusFilter === 'new') {
      result = result.filter((issue) => issue.is_new);
    } else if (statusFilter === 'recurrent') {
      result = result.filter((issue) => !issue.is_new);
    }

    // Aplicar filtro de tipo
    if (typeFilter !== 'all') {
      result = result.filter((issue) => issue.issue_type === typeFilter);
    }

    // Aplicar búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (issue) =>
          issue.description.toLowerCase().includes(term) ||
          issue.issue_type.toLowerCase().includes(term) ||
          (issue.affected_columns && 
            issue.affected_columns.some((col: string) => col.toLowerCase().includes(term)))
      );
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'severity':
          const severityA = SEVERITY_CONFIG[a.severity as SeverityType]?.order ?? 99;
          const severityB = SEVERITY_CONFIG[b.severity as SeverityType]?.order ?? 99;
          comparison = severityA - severityB;
          break;
        case 'issue_type':
          comparison = a.issue_type.localeCompare(b.issue_type);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'is_new':
          comparison = (a.is_new ? 0 : 1) - (b.is_new ? 0 : 1);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [issues, severityFilter, statusFilter, typeFilter, searchTerm, sortField, sortOrder]);

  // Paginación
  const paginatedIssues = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedIssues.slice(start, start + rowsPerPage);
  }, [filteredAndSortedIssues, page, rowsPerPage]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const clearFilters = () => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchTerm('');
    setPage(0);
  };

  const hasActiveFilters = severityFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || searchTerm !== '';

  const SEVERITY_LABELS: Record<string, string> = {
    critical: t('issuesList.severity.critical'),
    major: t('issuesList.severity.high'),
    minor: t('issuesList.severity.medium'),
    info: t('issuesList.severity.info'),
  };

  // Renderizar badge de severidad
  const renderSeverityBadge = (severity: string) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
    const IconComponent = config.icon;

    return (
      <Chip
        icon={<IconComponent sx={{ fontSize: 16 }} />}
        label={SEVERITY_LABELS[severity] || severity}
        size="small"
        sx={{
          backgroundColor: config.bgColor,
          color: config.color,
          fontWeight: 500,
          '& .MuiChip-icon': { color: config.color },
        }}
      />
    );
  };

  // Renderizar badge NEW/RECURRENT
  const renderStatusBadge = (isNew: boolean) => {
    if (isNew) {
      return (
        <Chip
          icon={<NewReleasesIcon sx={{ fontSize: 14 }} />}
          label={t('issuesList.newBadge')}
          size="small"
          sx={{
            backgroundColor: 'rgba(229, 72, 77, 0.1)',
            color: RED,
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            '& .MuiChip-icon': { color: RED },
          }}
        />
      );
    }
    return (
      <Chip
        icon={<ReplayIcon sx={{ fontSize: 14 }} />}
        label={t('issuesList.recurring')}
        size="small"
        sx={{
          backgroundColor: 'rgba(136, 136, 136, 0.1)',
          color: GRAY,
          fontWeight: 500,
          fontSize: '0.7rem',
          height: 22,
          '& .MuiChip-icon': { color: GRAY },
        }}
      />
    );
  };

  if (issues.length === 0 && !loading) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 48, color: GREEN, mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#555555' }}>
          {t('issuesList.noIssues')}
        </Typography>
        <Typography variant="body2" sx={{ color: '#888888' }}>
          {t('issuesList.noIssuesDesc')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #EEEEEE', overflow: 'hidden' }}>
      {/* Header con filtros */}
      <Box sx={{ p: 2, borderBottom: '1px solid #EEEEEE', backgroundColor: '#FAFAFA' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: showFilters ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Issues ({filteredAndSortedIssues.length})
            </Typography>
            {hasActiveFilters && (
              <Chip
                label={t('issuesList.activeFilters')}
                size="small"
                onDelete={clearFilters}
                sx={{ backgroundColor: 'rgba(0, 179, 126, 0.1)', color: GREEN }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder={t('common.search') + '...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: GRAY, fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ width: 200 }}
            />
            <Tooltip title={showFilters ? t('common.hideFilters') : t('common.showFilters')}>
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                <FilterListIcon sx={{ color: hasActiveFilters ? GREEN : GRAY }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Panel de filtros */}
        <Collapse in={showFilters}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('issuesList.filterSeverity')}</InputLabel>
                <Select
                  value={severityFilter}
                  label={t('issuesList.filterSeverity')}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">{t('issuesList.allSeverities')}</MenuItem>
                  <MenuItem value="critical">{t('issuesList.severity.critical')}</MenuItem>
                  <MenuItem value="major">{t('issuesList.severity.high')}</MenuItem>
                  <MenuItem value="minor">{t('issuesList.severity.medium')}</MenuItem>
                  <MenuItem value="info">{t('issuesList.severity.info')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('issuesList.filterStatus')}</InputLabel>
                <Select
                  value={statusFilter}
                  label={t('issuesList.filterStatus')}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">{t('issuesList.allStatuses')}</MenuItem>
                  <MenuItem value="new">{t('issuesList.isNew')}</MenuItem>
                  <MenuItem value="recurrent">{t('issuesList.isRecurring')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('issuesList.filterType')}</InputLabel>
                <Select
                  value={typeFilter}
                  label={t('issuesList.filterType')}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">{t('issuesList.allTypes')}</MenuItem>
                  {issueTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </Box>

      {/* Tabla de issues */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={{ fontWeight: 600, width: 120 }}>
                <TableSortLabel
                  active={sortField === 'severity'}
                  direction={sortField === 'severity' ? sortOrder : 'asc'}
                  onClick={() => handleSort('severity')}
                >
                  {t('issuesList.filterSeverity')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>
                <TableSortLabel
                  active={sortField === 'is_new'}
                  direction={sortField === 'is_new' ? sortOrder : 'asc'}
                  onClick={() => handleSort('is_new')}
                >
                  {t('issuesList.filterStatus')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 150 }}>
                <TableSortLabel
                  active={sortField === 'issue_type'}
                  direction={sortField === 'issue_type' ? sortOrder : 'asc'}
                  onClick={() => handleSort('issue_type')}
                >
                  {t('issuesList.filterType')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('issuesList.columns.description')}</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 180 }}>{t('issuesList.columns.affectedColumns')}</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 80, textAlign: 'right' }}>{t('issuesList.columns.rows')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedIssues.map((issue) => (
              <TableRow
                key={issue.id}
                sx={{
                  '&:hover': { backgroundColor: '#FAFAFA' },
                  backgroundColor: issue.is_new ? 'rgba(229, 72, 77, 0.02)' : 'transparent',
                }}
              >
                <TableCell>{renderSeverityBadge(issue.severity)}</TableCell>
                <TableCell>{renderStatusBadge(issue.is_new)}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {issue.issue_type}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: '#333333' }}>
                    {issue.description}
                  </Typography>
                  {issue.rule_key && (
                    <Typography variant="caption" sx={{ color: GRAY }}>
                      {t('evaluations.issues.rule', { key: issue.rule_key })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {issue.affected_columns && issue.affected_columns.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {issue.affected_columns.slice(0, 3).map((col: any, idx: number) => {
                        // Handle both string and object formats: "column_name" or {column: "name", null_rate: 0.5}
                        const columnName = typeof col === 'string' ? col : (col?.column || col?.name || JSON.stringify(col));
                        return (
                          <Chip
                            key={idx}
                            label={columnName}
                            size="small"
                            sx={{
                              fontSize: '0.7rem',
                              height: 20,
                              backgroundColor: '#E8E8E8',
                            }}
                          />
                        );
                      })}
                      {issue.affected_columns.length > 3 && (
                        <Chip
                          label={`+${issue.affected_columns.length - 3}`}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                            backgroundColor: '#E8E8E8',
                          }}
                        />
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: GRAY }}>
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {issue.affected_row_count ? issue.affected_row_count : '—'}
                  </Typography>
                  {issue.affected_rows_pct != null && issue.affected_rows_pct > 0 && (
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      {(issue.affected_rows_pct * 100).toFixed(1)}%
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {paginatedIssues.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" sx={{ color: GRAY }}>
                    {t('issuesList.noResults')}
                  </Typography>
                  <Button size="small" onClick={clearFilters} sx={{ mt: 1, color: GREEN }}>
                    {t('issuesList.clearFilters')}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Paginación */}
      <TablePagination
        component="div"
        count={filteredAndSortedIssues.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage={t('issuesList.pagination.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} ${t('issuesList.pagination.of')} ${count}`}
        sx={{ borderTop: '1px solid #EEEEEE' }}
      />
    </Paper>
  );
};

export default IssuesList;
