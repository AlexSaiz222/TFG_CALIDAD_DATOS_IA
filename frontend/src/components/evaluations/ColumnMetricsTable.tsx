import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  LinearProgress,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { ColumnMetrics } from '../../types';

interface ColumnMetricsTableProps {
  columnMetrics: Record<string, ColumnMetrics>;
}

type SortKey = 'name' | 'type' | 'completeness' | 'uniqueness' | 'n_nulls' | 'n_unique' | 'min' | 'max' | 'mean' | 'std';
type SortDir = 'asc' | 'desc';

const ColumnMetricsTable: React.FC<ColumnMetricsTableProps> = ({ columnMetrics }) => {
  const allColumns = Object.keys(columnMetrics);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let cols = allColumns;

    if (search.trim()) {
      const q = search.toLowerCase();
      cols = cols.filter(name => 
        name.toLowerCase().includes(q) || 
        (columnMetrics[name].type || '').toLowerCase().includes(q)
      );
    }

    const getVal = (name: string, key: SortKey): number | string => {
      const m = columnMetrics[name];
      switch (key) {
        case 'name': return name.toLowerCase();
        case 'type': return (m.type || '').toLowerCase();
        case 'completeness': return m.completeness ?? 0;
        case 'uniqueness': return m.uniqueness ?? 0;
        case 'n_nulls': return m.n_nulls ?? 0;
        case 'n_unique': return m.n_unique ?? 0;
        case 'min': return m.min ?? 0;
        case 'max': return m.max ?? 0;
        case 'mean': return m.mean ?? 0;
        case 'std': return m.std ?? 0;
        default: return name;
      }
    };

    cols.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return cols;
  }, [allColumns, search, sortKey, sortDir, columnMetrics]);

  if (allColumns.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #CCCCCC', borderRadius: 2 }}>
        <Typography variant="body1" sx={{ color: '#555555' }}>
          No column metrics available.
        </Typography>
      </Box>
    );
  }

  const getCompletionColor = (value: number): string => {
    if (value >= 0.95) return '#00B37E';
    if (value >= 0.8) return '#FFB800';
    return '#E5484D';
  };

  const formatValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  };

  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  const headerSx = { fontWeight: 600, whiteSpace: 'nowrap' as const };

  return (
    <Box>
      {/* Search bar */}
      <TextField
        size="small"
        placeholder="Buscar columna..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 18, color: '#999' }} />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2, width: 280 }}
      />

      <Typography variant="caption" sx={{ color: '#888', ml: 2 }}>
        {filteredAndSorted.length} de {allColumns.length} columnas
      </Typography>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #EEEEEE', borderRadius: 2 }}>
        <Table size="small" aria-label="column metrics table">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'name'} direction={sortKey === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                  Column
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'type'} direction={sortKey === 'type' ? sortDir : 'asc'} onClick={() => handleSort('type')}>
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'completeness'} direction={sortKey === 'completeness' ? sortDir : 'asc'} onClick={() => handleSort('completeness')}>
                  Completeness
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'n_nulls'} direction={sortKey === 'n_nulls' ? sortDir : 'asc'} onClick={() => handleSort('n_nulls')}>
                  Nulls / Non-Nulls
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'uniqueness'} direction={sortKey === 'uniqueness' ? sortDir : 'asc'} onClick={() => handleSort('uniqueness')}>
                  Uniqueness
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'n_unique'} direction={sortKey === 'n_unique' ? sortDir : 'asc'} onClick={() => handleSort('n_unique')}>
                  Unique Values
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'min'} direction={sortKey === 'min' ? sortDir : 'asc'} onClick={() => handleSort('min')}>
                  Min
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'max'} direction={sortKey === 'max' ? sortDir : 'asc'} onClick={() => handleSort('max')}>
                  Max
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'mean'} direction={sortKey === 'mean' ? sortDir : 'asc'} onClick={() => handleSort('mean')}>
                  Mean
                </TableSortLabel>
              </TableCell>
              <TableCell sx={headerSx}>
                <TableSortLabel active={sortKey === 'std'} direction={sortKey === 'std' ? sortDir : 'asc'} onClick={() => handleSort('std')}>
                  Std
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSorted.map((columnName) => {
              const metrics = columnMetrics[columnName];
              const completenessColor = getCompletionColor(metrics.completeness);

              return (
                <TableRow key={columnName} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {columnName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        backgroundColor: '#F0F0F0',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                      }}
                    >
                      {metrics.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={formatPercentage(metrics.completeness)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.completeness * 100}
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#EEEEEE',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: completenessColor,
                              borderRadius: 3,
                            },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: completenessColor, fontWeight: 500, minWidth: 45 }}>
                          {formatPercentage(metrics.completeness)}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                      {metrics.n_nulls !== undefined && metrics.n_non_nulls !== undefined ? (
                        <>
                          <Box component="span" sx={{ color: (metrics.n_nulls ?? 0) > 0 ? '#E5484D' : '#555', fontWeight: (metrics.n_nulls ?? 0) > 0 ? 600 : 400 }}>
                            {metrics.n_nulls.toLocaleString()}
                          </Box>
                          {' / '}
                          {metrics.n_non_nulls.toLocaleString()}
                        </>
                      ) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatPercentage(metrics.uniqueness)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#555' }}>
                      {metrics.n_unique !== undefined ? metrics.n_unique.toLocaleString() : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatValue(metrics.min)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatValue(metrics.max)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatValue(metrics.mean)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatValue(metrics.std)}</Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ColumnMetricsTable;
