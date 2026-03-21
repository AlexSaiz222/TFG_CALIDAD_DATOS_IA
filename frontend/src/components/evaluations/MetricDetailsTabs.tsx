import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import CompletenessDetail from './CompletenessDetail';
import UniquenessDetail from './UniquenessDetail';
import OutlierDetail from './OutlierDetail';
import { ColumnMetrics } from '../../types';

// ══════════════════════════════════════════════════════════════════════════════
// IMPORTANTE: Este componente se usa TEMPORALMENTE para mostrar características
// del dataset (completitud, unicidad, outliers).
//
// Estas NO son métricas de evaluación de calidad de datos, son características
// descriptivas intrínsecas del dataset.
//
// En el futuro:
// - Este componente volverá a su propósito original: mostrar SOLO métricas de evaluación
// - Se creará un nuevo componente específico para características del dataset
// - La separación permitirá distinguir claramente entre:
//   * Características del dataset (completitud, unicidad, outliers)
//   * Métricas de calidad de datos (las que se definan en el sistema de evaluaciones)
// ══════════════════════════════════════════════════════════════════════════════

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

interface MetricDetailsTabsProps {
  overallMetrics: Record<string, any>;
  columnMetrics: Record<string, ColumnMetrics>;
  initialTab?: number;
  datasetId?: number;
}

const getStatusIcon = (value: number, threshold: number) => {
  if (value >= threshold) return <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />;
  if (value >= threshold * 0.85) return <WarningIcon sx={{ fontSize: 16, color: '#FFB800' }} />;
  return <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />;
};

const MetricDetailsTabs: React.FC<MetricDetailsTabsProps> = ({
  overallMetrics,
  columnMetrics,
  initialTab = 0,
  datasetId,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const hasCompleteness = overallMetrics.completeness !== undefined;
  const hasUniqueness = overallMetrics.uniqueness !== undefined;
  const hasOutliers = overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0;

  const tabs: Array<{ label: string; icon: React.ReactNode; available: boolean }> = [];

  if (hasCompleteness) {
    tabs.push({
      label: `Valores nulos (${(overallMetrics.completeness * 100).toFixed(1)}%)`,
      icon: null,
      available: true,
    });
  }

  if (hasUniqueness) {
    const duplicatePercent = ((1 - overallMetrics.uniqueness) * 100).toFixed(1);
    tabs.push({
      label: `Registros duplicados (${duplicatePercent}%)`,
      icon: null,
      available: true,
    });
  }

  if (hasOutliers) {
    const totalOutliers = Object.values(overallMetrics.outliers).reduce(
      (sum: number, col: any) => sum + (col?.count || 0), 0
    );
    tabs.push({
      label: `Outliers (${totalOutliers})`,
      icon: null,
      available: true,
    });
  }

  if (tabs.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#888' }}>
          No hay métricas detalladas disponibles.
        </Typography>
      </Paper>
    );
  }

  const safeTab = Math.min(activeTab, tabs.length - 1);

  return (
    <Paper id="metric-details" elevation={0} sx={{ border: '1px solid #EEEEEE', borderRadius: 2, scrollMarginTop: '80px' }}>
      <Tabs
        value={safeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="fullWidth"
        sx={{
          borderBottom: '1px solid #EEEEEE',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            minHeight: 48,
          },
          '& .Mui-selected': {
            fontWeight: 600,
          },
        }}
      >
        {tabs.map((tab, idx) => (
          <Tab
            key={idx}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {tab.icon}
                {tab.label}
              </Box>
            }
          />
        ))}
      </Tabs>

      <Box sx={{ p: 3 }}>
        {/* Render tab content based on which metrics are available */}
        {(() => {
          let tabIdx = 0;

          const panels: React.ReactNode[] = [];

          if (hasCompleteness) {
            panels.push(
              <TabPanel key="completeness" value={safeTab} index={tabIdx}>
                <CompletenessDetail
                  overallCompleteness={overallMetrics.completeness}
                  columnMetrics={columnMetrics}
                />
              </TabPanel>
            );
            tabIdx++;
          }

          if (hasUniqueness) {
            panels.push(
              <TabPanel key="uniqueness" value={safeTab} index={tabIdx}>
                <UniquenessDetail
                  overallUniqueness={overallMetrics.uniqueness}
                  columnMetrics={columnMetrics}
                  datasetId={datasetId}
                />
              </TabPanel>
            );
            tabIdx++;
          }

          if (hasOutliers) {
            panels.push(
              <TabPanel key="outliers" value={safeTab} index={tabIdx}>
                <OutlierDetail outliers={overallMetrics.outliers} />
              </TabPanel>
            );
            tabIdx++;
          }

          return panels;
        })()}
      </Box>
    </Paper>
  );
};

export default MetricDetailsTabs;
