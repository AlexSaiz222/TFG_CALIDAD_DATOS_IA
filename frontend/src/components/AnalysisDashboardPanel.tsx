import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import QualityTrendChart from './QualityTrendChart';
import VersionEvolutionChart from './VersionEvolutionChart';
import { datasetsAPI } from '../services/api';
import type { AnalysisRun } from '../types';
import { useTranslation } from 'react-i18next';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';

interface DatasetInfo {
  id: number;
  name: string;
  version?: number;
  parent_dataset_id?: number | null;
}

interface AnalysisDashboardPanelProps {
  projectId: number | undefined;
  runs: AnalysisRun[];
  datasets: DatasetInfo[];
  selectedDatasetId: number | null;
  qualityGateThreshold?: number;
}

function getGateColor(score: number | null, threshold: number): string {
  if (score === null) return GRAY;
  if (score >= threshold) return GREEN;
  if (score >= 60) return ORANGE;
  return RED;
}

const AnalysisDashboardPanel: React.FC<AnalysisDashboardPanelProps> = ({
  projectId,
  runs,
  datasets,
  selectedDatasetId,
  qualityGateThreshold = 70,
}) => {
  const { t } = useTranslation();
  const [chartView, setChartView] = useState<'time' | 'version'>('time');
  const [chainVersions, setChainVersions] = useState<any[] | null>(null);
  const [chainLoading, setChainLoading] = useState(false);

  // Find version chain root for selected dataset
  const findRootId = (dsId: number): number => {
    const ds = datasets.find(d => d.id === dsId);
    if (!ds || !ds.parent_dataset_id) return dsId;
    return findRootId(ds.parent_dataset_id);
  };

  // Load version chain when selection changes
  useEffect(() => {
    if (!selectedDatasetId || !projectId) {
      setChainVersions(null);
      return;
    }
    const rootId = findRootId(selectedDatasetId);
    setChainLoading(true);
    datasetsAPI.getDatasetVersions(projectId, rootId)
      .then(res => {
        const data = res?.data?.data || res?.data || {};
        const versions = (data.versions || []) as any[];
        const mapped = versions.map((v: any) => ({
          version: v.version,
          version_tag: v.version_tag,
          quality_score: v.latestAnalysis?.quality_score ?? null,
          total_issues: v.latestAnalysis?.total_issues_count ?? 0,
          created_at: v.created_at,
        }));
        setChainVersions(mapped.length > 1 ? mapped : null);
      })
      .catch(() => setChainVersions(null))
      .finally(() => setChainLoading(false));
  }, [selectedDatasetId, projectId]);

  // Reset to time view when versions not available
  useEffect(() => {
    if (!chainVersions) setChartView('time');
  }, [chainVersions]);

  // Compute KPIs from the filtered runs
  const versionChainIds = useMemo((): number[] => {
    if (!selectedDatasetId) return datasets.map(d => d.id);
    const rootId = findRootId(selectedDatasetId);
    return datasets
      .filter(d => {
        let cur: DatasetInfo | undefined = d;
        while (cur) {
          if (cur.id === rootId) return true;
          cur = cur.parent_dataset_id ? datasets.find(x => x.id === cur!.parent_dataset_id) : undefined;
        }
        return false;
      })
      .map(d => d.id);
  }, [selectedDatasetId, datasets]);

  const filteredRuns = useMemo(() =>
    runs
      .filter(r => r.status === 'COMPLETED' && r.dataset_id && versionChainIds.includes(r.dataset_id))
      .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()),
    [runs, versionChainIds]);

  const latestRun = filteredRuns[0] || null;
  const previousRun = filteredRuns[1] || null;

  const currentScore = latestRun?.quality_score ?? null;
  const prevScore = previousRun?.quality_score ?? null;
  const scoreDelta = currentScore !== null && prevScore !== null ? currentScore - prevScore : null;
  const totalIssues = latestRun?.total_issues_count ?? null;
  const criticalIssues = latestRun?.critical_issues_count ?? 0;
  const runCount = filteredRuns.length;

  const selectedDatasetName = useMemo(() => {
    if (!selectedDatasetId) return null;
    const rootId = findRootId(selectedDatasetId);
    const rootDs = datasets.find(d => d.id === rootId);
    return rootDs?.name || null;
  }, [selectedDatasetId, datasets]);

  const scoreColor = getGateColor(currentScore, qualityGateThreshold);
  const hasVersionToggle = !!chainVersions && chainVersions.length > 1 && !chainLoading;

  return (
    <Box sx={{ mb: 3 }}>
      {/* KPI row */}
      <Box sx={{
        display: 'flex',
        alignItems: 'stretch',
        border: '1px solid #EEEEEE',
        borderRadius: 2,
        overflow: 'hidden',
        mb: 2,
        backgroundColor: '#fff',
      }}>
        {/* Current score */}
        <KpiBlock
          label={t('analysisDashboard.currentScore')}
          sublabel={selectedDatasetId ? undefined : t('analysisDashboard.global')}
        >
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {currentScore !== null ? `${currentScore.toFixed(1)}%` : '—'}
          </Typography>
        </KpiBlock>

        <Divider />

        {/* Δ vs previous */}
        <KpiBlock label={t('analysisDashboard.vsPrev')}>
          {scoreDelta !== null ? (
            <Chip
              label={`${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)}%`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.85rem',
                height: 28,
                backgroundColor: scoreDelta > 0 ? `${GREEN}15` : scoreDelta < 0 ? `${RED}15` : '#F0F0F0',
                color: scoreDelta > 0 ? GREEN : scoreDelta < 0 ? RED : GRAY,
                border: `1px solid ${scoreDelta > 0 ? GREEN : scoreDelta < 0 ? RED : '#DDD'}`,
              }}
            />
          ) : (
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 500, color: GRAY }}>—</Typography>
          )}
        </KpiBlock>

        <Divider />

        {/* Analysis count */}
        <KpiBlock label={t('analysisDashboard.analysisCount')}>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
            {runCount}
          </Typography>
        </KpiBlock>

        <Divider />

        {/* Issues */}
        <KpiBlock label={t('analysisDashboard.currentIssues')}>
          {totalIssues !== null ? (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: totalIssues > 0 ? RED : GREEN, lineHeight: 1 }}>
                {totalIssues}
              </Typography>
              {criticalIssues > 0 && (
                <Typography sx={{ fontSize: '0.75rem', color: RED, fontWeight: 600 }}>
                  {t('analysisDashboard.criticalIssues', { count: criticalIssues })}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: GRAY, lineHeight: 1 }}>—</Typography>
          )}
        </KpiBlock>
      </Box>

      {/* Chart area */}
      <Box sx={{ border: '1px solid #EEEEEE', borderRadius: 2, overflow: 'hidden', backgroundColor: '#fff' }}>
        {/* Chart header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2.5, py: 1.5, borderBottom: '1px solid #F0F0F0',
        }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A1A1A' }}>
            {selectedDatasetName
              ? <><span style={{ color: GRAY, fontWeight: 400 }}>{t('analysisDashboard.evolutionTitle').split('·')[0] + '· '}</span>{selectedDatasetName}</>
              : t('analysisDashboard.evolutionTitle')}
            {runCount > 0 && (
              <span style={{ marginLeft: 8, fontSize: '0.78rem', color: GRAY, fontWeight: 400 }}>
                {t('analysisDashboard.runCount', { count: runCount })}
              </span>
            )}
          </Typography>

          {/* Toggle by time / by version */}
          {(hasVersionToggle || chainLoading) && (
            <Box sx={{
              display: 'flex',
              border: '1px solid #E8E8E8',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#FAFAFA',
            }}>
              {(['time', 'version'] as const).map(view => (
                <Box
                  key={view}
                  onClick={() => !chainLoading && setChartView(view)}
                  sx={{
                    px: 1.75, py: 0.6,
                    fontSize: '0.78rem', fontWeight: 500,
                    cursor: chainLoading ? 'default' : 'pointer',
                    backgroundColor: chartView === view ? '#00B37E' : 'transparent',
                    color: chartView === view ? '#fff' : '#777',
                    borderLeft: view === 'version' ? '1px solid #E8E8E8' : 'none',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    '&:hover': chartView !== view && !chainLoading ? { backgroundColor: '#F0F0F0', color: '#333' } : {},
                  }}
                >
                  {chainLoading && view === 'version' ? (
                    <CircularProgress size={10} sx={{ color: '#999' }} />
                  ) : null}
                  {view === 'time' ? t('analysisDashboard.byTime') : t('analysisDashboard.byVersion')}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Chart content */}
        <Box sx={{ p: 2 }}>
          {chartView === 'time' || !hasVersionToggle ? (
            <QualityTrendChart
              runs={runs}
              qualityGateThreshold={qualityGateThreshold}
              selectedDatasetId={selectedDatasetId}
              datasets={datasets}
            />
          ) : (
            chainVersions && (
              <VersionEvolutionChart
                versions={chainVersions}
                title=""
              />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Sub-components
const KpiBlock: React.FC<{ label: string; sublabel?: string; children: React.ReactNode }> = ({ label, sublabel, children }) => (
  <Box sx={{
    flex: 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    py: 2, px: 1.5,
    minWidth: 0,
  }}>
    <Typography sx={{
      fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: '#999', mb: 1,
    }}>
      {label}{sublabel && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> {sublabel}</span>}
    </Typography>
    {children}
  </Box>
);

const Divider: React.FC = () => (
  <Box sx={{ width: '1px', backgroundColor: '#EEEEEE', flexShrink: 0, my: 1.5 }} />
);

export default AnalysisDashboardPanel;
