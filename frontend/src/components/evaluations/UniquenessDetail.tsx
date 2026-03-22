import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Button,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ContentCopy as DuplicateIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ColumnMetrics } from '../../types';
import { datasetsAPI } from '../../services/api';

interface UniquenessDetailProps {
  overallUniqueness: number;
  columnMetrics: Record<string, ColumnMetrics>;
  threshold?: number;
  datasetId?: number;
}

const UniquenessDetail: React.FC<UniquenessDetailProps> = ({
  overallUniqueness,
  columnMetrics,
  threshold = 1.0,
  datasetId,
}) => {
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const columns = Object.entries(columnMetrics)
    .map(([name, metrics]) => {
      const total = (metrics.n_nulls ?? 0) + (metrics.n_non_nulls ?? 0);
      const nUnique = metrics.n_unique ?? 0;
      const duplicates = total > 0 ? total - nUnique : 0;
      return {
        name,
        uniqueness: metrics.uniqueness,
        nUnique,
        total,
        duplicates: Math.max(0, duplicates),
        type: metrics.type,
      };
    })
    .sort((a, b) => a.uniqueness - b.uniqueness);

  const pct = ((1 - overallUniqueness) * 100).toFixed(1); // % de registros duplicados
  const totalRows = columns.length > 0 ? columns[0].total : 0;
  const duplicateRows = totalRows > 0 ? Math.round((1 - overallUniqueness) * totalRows) : 0;
  const columnsWithDuplicates = columns.filter(c => c.uniqueness < 1.0);

  const getColor = (val: number): string => {
    if (val >= 0.98) return '#00B37E';  // Excelente
    if (val >= 0.95) return '#34D399';  // Bueno
    if (val >= 0.90) return '#FBB024';  // Aceptable
    if (val >= 0.80) return '#FB923C';  // Requiere atención
    return '#EF4444';                   // Crítico
  };

  const loadDuplicates = async () => {
    if (!datasetId || loadingDuplicates) return;
    
    setLoadingDuplicates(true);
    try {
      const response = await datasetsAPI.getDuplicateRows(datasetId);
      setDuplicateData(response.data);
      setShowDuplicates(true);
    } catch (error) {
      console.error('Error loading duplicate rows:', error);
      alert('Error al cargar filas duplicadas: ' + (error as any)?.message || 'Error desconocido');
    } finally {
      setLoadingDuplicates(false);
    }
  };

  return (
    <Box>
      {/* ─── Score global + insight ─── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: getColor(overallUniqueness), lineHeight: 1 }}>
          {pct}%
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ color: '#555' }}>
            {overallUniqueness >= 1.0
              ? 'Todas las filas son únicas. No se detectaron duplicados.'
              : `${duplicateRows.toLocaleString()} fila${duplicateRows !== 1 ? 's' : ''} duplicada${duplicateRows !== 1 ? 's' : ''} en ${columnsWithDuplicates.length} columna${columnsWithDuplicates.length !== 1 ? 's' : ''}.`}
          </Typography>
        </Box>
      </Box>

      {/* ─── Barra global mostrando % de registros duplicados ─── */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={(1 - overallUniqueness) * 100}
          sx={{
            height: 10,
            borderRadius: 5,
            backgroundColor: '#EEEEEE',
            '& .MuiLinearProgress-bar': {
              backgroundColor: getColor(overallUniqueness),
              borderRadius: 5,
            },
          }}
        />
      </Box>

      {/* ─── Alerta de filas duplicadas completas ─── */}
      {duplicateRows > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ p: 2, backgroundColor: 'rgba(229, 72, 77, 0.05)', border: '1px solid rgba(229, 72, 77, 0.2)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningIcon sx={{ fontSize: 18, color: '#E5484D' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#E5484D' }}>
                Filas completamente duplicadas detectadas
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#555', mb: 1.5 }}>
              <strong>{duplicateRows.toLocaleString()}</strong> fila{duplicateRows !== 1 ? 's' : ''} del dataset {duplicateRows !== 1 ? 'están' : 'está'} completamente duplicada{duplicateRows !== 1 ? 's' : ''} ({((duplicateRows / totalRows) * 100).toFixed(2)}% del total).
            </Typography>
            <Box sx={{ p: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 1, border: '1px solid rgba(229, 72, 77, 0.15)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
                  Filas duplicadas detectadas:
                </Typography>
                {!datasetId ? (
                  <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                    ID de dataset no disponible
                  </Typography>
                ) : !duplicateData ? (
                  <Button
                    size="small"
                    onClick={loadDuplicates}
                    disabled={loadingDuplicates}
                    sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                  >
                    {loadingDuplicates ? <CircularProgress size={14} sx={{ mr: 0.5 }} /> : null}
                    {loadingDuplicates ? 'Cargando...' : 'Ver filas duplicadas'}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    onClick={() => setShowDuplicates(!showDuplicates)}
                    endIcon={showDuplicates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                  >
                    {showDuplicates ? 'Ocultar' : 'Mostrar'}
                  </Button>
                )}
              </Box>
              
              <Collapse in={showDuplicates && !!duplicateData}>
                {duplicateData && duplicateData.duplicate_groups && duplicateData.duplicate_groups.length > 0 ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
                      Se encontraron {duplicateData.total_groups} grupo{duplicateData.total_groups !== 1 ? 's' : ''} de filas duplicadas:
                    </Typography>
                    {duplicateData.duplicate_groups.slice(0, 10).map((group: any, idx: number) => (
                      <Box key={idx} sx={{ mb: 1.5, p: 1, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E0E0E0' }}>
                        <Typography variant="caption" sx={{ color: '#E5484D', fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Grupo {idx + 1}: {group.count} filas idénticas (índices: {group.indices.join(', ')})
                        </Typography>
                        <Box sx={{ overflowX: 'auto', maxHeight: 150 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                {group.sample && group.sample.length > 0 && Object.keys(group.sample[0]).map((col: string) => (
                                  <TableCell key={col} sx={{ fontSize: '0.65rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {group.sample && group.sample.slice(0, 3).map((row: any, rowIdx: number) => (
                                <TableRow key={rowIdx}>
                                  {Object.values(row).map((val: any, colIdx: number) => (
                                    <TableCell key={colIdx} sx={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                      {val !== null && val !== undefined ? String(val) : '-'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Box>
                    ))}
                    {duplicateData.total_groups > 10 && (
                      <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                        Mostrando 10 de {duplicateData.total_groups} grupos...
                      </Typography>
                    )}
                  </Box>
                ) : duplicateData ? (
                  <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                    No se encontraron grupos de filas duplicadas.
                  </Typography>
                ) : null}
              </Collapse>
            </Box>
          </Box>
        </Box>
      )}

      {/* ─── Insight contextual ─── */}
      {columnsWithDuplicates.length > 0 && (
        <Box sx={{ p: 1.5, backgroundColor: 'rgba(255, 184, 0, 0.05)', border: '1px solid rgba(255, 184, 0, 0.2)', borderRadius: 2, mb: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#555', fontSize: '0.8rem' }}>
            <strong>Insight:</strong>{' '}
            {columnsWithDuplicates.length === 1
              ? <>La columna <code style={{ backgroundColor: '#F0F0F0', padding: '1px 4px', borderRadius: 3 }}>{columnsWithDuplicates[0].name}</code> tiene {columnsWithDuplicates[0].duplicates.toLocaleString()} valores duplicados.</>
              : <>{columnsWithDuplicates.length} columnas tienen valores no únicos.</>}
            {' '}Es normal que ciertas columnas (como categorías, departamentos, etc.) contengan valores duplicados. 
            Los issues de unicidad solo se generan cuando se detectan filas completamente duplicadas o duplicados en columnas que deberían ser únicas (como IDs).
          </Typography>
        </Box>
      )}

      {/* ─── Tabla única con badges semánticos ─── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
        Unicidad por columna ({columns.length})
      </Typography>
      <TableContainer sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Columna</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Estado</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Únicos</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Duplicados</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((col) => (
              <TableRow
                key={col.name}
                hover
                sx={col.uniqueness < threshold ? { backgroundColor: 'rgba(255, 184, 0, 0.03)' } : undefined}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{col.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', backgroundColor: '#F0F0F0', px: 0.5, borderRadius: 0.5 }}>
                    {col.type}
                  </Typography>
                </TableCell>
                {/* Badge semántico en vez de barra */}
                <TableCell>
                  {col.uniqueness >= threshold ? (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                      label="Única"
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 179, 126, 0.08)',
                        color: '#00B37E',
                        fontWeight: 500,
                        height: 24,
                        fontSize: '0.7rem',
                        '& .MuiChip-icon': { color: '#00B37E' },
                      }}
                    />
                  ) : (
                    <Chip
                      icon={<DuplicateIcon sx={{ fontSize: '14px !important' }} />}
                      label={`${col.duplicates.toLocaleString()} duplicado${col.duplicates !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{
                        backgroundColor: col.uniqueness >= 0.95
                          ? 'rgba(255, 184, 0, 0.1)'
                          : 'rgba(229, 72, 77, 0.08)',
                        color: col.uniqueness >= 0.95 ? '#B8860B' : '#E5484D',
                        fontWeight: 600,
                        height: 24,
                        fontSize: '0.7rem',
                        '& .MuiChip-icon': {
                          color: col.uniqueness >= 0.95 ? '#B8860B' : '#E5484D',
                        },
                      }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#555' }}>
                    {col.nUnique.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {col.duplicates > 0 ? (
                    <Typography variant="body2" sx={{ color: getColor(col.uniqueness), fontWeight: 600 }}>
                      {col.duplicates.toLocaleString()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#CCC' }}>0</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ color: '#888' }}>{col.total.toLocaleString()}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ─── Resumen pie de tabla ─── */}
      {columnsWithDuplicates.length > 0 ? (
        <Typography variant="caption" sx={{ color: '#999' }}>
          {columnsWithDuplicates.length} de {columns.length} columnas contienen valores duplicados.
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ color: '#00B37E' }}>
          Todas las columnas tienen valores completamente únicos.
        </Typography>
      )}
    </Box>
  );
};

export default UniquenessDetail;
