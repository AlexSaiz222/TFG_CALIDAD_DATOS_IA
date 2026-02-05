import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { datasetsAPI } from '../services/api';
import { Dataset } from '../types';

interface VersionWithAnalysis extends Dataset {
  latestAnalysis?: {
    quality_score: number | null;
    quality_gate_status: 'PASSED' | 'FAILED' | 'WARNING' | null;
    total_issues_count: number;
    completed_at: string | null;
  } | null;
}

interface DatasetVersionHistoryProps {
  datasetId: number;
  projectId: number;
  onCompare?: (versionA: number, versionB: number) => void;
}

const DatasetVersionHistory: React.FC<DatasetVersionHistoryProps> = ({
  datasetId,
  projectId,
  onCompare,
}) => {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<number | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setLoading(true);
        const response = await datasetsAPI.getDatasetVersions(projectId, datasetId);
        const data = response?.data?.data || response?.data || {};
        setVersions(data.versions || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching versions:', err);
        setError('No se pudieron cargar las versiones del dataset');
      } finally {
        setLoading(false);
      }
    };

    if (datasetId && projectId) {
      fetchVersions();
    }
  }, [datasetId, projectId]);

  const getQualityGateIcon = (status: string | null | undefined) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 20 }} />;
      case 'FAILED':
        return <ErrorIcon sx={{ color: '#E5484D', fontSize: 20 }} />;
      case 'WARNING':
        return <WarningIcon sx={{ color: '#FFB800', fontSize: 20 }} />;
      default:
        return <ScheduleIcon sx={{ color: '#999', fontSize: 20 }} />;
    }
  };

  const getDotColor = (status: string | null | undefined): string => {
    switch (status) {
      case 'PASSED':
        return '#00B37E';
      case 'FAILED':
        return '#E5484D';
      case 'WARNING':
        return '#FFB800';
      default:
        return '#BDBDBD';
    }
  };

  const handleSelectForCompare = (versionId: number) => {
    if (selectedForCompare === null) {
      setSelectedForCompare(versionId);
    } else if (selectedForCompare === versionId) {
      setSelectedForCompare(null);
    } else {
      // Navigate to compare page
      router.push(`/datasets/compare?a=${selectedForCompare}&b=${versionId}&projectId=${projectId}`);
      setSelectedForCompare(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (versions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No hay historial de versiones disponible
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Historial de versiones
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {versions.length} versión{versions.length !== 1 ? 'es' : ''}
        </Typography>
      </Box>

      {selectedForCompare && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona otra versión para comparar con v{versions.find(v => v.id === selectedForCompare)?.version}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {versions.map((version, index) => (
          <Box key={version.id} sx={{ display: 'flex', gap: 2 }}>
            {/* Timeline indicator */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: getDotColor(version.latestAnalysis?.quality_gate_status),
                  border: version.is_latest ? 'none' : '2px solid',
                  borderColor: getDotColor(version.latestAnalysis?.quality_gate_status),
                  boxSizing: 'border-box',
                }}
              />
              {index < versions.length - 1 && (
                <Box
                  sx={{
                    width: 2,
                    flexGrow: 1,
                    backgroundColor: '#E0E0E0',
                    minHeight: 60,
                  }}
                />
              )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, pb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {formatDate(version.created_at)}
              </Typography>
              
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: version.id === datasetId ? '#00B37E' : '#EEEEEE',
                  borderRadius: 2,
                  backgroundColor: version.id === datasetId ? 'rgba(0, 179, 126, 0.04)' : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#00B37E',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={version.version_tag || `v${version.version}`}
                      size="small"
                      sx={{
                        backgroundColor: version.version > 1 ? 'rgba(156, 39, 176, 0.1)' : 'rgba(158, 158, 158, 0.1)',
                        color: version.version > 1 ? '#9c27b0' : '#757575',
                        fontWeight: 600,
                      }}
                    />
                    {version.is_latest && (
                      <Chip
                        label="Latest"
                        size="small"
                        sx={{
                          height: '20px',
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(25, 118, 210, 0.1)',
                          color: '#1976d2',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    {version.id === datasetId && (
                      <Chip
                        label="Actual"
                        size="small"
                        sx={{
                          height: '20px',
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(0, 179, 126, 0.1)',
                          color: '#00B37E',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Ver dataset">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/datasets/${version.id}`)}
                        sx={{ color: '#00B37E' }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {onCompare && versions.length > 1 && (
                      <Tooltip title={selectedForCompare === version.id ? 'Cancelar comparación' : 'Comparar'}>
                        <IconButton
                          size="small"
                          onClick={() => handleSelectForCompare(version.id)}
                          sx={{
                            color: selectedForCompare === version.id ? '#9c27b0' : '#757575',
                            backgroundColor: selectedForCompare === version.id ? 'rgba(156, 39, 176, 0.1)' : 'transparent',
                          }}
                        >
                          <CompareArrowsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getQualityGateIcon(version.latestAnalysis?.quality_gate_status)}
                    <Typography variant="body2" color="text.secondary">
                      {version.latestAnalysis?.quality_score != null
                        ? `${version.latestAnalysis.quality_score}%`
                        : 'Sin análisis'}
                    </Typography>
                  </Box>
                  
                  <Divider orientation="vertical" flexItem />
                  
                  <Typography variant="body2" color="text.secondary">
                    {version.row_count?.toLocaleString() || '—'} filas
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    {version.column_count || '—'} columnas
                  </Typography>
                </Box>

                {version.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {version.description}
                  </Typography>
                )}
              </Paper>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default DatasetVersionHistory;
