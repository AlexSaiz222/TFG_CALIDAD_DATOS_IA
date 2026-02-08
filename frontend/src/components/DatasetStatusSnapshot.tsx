import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import type { AnalysisRun } from '../types';

// Colores consistentes
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

interface DatasetStatusSnapshotProps {
  runs: AnalysisRun[];
  datasets: DatasetInfo[];
  selectedDatasetId: number | null;
  onSelectDataset: (datasetId: number) => void;
  qualityGateThreshold?: number;
}

interface DatasetStatus {
  datasetId: number;
  datasetName: string;
  versionChainIds: number[];
  latestRun: AnalysisRun | null;
  score: number;
  status: 'PASSED' | 'WARNING' | 'FAILED' | 'NO_DATA';
  issuesCount: number;
  lastAnalyzed: string | null;
}

const DatasetStatusSnapshot: React.FC<DatasetStatusSnapshotProps> = ({
  runs,
  datasets,
  selectedDatasetId,
  onSelectDataset,
  qualityGateThreshold = 80,
}) => {
  // Agrupar datasets por cadena de versiones
  const groupedDatasets = useMemo(() => {
    // Función para encontrar el root de una cadena de versiones
    const findRootId = (dataset: DatasetInfo): number => {
      if (!dataset.parent_dataset_id) return dataset.id;
      const parent = datasets.find(d => d.id === dataset.parent_dataset_id);
      return parent ? findRootId(parent) : dataset.id;
    };

    // Agrupar por root ID
    const groups = new Map<number, DatasetInfo[]>();
    datasets.forEach(dataset => {
      const rootId = findRootId(dataset);
      if (!groups.has(rootId)) {
        groups.set(rootId, []);
      }
      groups.get(rootId)!.push(dataset);
    });

    // Para cada grupo, obtener el nombre base y todos los IDs
    return Array.from(groups.entries()).map(([rootId, groupDatasets]) => {
      // Ordenar por versión descendente para obtener la última
      const sorted = [...groupDatasets].sort((a, b) => (b.version || 1) - (a.version || 1));
      const latestDataset = sorted[0];
      // Usar el nombre del root (sin versión en el nombre)
      const rootDataset = groupDatasets.find(d => d.id === rootId) || latestDataset;
      
      return {
        baseName: rootDataset.name,
        latestDatasetId: latestDataset.id,
        allIds: groupDatasets.map(d => d.id),
      };
    });
  }, [datasets]);

  // Calcular el estado actual de cada grupo de datasets
  const datasetStatuses = useMemo((): DatasetStatus[] => {
    return groupedDatasets.map((group) => {
      // Encontrar el último análisis completado para cualquier versión de este dataset
      const groupRuns = runs
        .filter((run) => run.dataset_id && group.allIds.includes(run.dataset_id) && run.status === 'COMPLETED')
        .sort((a, b) => {
          const dateA = new Date(a.completed_at || a.created_at).getTime();
          const dateB = new Date(b.completed_at || b.created_at).getTime();
          return dateB - dateA; // Más reciente primero
        });

      const latestRun = groupRuns[0] || null;

      if (!latestRun) {
        return {
          datasetId: group.latestDatasetId,
          datasetName: group.baseName,
          versionChainIds: group.allIds,
          latestRun: null,
          score: 0,
          status: 'NO_DATA' as const,
          issuesCount: 0,
          lastAnalyzed: null,
        };
      }

      const score = latestRun.quality_score || 0;
      let status: 'PASSED' | 'WARNING' | 'FAILED' = 'PASSED';
      
      if (latestRun.quality_gate_status) {
        status = latestRun.quality_gate_status as 'PASSED' | 'WARNING' | 'FAILED';
      } else if (score >= qualityGateThreshold) {
        status = 'PASSED';
      } else if (score >= 60) {
        status = 'WARNING';
      } else {
        status = 'FAILED';
      }

      return {
        datasetId: group.latestDatasetId,
        datasetName: group.baseName,
        versionChainIds: group.allIds,
        latestRun,
        score,
        status,
        issuesCount: latestRun.total_issues_count || 0,
        lastAnalyzed: latestRun.completed_at || latestRun.created_at,
      };
    });
  }, [runs, groupedDatasets, qualityGateThreshold]);

  // Ordenar por score (menor primero para destacar problemas)
  const sortedStatuses = useMemo(() => {
    return [...datasetStatuses].sort((a, b) => {
      // NO_DATA al final
      if (a.status === 'NO_DATA' && b.status !== 'NO_DATA') return 1;
      if (b.status === 'NO_DATA' && a.status !== 'NO_DATA') return -1;
      // Luego por score ascendente (peores primero)
      return a.score - b.score;
    });
  }, [datasetStatuses]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircleIcon sx={{ color: GREEN, fontSize: 20 }} />;
      case 'WARNING':
        return <WarningIcon sx={{ color: ORANGE, fontSize: 20 }} />;
      case 'FAILED':
        return <ErrorIcon sx={{ color: RED, fontSize: 20 }} />;
      default:
        return <TrendingUpIcon sx={{ color: GRAY, fontSize: 20 }} />;
    }
  };


  if (datasets.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
        <TrendingUpIcon sx={{ fontSize: 48, color: GRAY, mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#555555' }}>
          No hay datasets en este proyecto
        </Typography>
        <Typography variant="body2" sx={{ color: '#888888' }}>
          Añade datasets para ver su estado de calidad.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#555555' }}>
          Estado actual de los datasets
        </Typography>
        <Typography variant="caption" sx={{ color: GRAY }}>
          {datasets.length} datasets · Clic para ver evolución
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {sortedStatuses.map((ds) => {
          // Verificar si el dataset seleccionado pertenece a esta cadena de versiones
          const isSelected = selectedDatasetId !== null && ds.versionChainIds.includes(selectedDatasetId);
          const statusColor = ds.status === 'PASSED' ? GREEN : ds.status === 'WARNING' ? ORANGE : ds.status === 'FAILED' ? RED : GRAY;
          
          return (
            <Box
              key={ds.datasetId}
              onClick={() => onSelectDataset(ds.datasetId)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                border: isSelected ? `1.5px solid ${GREEN}` : '1px solid transparent',
                backgroundColor: isSelected ? 'rgba(0, 179, 126, 0.04)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: isSelected ? 'rgba(0, 179, 126, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                },
              }}
            >
              {/* Status icon */}
              {getStatusIcon(ds.status)}
              
              {/* Dataset name */}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: isSelected ? 600 : 400,
                  color: '#1A1A1A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ds.datasetName}
              </Typography>
              
              {/* Score and issues */}
              {ds.status !== 'NO_DATA' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: ds.issuesCount > 0 ? RED : GRAY,
                      fontWeight: 500,
                    }}
                  >
                    {ds.issuesCount} issues
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: statusColor,
                      minWidth: '42px',
                      textAlign: 'right',
                    }}
                  >
                    {ds.score.toFixed(0)}%
                  </Typography>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: GRAY, fontStyle: 'italic' }}>
                  Sin analizar
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

export default DatasetStatusSnapshot;
