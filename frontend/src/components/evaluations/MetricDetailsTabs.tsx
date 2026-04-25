import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import CompletenessDetail from './CompletenessDetail';
import UniquenessDetail from './UniquenessDetail';
import OutlierDetail from './OutlierDetail';
import SyntacticAccuracyDetail from './SyntacticAccuracyDetail';
import LogicalConsistencyDetail from './LogicalConsistencyDetail';
import ClassBalanceDetail from './ClassBalanceDetail';
import CurrentnessDetail from './CurrentnessDetail';
import { ColumnMetrics } from '../../types';
import { useTranslation } from 'react-i18next';

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
  analysisRunId?: number;
  evaluationId?: number;
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
  analysisRunId,
  evaluationId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(initialTab);
  const { t } = useTranslation();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const hasCompleteness = overallMetrics.completeness !== undefined;
  const hasUniqueness = overallMetrics.uniqueness !== undefined;
  const hasOutliers = overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0;
  const hasSyntacticAccuracy = overallMetrics.syntactic_accuracy && overallMetrics.syntactic_accuracy.columns;
  const hasLogicalConsistency = overallMetrics.logical_consistency && overallMetrics.logical_consistency.rules;
  const hasClassBalance = overallMetrics.class_balance && overallMetrics.class_balance.columns;
  const hasCurrentness = overallMetrics.currentness && overallMetrics.currentness.columns;

  const tabs: Array<{ name: string; summary: string }> = [];

  if (hasCompleteness) {
    const nullPercent = ((1 - overallMetrics.completeness) * 100).toFixed(1);
    tabs.push({ name: t('metricDetailsTabs.tabs.completeness'), summary: `${nullPercent}%` });
  }

  if (hasUniqueness) {
    const duplicatePercent = ((1 - overallMetrics.uniqueness) * 100).toFixed(1);
    tabs.push({ name: t('metricDetailsTabs.tabs.uniqueness'), summary: `${duplicatePercent}%` });
  }

  if (hasOutliers) {
    const totalOutliers = Object.values(overallMetrics.outliers).reduce(
      (sum: number, col: any) => sum + (col?.count || 0), 0
    );
    tabs.push({ name: t('metricDetailsTabs.tabs.outliers'), summary: `${totalOutliers}` });
  }

  if (hasSyntacticAccuracy) {
    const conformancePct = (overallMetrics.syntactic_accuracy.overall_conformance * 100).toFixed(1);
    tabs.push({ name: t('metricDetailsTabs.tabs.syntacticAccuracy'), summary: `${conformancePct}%` });
  }

  if (hasLogicalConsistency) {
    const violations = overallMetrics.logical_consistency.rules_with_violations || 0;
    tabs.push({ name: t('metricDetailsTabs.tabs.logicalConsistency'), summary: `${violations}` });
  }

  if (hasClassBalance) {
    const balanceIdx = overallMetrics.class_balance.overall_balance_index?.toFixed(0) || '?';
    tabs.push({ name: t('metricDetailsTabs.tabs.classBalance'), summary: `${balanceIdx}/100` });
  }

  if (hasCurrentness) {
    const staleCount = overallMetrics.currentness.columns_stale || 0;
    const freshPct = (overallMetrics.currentness.overall_freshness_score * 100).toFixed(0);
    tabs.push({
      name: t('metricDetailsTabs.tabs.currentness'),
      summary: staleCount > 0 ? `${staleCount}` : `${freshPct}%`,
    });
  }

  if (tabs.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #EEEEEE', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#888' }}>
          {t('projects.detail.noParams')}
        </Typography>
      </Paper>
    );
  }

  const safeTab = Math.min(activeTab, tabs.length - 1);

  return (
    <Paper id="metric-details" elevation={0} sx={{ border: '1px solid #EEEEEE', borderRadius: 2, scrollMarginTop: '80px' }}>
      {/* Mobile: Dropdown selector */}
      {isMobile ? (
        <FormControl fullWidth sx={{ p: 2, borderBottom: '1px solid #EEEEEE' }}>
          <Select
            value={safeTab}
            onChange={(e) => setActiveTab(e.target.value as number)}
            size="small"
          >
            {tabs.map((tab, idx) => (
              <MenuItem key={idx} value={idx}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{tab.name}</Typography>
                  <Typography variant="caption" sx={{ color: '#888', ml: 1 }}>{tab.summary}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <Tabs
          value={safeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid #EEEEEE',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              minHeight: 56,
              minWidth: 120,
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
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {tab.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', lineHeight: 1.2 }}>
                    {tab.summary}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Tabs>
      )}

      <Box sx={{ p: 3 }}>
        {(() => {
          let tabIdx = 0;
          const panels: React.ReactNode[] = [];

          if (hasCompleteness) {
            panels.push(
              <TabPanel key="completeness" value={safeTab} index={tabIdx}>
                <CompletenessDetail
                  overallCompleteness={overallMetrics.completeness}
                  columnMetrics={columnMetrics}
                  analysisRunId={analysisRunId}
                  evaluationId={evaluationId}
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

          if (hasSyntacticAccuracy) {
            panels.push(
              <TabPanel key="syntactic_accuracy" value={safeTab} index={tabIdx}>
                <SyntacticAccuracyDetail data={overallMetrics.syntactic_accuracy} analysisRunId={analysisRunId} evaluationId={evaluationId} />
              </TabPanel>
            );
            tabIdx++;
          }

          if (hasLogicalConsistency) {
            panels.push(
              <TabPanel key="logical_consistency" value={safeTab} index={tabIdx}>
                <LogicalConsistencyDetail data={overallMetrics.logical_consistency} analysisRunId={analysisRunId} evaluationId={evaluationId} />
              </TabPanel>
            );
            tabIdx++;
          }

          if (hasClassBalance) {
            panels.push(
              <TabPanel key="class_balance" value={safeTab} index={tabIdx}>
                <ClassBalanceDetail data={overallMetrics.class_balance} />
              </TabPanel>
            );
            tabIdx++;
          }

          if (hasCurrentness) {
            panels.push(
              <TabPanel key="currentness" value={safeTab} index={tabIdx}>
                <CurrentnessDetail data={overallMetrics.currentness} />
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
