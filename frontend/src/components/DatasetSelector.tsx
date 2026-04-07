import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import type { AnalysisRun } from '../types';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#BDBDBD';

interface DatasetInfo {
  id: number;
  name: string;
  version?: number;
  parent_dataset_id?: number | null;
}

interface DatasetSelectorProps {
  runs: AnalysisRun[];
  datasets: DatasetInfo[];
  selectedDatasetId: number | null;
  onSelect: (id: number | null) => void;
  qualityGateThreshold?: number;
}

interface DatasetStatus {
  datasetId: number;
  name: string;
  versionChainIds: number[];
  latestVersion: number;
  hasMultipleVersions: boolean;
  score: number | null;
  gateStatus: 'PASSED' | 'WARNING' | 'FAILED' | 'NO_DATA';
  issuesCount: number;
}

function getGateColor(status: string) {
  switch (status) {
    case 'PASSED': return GREEN;
    case 'WARNING': return ORANGE;
    case 'FAILED': return RED;
    default: return GRAY;
  }
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  runs,
  datasets,
  selectedDatasetId,
  onSelect,
  qualityGateThreshold = 70,
}) => {
  const statuses = useMemo((): DatasetStatus[] => {
    const findRootId = (dsId: number): number => {
      const ds = datasets.find(d => d.id === dsId);
      if (!ds || !ds.parent_dataset_id) return dsId;
      return findRootId(ds.parent_dataset_id);
    };

    const groups = new Map<number, DatasetInfo[]>();
    datasets.forEach(ds => {
      const rootId = findRootId(ds.id);
      if (!groups.has(rootId)) groups.set(rootId, []);
      groups.get(rootId)!.push(ds);
    });

    return Array.from(groups.entries()).map(([rootId, group]) => {
      const sorted = [...group].sort((a, b) => (b.version || 1) - (a.version || 1));
      const latest = sorted[0];
      const rootDs = group.find(d => d.id === rootId) || latest;
      const allIds = group.map(d => d.id);

      const completedRuns = runs
        .filter(r => r.dataset_id && allIds.includes(r.dataset_id) && r.status === 'COMPLETED')
        .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());

      const latestRun = completedRuns[0] || null;
      const score = latestRun?.quality_score ?? null;

      let gateStatus: DatasetStatus['gateStatus'] = 'NO_DATA';
      if (latestRun) {
        if (latestRun.quality_gate_status) {
          gateStatus = latestRun.quality_gate_status as any;
        } else if (score !== null) {
          gateStatus = score >= qualityGateThreshold ? 'PASSED' : score >= 60 ? 'WARNING' : 'FAILED';
        }
      }

      return {
        datasetId: latest.id,
        name: rootDs.name,
        versionChainIds: allIds,
        latestVersion: latest.version || 1,
        hasMultipleVersions: group.length > 1,
        score,
        gateStatus,
        issuesCount: latestRun?.total_issues_count || 0,
      };
    });
  }, [runs, datasets, qualityGateThreshold]);

  if (datasets.length === 0) return null;

  const allSelected = selectedDatasetId === null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          // Hide scrollbar but keep functionality
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {/* "Todos" pill */}
        <Pill
          label="Todos"
          score={null}
          gateColor={GRAY}
          isSelected={allSelected}
          onClick={() => onSelect(null)}
          showDot={false}
        />

        {statuses.map(ds => {
          const isSelected = selectedDatasetId !== null && ds.versionChainIds.includes(selectedDatasetId);
          const color = getGateColor(ds.gateStatus);
          return (
            <Tooltip key={ds.datasetId} title={ds.name} placement="bottom" enterDelay={600}>
              <span>
                <Pill
                  label={ds.name}
                  score={ds.score}
                  gateColor={color}
                  isSelected={isSelected}
                  onClick={() => onSelect(ds.datasetId)}
                  versionBadge={ds.hasMultipleVersions ? `v${ds.latestVersion}` : undefined}
                />
              </span>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

interface PillProps {
  label: string;
  score: number | null;
  gateColor: string;
  isSelected: boolean;
  onClick: () => void;
  versionBadge?: string;
  showDot?: boolean;
}

const Pill: React.FC<PillProps> = ({
  label,
  score,
  gateColor,
  isSelected,
  onClick,
  versionBadge,
  showDot = true,
}) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.75,
      px: 1.5,
      height: 34,
      borderRadius: '17px',
      border: `1.5px solid ${isSelected ? gateColor : '#E0E0E0'}`,
      backgroundColor: isSelected ? `${gateColor}12` : '#FAFAFA',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'all 0.15s ease',
      '&:hover': {
        borderColor: isSelected ? gateColor : '#BDBDBD',
        backgroundColor: isSelected ? `${gateColor}1A` : '#F0F0F0',
      },
    }}
  >
    {showDot && (
      <Box sx={{
        width: isSelected ? 8 : 7,
        height: isSelected ? 8 : 7,
        borderRadius: '50%',
        backgroundColor: gateColor,
        flexShrink: 0,
        transition: 'all 0.15s',
      }} />
    )}
    <Typography sx={{
      fontSize: '0.82rem',
      fontWeight: isSelected ? 600 : 400,
      color: isSelected ? '#1A1A1A' : '#555',
      maxWidth: 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {label}
    </Typography>
    {score !== null && (
      <Typography sx={{
        fontSize: '0.78rem',
        fontWeight: 700,
        color: gateColor,
        lineHeight: 1,
      }}>
        {score.toFixed(0)}%
      </Typography>
    )}
    {versionBadge && (
      <Box sx={{
        px: 0.6,
        py: 0.1,
        borderRadius: '4px',
        backgroundColor: isSelected ? `${gateColor}25` : 'rgba(0,0,0,0.06)',
        fontSize: '0.62rem',
        fontWeight: 700,
        color: isSelected ? gateColor : '#888',
        lineHeight: 1.4,
      }}>
        {versionBadge}
      </Box>
    )}
  </Box>
);

export default DatasetSelector;
