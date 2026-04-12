import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import type { DashboardProject } from '../../types';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';

interface AttentionTableProps {
  projects: DashboardProject[];
}

function getGateColor(status: string | null | undefined): string {
  if (status === 'PASSED') return GREEN;
  if (status === 'WARNING') return ORANGE;
  if (status === 'FAILED') return RED;
  return '#CCCCCC';
}

function getGateLabel(status: string | null | undefined): string {
  if (status === 'PASSED') return 'Aprobado';
  if (status === 'WARNING') return 'Advertencia';
  if (status === 'FAILED') return 'Fallido';
  return 'Sin datos';
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  return `hace ${Math.floor(days / 30)} mes(es)`;
}

const thSx = {
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#777',
  borderBottom: '2px solid #E8E8E8',
  backgroundColor: '#F8F8F8',
  py: 1.2,
  px: 1.5,
};

const tdSx = {
  fontSize: '0.82rem',
  color: '#333',
  borderBottom: '1px solid #F0F0F0',
  py: 1,
  px: 1.5,
};

const AttentionTable: React.FC<AttentionTableProps> = ({ projects }) => {
  const router = useRouter();

  // Filter projects that need attention: FAILED, WARNING, or score < 70
  const attentionProjects = projects
    .filter(p => {
      if (!p.latest_analysis) return false;
      const status = p.latest_analysis.quality_gate_status;
      const score = p.latest_analysis.quality_score;
      return status === 'FAILED' || status === 'WARNING' || (score !== null && score < 70);
    })
    .sort((a, b) => {
      const scoreA = a.latest_analysis?.quality_score ?? 100;
      const scoreB = b.latest_analysis?.quality_score ?? 100;
      return scoreA - scoreB;
    })
    .slice(0, 8);

  if (attentionProjects.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          py: 3,
          borderRadius: 2,
          backgroundColor: `${GREEN}08`,
          border: `1px dashed ${GREEN}40`,
        }}
      >
        <CheckCircleIcon sx={{ color: GREEN, fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: GREEN, fontWeight: 500 }}>
          Todos los proyectos en buen estado
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>Proyecto</TableCell>
            <TableCell sx={thSx} align="center">Score</TableCell>
            <TableCell sx={thSx} align="center">Estado</TableCell>
            <TableCell sx={thSx} align="center">Problemas</TableCell>
            <TableCell sx={thSx} align="right">Último análisis</TableCell>
            <TableCell sx={{ ...thSx, width: 40 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {attentionProjects.map(project => {
            const analysis = project.latest_analysis!;
            const gateColor = getGateColor(analysis.quality_gate_status);
            const score = analysis.quality_score;
            const scoreColor = score !== null
              ? score >= 80 ? GREEN : score >= 60 ? ORANGE : RED
              : '#888';

            return (
              <TableRow
                key={project.id}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: '#FAFAFA' },
                }}
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <TableCell sx={tdSx}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                    {project.name}
                  </Typography>
                </TableCell>
                <TableCell sx={tdSx} align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: scoreColor }}>
                      {score !== null ? `${score.toFixed(1)}%` : 'N/A'}
                    </Typography>
                    {/* Inline score bar */}
                    <Box sx={{ width: 50, height: 5, borderRadius: 3, backgroundColor: '#F0F0F0', overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${score ?? 0}%`,
                          height: '100%',
                          borderRadius: 3,
                          backgroundColor: scoreColor,
                        }}
                      />
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={tdSx} align="center">
                  <Chip
                    label={getGateLabel(analysis.quality_gate_status)}
                    size="small"
                    sx={{
                      backgroundColor: `${gateColor}15`,
                      color: gateColor,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 22,
                      border: `1px solid ${gateColor}30`,
                    }}
                  />
                </TableCell>
                <TableCell sx={tdSx} align="center">
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: analysis.total_issues_count > 0 ? ORANGE : '#888',
                    }}
                  >
                    {analysis.total_issues_count}
                  </Typography>
                </TableCell>
                <TableCell sx={tdSx} align="right">
                  <Typography variant="caption" sx={{ color: '#888' }}>
                    {timeAgo(analysis.completed_at)}
                  </Typography>
                </TableCell>
                <TableCell sx={tdSx}>
                  <IconButton
                    size="small"
                    sx={{ color: '#CCC', '&:hover': { color: RED } }}
                    onClick={e => { e.stopPropagation(); router.push(`/evaluations/${analysis.id}`); }}
                  >
                    <ArrowForwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AttentionTable;
