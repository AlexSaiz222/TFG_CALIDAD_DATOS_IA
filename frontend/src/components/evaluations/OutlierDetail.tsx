import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface OutlierDetailProps {
  outliers: Record<string, any>;
}

const OutlierDetail: React.FC<OutlierDetailProps> = ({ outliers }) => {
  const { t } = useTranslation();
  const columnsWithOutliers = Object.entries(outliers)
    .filter(([_, col]: [string, any]) => col?.count > 0)
    .sort(([, a]: [string, any], [, b]: [string, any]) => (b.count || 0) - (a.count || 0));

  const [selectedColumn, setSelectedColumn] = useState<string>(
    columnsWithOutliers.length > 0 ? columnsWithOutliers[0][0] : ''
  );
  const [outlierScaleStates, setOutlierScaleStates] = useState<Record<string, boolean>>({});
  const [showAllOutliers, setShowAllOutliers] = useState<Record<string, boolean>>({});

  if (columnsWithOutliers.length === 0) return null;

  const totalOutliers = columnsWithOutliers.reduce(
    (sum, [_, col]) => sum + (col?.count || 0), 0
  );
  const totalValues = columnsWithOutliers.reduce(
    (sum, [_, col]) => sum + (col?.total_values || 0), 0
  );

  const renderColumnDetail = (colName: string, col: any) => {
    const proportion = col.proportion || (col.total_values > 0 ? col.count / col.total_values : 0);
    const proportionPct = (proportion * 100).toFixed(1);
    // Paleta de colores basada en densidad de outliers (informativa, NO indica calidad)
    // Gradiente verde → amarillo → rojo
    const densityColor = proportion >= 0.20 ? '#EF4444' :  // Muy frecuentes (>= 20%) - rojo
      proportion >= 0.10 ? '#F97316' :  // Frecuentes (>= 10%) - naranja
        proportion >= 0.05 ? '#EAB308' :  // Moderados (>= 5%) - amarillo
          proportion >= 0.02 ? '#84CC16' :  // Pocos (>= 2%) - verde lima
            '#22C55E';                         // Muy pocos (< 2%) - verde
    const densityLabel = proportion >= 0.20 ? t('outlierDetail.density.veryHigh') :
      proportion >= 0.10 ? t('outlierDetail.density.high') :
        proportion >= 0.05 ? t('outlierDetail.density.moderate') :
          proportion >= 0.02 ? t('outlierDetail.density.low') :
            t('outlierDetail.density.veryLow');

    const lb = col.lower_bound ?? col.series_min ?? 0;
    const ub = col.upper_bound ?? col.series_max ?? 100;
    const iqr = col.iqr ?? ((col.q3 - col.q1) || 1);
    const outlierValues = (col.sample_values || []).map((val: number) => {
      const distanceFromBound = val < lb ? lb - val : val - ub;
      const iqrMultiple = distanceFromBound / iqr;
      const isExtreme = iqrMultiple > 3;
      const isSuspicious = Math.abs(val) > 100000000 || val === 999999999 || val === -999999999;
      return { val, distanceFromBound, iqrMultiple, isExtreme, isSuspicious };
    });

    const showFullScale = outlierScaleStates[colName] || false;
    const toggleScale = () => {
      setOutlierScaleStates(prev => ({ ...prev, [colName]: !showFullScale }));
    };

    const q1 = col.q1 ?? lb;
    const q3 = col.q3 ?? ub;
    const sMin = col.series_min ?? lb;
    const sMax = col.series_max ?? ub;
    const median = col.median ?? (q1 + q3) / 2;

    const normalRange = ub - lb;
    const fullRange = sMax - sMin;
    const needsZoom = fullRange > normalRange * 5;

    const rangeMin = showFullScale ? sMin : Math.max(sMin, lb - iqr);
    const rangeMax = showFullScale ? sMax : Math.min(sMax, ub + iqr);
    const range = rangeMax - rangeMin || 1;

    const toPercent = (v: number) => {
      const pct = ((v - rangeMin) / range) * 100;
      return Math.max(0, Math.min(100, pct));
    };

    const lbPct = toPercent(lb);
    const ubPct = toPercent(ub);
    const q1Pct = toPercent(q1);
    const q3Pct = toPercent(q3);
    const medianPct = toPercent(median);

    return (
      <Box key={colName}>
        {/* Header with column name, count, and density */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{colName}</Typography>
            <Chip
              label={`${col.count} outlier${col.count > 1 ? 's' : ''}`}
              size="small"
              sx={{ backgroundColor: `${densityColor}20`, color: densityColor, fontWeight: 600 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {t('outlierDetail.countOfTotal', { count: col.count, total: col.total_values || 'N/A', percentage: proportionPct })}
            </Typography>
            <Chip
              label={t('outlierDetail.densityLabel', { density: densityLabel })}
              size="small"
              sx={{
                backgroundColor: densityColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.7rem'
              }}
            />
          </Box>
        </Box>

        {/* Box-plot visualization with zoom toggle */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#fff', borderRadius: 2, border: '1px solid #E0E0E0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>
              {t('outlierDetail.chartHeader', { column: colName })}
            </Typography>
            {needsZoom && (
              <Button
                size="small"
                onClick={toggleScale}
                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
              >
                {showFullScale ? t('outlierDetail.zoomIn') : t('outlierDetail.zoomOut')}
              </Button>
            )}
          </Box>

          {needsZoom && !showFullScale && (
            <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
              <Typography variant="caption">
                {(() => {
                  const outOfScaleCount = outlierValues.filter((o: any) => {
                    const val = o.val;
                    return val < rangeMin || val > rangeMax;
                  }).length;
                  const visibleCount = outlierValues.length - outOfScaleCount;

                  if (outOfScaleCount === outlierValues.length) {
                    return t('outlierDetail.allOutOfScale', { count: outlierValues.length });
                  } else if (outOfScaleCount > 0) {
                    return t('outlierDetail.partialOutOfScale', { count: visibleCount, visible: visibleCount, hidden: outOfScaleCount });
                  }
                  return '';
                })()}
              </Typography>
            </Alert>
          )}

          <Box>
            {/* SVG Box-plot */}
            <svg width="100%" height="100" viewBox="0 0 1000 100" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
              {/* Lower whisker */}
              <Tooltip title={`${t('outlierDetail.stats.lowerFence')}: ${lb.toFixed(2)}`} arrow>
                <g>
                  <line x1={lbPct * 10} y1="50" x2={q1Pct * 10} y2="50" stroke="#999" strokeWidth="2" strokeDasharray="4,2" style={{ cursor: 'help' }} />
                  <line x1={lbPct * 10} y1="35" x2={lbPct * 10} y2="65" stroke="#999" strokeWidth="2" style={{ cursor: 'help' }} />
                </g>
              </Tooltip>

              {/* Upper whisker */}
              <Tooltip title={`${t('outlierDetail.stats.upperFence')}: ${ub.toFixed(2)}`} arrow>
                <g>
                  <line x1={q3Pct * 10} y1="50" x2={ubPct * 10} y2="50" stroke="#999" strokeWidth="2" strokeDasharray="4,2" style={{ cursor: 'help' }} />
                  <line x1={ubPct * 10} y1="35" x2={ubPct * 10} y2="65" stroke="#999" strokeWidth="2" style={{ cursor: 'help' }} />
                </g>
              </Tooltip>

              {/* IQR Box */}
              <Tooltip title={`Q1: ${q1.toFixed(2)} | Q3: ${q3.toFixed(2)}`} arrow>
                <rect
                  x={q1Pct * 10}
                  y="25"
                  width={Math.max((q3Pct - q1Pct) * 10, 4)}
                  height="50"
                  rx="4"
                  fill="#C8E6C9"
                  stroke="#66BB6A"
                  strokeWidth="2.5"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>

              {/* Median line - PROMINENT */}
              <Tooltip title={`${t('outlierDetail.stats.median')}: ${median.toFixed(2)}`} arrow>
                <line
                  x1={medianPct * 10}
                  y1="25"
                  x2={medianPct * 10}
                  y2="75"
                  stroke="#1B5E20"
                  strokeWidth="4"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>

              {/* Median label */}
              <text
                x={medianPct * 10}
                y="15"
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#1B5E20"
              >
                Q2
              </text>

              {/* Outlier points */}
              {outlierValues.map((outlier: any, idx: number) => {
                const xPos = toPercent(outlier.val) * 10;
                const isVisible = xPos >= 0 && xPos <= 1000;
                if (!isVisible && !showFullScale) return null;

                const color = outlier.isSuspicious ? '#B71C1C' : outlier.isExtreme ? '#E53935' : '#E5484D';
                const radius = outlier.isSuspicious ? 7 : outlier.isExtreme ? 6 : 5;
                const outlierType = outlier.isSuspicious ? t('outlierDetail.outlierClass.mild') : outlier.isExtreme ? t('outlierDetail.outlierClass.extreme') : t('outlierDetail.outlierClass.moderate');

                return (
                  <Tooltip key={idx} title={`Outlier ${outlierType}: ${outlier.val.toFixed(2)} (${outlier.iqrMultiple.toFixed(1)}× IQR)`} arrow>
                    <circle
                      cx={Math.max(10, Math.min(990, xPos))}
                      cy="50"
                      r={radius}
                      fill={color}
                      stroke="#fff"
                      strokeWidth="2"
                      opacity="0.95"
                      style={{ cursor: 'help' }}
                    />
                  </Tooltip>
                );
              })}
            </svg>

            {/* Scale labels */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#999', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {showFullScale ? t('outlierDetail.scaleLinear') : t('outlierDetail.scaleLog')} min: {Number(rangeMin).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#999', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {showFullScale ? t('outlierDetail.scaleLinear') : t('outlierDetail.scaleLog')} max: {Number(rangeMax).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Statistical values - WITH MEDIAN */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 2, mb: 2 }}>
          {col.q1 !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{t('outlierDetail.stats.iqr')} Q1 (25%)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#2E7D32' }}>
                {Number(col.q1).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.median !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#E8F5E9', borderRadius: 1, border: '2px solid #66BB6A' }}>
              <Typography variant="caption" sx={{ color: '#1B5E20', display: 'block', fontWeight: 600 }}>{t('outlierDetail.stats.median')} (Q2)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#1B5E20' }}>
                {Number(col.median).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.q3 !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{t('outlierDetail.stats.iqr')} Q3 (75%)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#2E7D32' }}>
                {Number(col.q3).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.iqr !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{t('outlierDetail.stats.iqr')} (Q3 - Q1)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#1976d2' }}>
                {Number(col.iqr).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.mean !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#FAFAFA', borderRadius: 1, border: '1px solid #E0E0E0' }}>
              <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.7rem' }}>
                {t('outlierDetail.stats.mean')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', color: '#999', fontSize: '0.8rem' }}>
                {Number(col.mean).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.lower_bound !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{t('outlierDetail.stats.lowerFence')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#E5484D' }}>
                {Number(col.lower_bound).toLocaleString()}
              </Typography>
            </Box>
          )}
          {col.upper_bound !== undefined && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{t('outlierDetail.stats.upperFence')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#E5484D' }}>
                {Number(col.upper_bound).toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Outlier values - TABLE LAYOUT for better scannability */}
        {outlierValues.length > 0 && (
          <Box sx={{ p: 2, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E8E8E8' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>
                {t('outlierDetail.stats.outlierCount')} ({col.count}):
              </Typography>
              {col.count > 5 && (
                <Button
                  size="small"
                  onClick={() => setShowAllOutliers(prev => ({ ...prev, [colName]: !prev[colName] }))}
                  sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                >
                  {showAllOutliers[colName] ? t('uniquenessDetail.hideButton') : `${t('uniquenessDetail.showButton', { count: col.count })}`}
                </Button>
              )}
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#666' }}>{t('outlierDetail.tableColumns.bounds')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#666' }}>{t('outlierDetail.tableColumns.density')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#666' }}>{t('outlierDetail.stats.iqr')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(showAllOutliers[colName] ? outlierValues : outlierValues.slice(0, 5)).map((outlier: any, idx: number) => (
                    <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#F9F9F9' } }}>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: outlier.isSuspicious ? '#B71C1C' : outlier.isExtreme ? '#E53935' : '#E5484D',
                            fontSize: '0.85rem'
                          }}
                        >
                          {Number(outlier.val).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={outlier.isSuspicious ? t('outlierDetail.outlierClass.mild') : outlier.isExtreme ? t('outlierDetail.outlierClass.extreme') : t('outlierDetail.outlierClass.moderate')}
                          size="small"
                          sx={{
                            backgroundColor: outlier.isSuspicious ? '#FFEBEE' : outlier.isExtreme ? '#FFF3E0' : '#F5F5F5',
                            color: outlier.isSuspicious ? '#B71C1C' : outlier.isExtreme ? '#E65100' : '#666',
                            fontWeight: 500,
                            fontSize: '0.7rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#666', fontFamily: 'monospace' }}>
                          {t('outlierDetail.iqrAboveLimit', { multiple: outlier.iqrMultiple.toFixed(1), direction: outlier.val < lb ? t('outlierDetail.directionLow') : t('outlierDetail.directionHigh') })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    );
  };

  const currentCol = columnsWithOutliers.find(([name]) => name === selectedColumn);

  const summaryContainerSx = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 } as const;

  return (
    <Box>
      {/* Educational context about outliers */}
      <Alert
        severity="info"
        sx={{
          mb: 3,
          backgroundColor: '#E3F2FD',
          border: '1px solid #90CAF9',
          '& .MuiAlert-icon': { color: '#1976d2' }
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#1565C0' }}>
          {t('outlierDetail.educationalTitle')}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#1976d2', lineHeight: 1.5 }}>
          {t('outlierDetail.educationalBody')}
        </Typography>
      </Alert>

      {/* Summary header */}
      <Box sx={summaryContainerSx}>
        <Box>
          <Typography variant="body2" sx={{ color: '#555' }}>
            {t('outlierDetail.stats.outlierCount')}: {totalOutliers} ({t('outlierDetail.tableColumns.column')}: {columnsWithOutliers.length}, {t('outlierDetail.tableColumns.pct')}: {totalValues.toLocaleString()})
          </Typography>
        </Box>
        {columnsWithOutliers.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('outlierDetail.tableColumns.column')}</InputLabel>
            <Select
              value={selectedColumn}
              label={t('outlierDetail.tableColumns.column')}
              onChange={(e) => setSelectedColumn(e.target.value)}
            >
              {columnsWithOutliers.map(([name, col]: [string, any]) => (
                <MenuItem key={name} value={name}>
                  {name} ({col.count} outlier{col.count > 1 ? 's' : ''})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Column chips for quick navigation */}
      {columnsWithOutliers.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {columnsWithOutliers.map(([name, col]: [string, any]) => {
            const prop = col.proportion || (col.total_values > 0 ? col.count / col.total_values : 0);
            // Gradiente verde → amarillo → rojo
            const chipColor = prop >= 0.20 ? '#EF4444' :
              prop >= 0.10 ? '#F97316' :
                prop >= 0.05 ? '#EAB308' :
                  prop >= 0.02 ? '#84CC16' :
                    '#22C55E';
            const isActive = name === selectedColumn;
            return (
              <Chip
                key={name}
                label={`${name} (${col.count})`}
                size="small"
                onClick={() => setSelectedColumn(name)}
                sx={{
                  backgroundColor: isActive ? chipColor : `${chipColor}15`,
                  color: isActive ? '#fff' : chipColor,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  border: isActive ? 'none' : `1px solid ${chipColor}40`,
                  '&:hover': {
                    backgroundColor: chipColor,
                    color: '#fff',
                  },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Selected column detail */}
      {currentCol && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #E8E8E8', borderRadius: 2, backgroundColor: '#FAFAFA' }}>
          {renderColumnDetail(currentCol[0], currentCol[1])}
        </Paper>
      )}
    </Box>
  );
};

export default OutlierDetail;
