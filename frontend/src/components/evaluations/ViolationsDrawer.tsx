import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, Chip, CircularProgress, InputAdornment,
  Tooltip, Alert, Skeleton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ErrorOutline as ErrorIcon,
  BugReport as BugIcon,
  FileDownload as DownloadIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analysisAPI, evaluationsAPI } from '../../services/api';

export interface ViolationsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** AnalysisRun ID (new system) */
  analysisRunId?: number;
  /** Evaluation ID (legacy system) */
  evaluationId?: number;
  /** Metric type */
  metric: 'completeness' | 'syntactic_accuracy' | 'logical_consistency';
  /** Column name (for completeness and syntactic_accuracy) */
  column?: string;
  /** Rule index (for logical_consistency) */
  ruleIndex?: number;
  /** Title displayed in the drawer header */
  title: string;
  /** Subtitle/description displayed below the title */
  subtitle?: string;
}

interface ViolationRow {
  __row?: number;
  __invalid_value?: string;
  [key: string]: any;
}

interface ColumnMeta {
  name: string;
  is_sensitive: boolean;
  is_meta: boolean;
}

interface ViolationsData {
  rows: ViolationRow[];
  columns: ColumnMeta[];
  context: Record<string, any>;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

const ViolationsDrawer: React.FC<ViolationsDrawerProps> = ({
  open, onClose, analysisRunId, evaluationId,
  metric, column, ruleIndex, title, subtitle,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ViolationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchViolations = useCallback(async (pg: number, perPage: number, searchTerm: string) => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        metric,
        page: pg + 1,
        per_page: perPage,
      };
      if (column) params.column = column;
      if (ruleIndex !== undefined) params.rule_index = ruleIndex;
      if (searchTerm) params.search = searchTerm;

      let response;
      if (analysisRunId) {
        response = await analysisAPI.getAnalysisRunViolations(analysisRunId, params);
      } else if (evaluationId) {
        response = await evaluationsAPI.getViolations(evaluationId, params);
      } else {
        setError('No analysis run or evaluation ID provided');
        setLoading(false);
        return;
      }

      const respData = response.data?.data || response.data;
      setData(respData);
    } catch (err: any) {
      console.error('Error fetching violations:', err);
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [open, analysisRunId, evaluationId, metric, column, ruleIndex, t]);

  useEffect(() => {
    if (open) {
      setPage(0);
      setSearch('');
      setDebouncedSearch('');
      fetchViolations(0, rowsPerPage, '');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchViolations(page, rowsPerPage, debouncedSearch);
    }
  }, [page, rowsPerPage, debouncedSearch]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(val);
    }, 400);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const dataColumns = data?.columns?.filter(c => !c.is_meta) || [];
  const metaColumns = data?.columns?.filter(c => c.is_meta) || [];
  const totalCount = data?.pagination?.total ?? 0;

  const getContextChips = () => {
    if (!data?.context) return null;
    const ctx = data.context;
    const chips: { label: string; color: 'default' | 'error' | 'info' | 'warning' }[] = [];

    if (ctx.total_rows) {
      chips.push({ label: `${t('violations.totalRows')}: ${ctx.total_rows.toLocaleString()}`, color: 'info' });
    }
    if (ctx.total_nulls !== undefined) {
      chips.push({ label: `${t('violations.nullValues')}: ${ctx.total_nulls.toLocaleString()}`, color: 'error' });
    }
    if (ctx.total_invalid !== undefined) {
      chips.push({ label: `${t('violations.invalidValues')}: ${ctx.total_invalid.toLocaleString()}`, color: 'error' });
    }
    if (ctx.total_violations !== undefined) {
      chips.push({ label: `${t('violations.totalViolations')}: ${ctx.total_violations.toLocaleString()}`, color: 'error' });
    }
    if (ctx.expected_type) {
      chips.push({ label: `${t('violations.expectedType')}: ${ctx.expected_type}`, color: 'warning' });
    }
    if (ctx.rule_name) {
      chips.push({ label: `${t('violations.rule')}: ${ctx.rule_name}`, color: 'warning' });
    }

    return chips.length > 0 ? (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {chips.map((chip, i) => (
          <Chip key={i} label={chip.label} size="small" color={chip.color} variant="outlined" />
        ))}
      </Box>
    ) : null;
  };

  const renderCellValue = (value: any, colMeta?: ColumnMeta) => {
    if (value === null || value === undefined) {
      return (
        <Typography component="span" sx={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.82rem' }}>
          NULL
        </Typography>
      );
    }
    if (colMeta?.is_sensitive && value === '***') {
      return (
        <Tooltip title={t('datasets.sensitiveTooltip') as string}>
          <Typography component="span" sx={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.82rem' }}>
            •••••
          </Typography>
        </Tooltip>
      );
    }
    const str = String(value);
    if (str.length > 80) {
      return (
        <Tooltip title={str}>
          <Typography component="span" sx={{ fontSize: '0.82rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {str.slice(0, 80)}…
          </Typography>
        </Tooltip>
      );
    }
    return (
      <Typography component="span" sx={{ fontSize: '0.82rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {str}
      </Typography>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid #eee' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugIcon sx={{ color: '#E5484D', fontSize: 22 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
              {title}
            </Typography>
            {totalCount > 0 && (
              <Chip
                label={totalCount.toLocaleString()}
                size="small"
                color="error"
                sx={{ fontWeight: 600, ml: 1 }}
              />
            )}
          </Box>
          {subtitle && (
            <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Context chips & search */}
        <Box sx={{ px: 3, pt: 2, pb: 1 }}>
          {getContextChips()}
          <TextField
            size="small"
            fullWidth
            placeholder={t('violations.searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#999' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.875rem' },
            }}
          />
        </Box>

        {/* Error */}
        {error && (
          <Box sx={{ px: 3, py: 1 }}>
            <Alert severity="error" icon={<ErrorIcon />}>{error}</Alert>
          </Box>
        )}

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'auto', px: 1 }}>
          {loading && !data ? (
            <Box sx={{ p: 3 }}>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} height={40} sx={{ my: 0.5 }} />
              ))}
            </Box>
          ) : data && data.rows.length > 0 ? (
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {/* Row number meta column */}
                  {metaColumns.filter(c => c.name === '__row').length > 0 && (
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', bgcolor: '#fafafa', minWidth: 60 }}>
                      #
                    </TableCell>
                  )}
                  {/* Invalid value meta column */}
                  {metaColumns.filter(c => c.name === '__invalid_value').length > 0 && (
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', bgcolor: '#fafafa', minWidth: 100 }}>
                      {t('violations.invalidValue')}
                    </TableCell>
                  )}
                  {/* Data columns */}
                  {dataColumns.map((col) => (
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                        bgcolor: col.name === column ? '#FFF4E5' : '#fafafa',
                        minWidth: 90,
                        maxWidth: 220,
                      }}
                    >
                      {col.name}
                      {col.is_sensitive && (
                        <Chip label="🔒" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                      )}
                      {col.name === column && (
                        <Chip label={t('violations.targetColumn')} size="small" color="warning" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.6rem' }} />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    hover
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: '#fafcff' },
                      opacity: loading ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {metaColumns.filter(c => c.name === '__row').length > 0 && (
                      <TableCell sx={{ fontSize: '0.78rem', color: '#888', fontFamily: 'monospace' }}>
                        {row.__row}
                      </TableCell>
                    )}
                    {metaColumns.filter(c => c.name === '__invalid_value').length > 0 && (
                      <TableCell>
                        <Chip
                          label={row.__invalid_value || '—'}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 180 }}
                        />
                      </TableCell>
                    )}
                    {dataColumns.map((col) => (
                      <TableCell
                        sx={{
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          bgcolor: col.name === column ? '#FFFBF0' : 'inherit',
                        }}
                      >
                        {renderCellValue(row[col.name], col)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, color: '#999' }}>
              <FilterIcon sx={{ fontSize: 48, mb: 2, color: '#ccc' }} />
              <Typography variant="body1">{t('violations.noResults')}</Typography>
              {debouncedSearch && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('violations.tryDifferentSearch')}
                </Typography>
              )}
            </Box>
          ) : null}
        </TableContainer>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #eee', px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {loading && <CircularProgress size={18} />}
          {totalCount > 0 && (
            <Typography variant="body2" sx={{ color: '#666' }}>
              {t('violations.showing', {
                from: page * rowsPerPage + 1,
                to: Math.min((page + 1) * rowsPerPage, totalCount),
                total: totalCount.toLocaleString(),
              })}
            </Typography>
          )}
        </Box>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage={t('common.rowsPerPage')}
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 40 } }}
        />
      </DialogActions>
    </Dialog>
  );
};

export default ViolationsDrawer;
