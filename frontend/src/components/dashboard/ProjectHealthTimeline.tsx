import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useRouter } from 'next/router';
import type { DashboardProject, DashboardRunHistory } from '../../types';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY_EMPTY = '#F0F0F0';

const GATE_COLORS: Record<string, string> = {
  PASSED: GREEN,
  WARNING: ORANGE,
  FAILED: RED,
};

const GATE_PRIORITY: Record<string, number> = {
  FAILED: 3,
  WARNING: 2,
  PASSED: 1,
};

export type TimeRange = '30d' | '90d' | 'all';

interface ProjectHealthTimelineProps {
  projects: DashboardProject[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

interface TimeSlot {
  date: string;
  run: DashboardRunHistory | null;
}

function getDateKey(dateStr: string): string {
  return dateStr.substring(0, 10);
}

function buildSlots(runs: DashboardRunHistory[], timeRange: TimeRange): TimeSlot[] {
  const now = new Date();
  let startDate: Date;

  if (timeRange === 'all') {
    if (runs.length === 0) {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      const earliest = runs.reduce((min, r) => {
        const d = r.completed_at || r.created_at;
        return d < min ? d : min;
      }, runs[0].completed_at || runs[0].created_at);
      startDate = new Date(earliest);
    }
  } else {
    const days = timeRange === '30d' ? 30 : 90;
    startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  // Build a map of date -> worst run
  const runsByDate: Record<string, DashboardRunHistory> = {};
  for (const run of runs) {
    const dateKey = getDateKey(run.completed_at || run.created_at);
    const existing = runsByDate[dateKey];
    if (!existing) {
      runsByDate[dateKey] = run;
    } else {
      const existingPriority = GATE_PRIORITY[existing.quality_gate_status || ''] || 0;
      const newPriority = GATE_PRIORITY[run.quality_gate_status || ''] || 0;
      if (newPriority > existingPriority) {
        runsByDate[dateKey] = run;
      }
    }
  }

  // Generate slots for each day
  const slots: TimeSlot[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dateKey = current.toISOString().substring(0, 10);
    slots.push({
      date: dateKey,
      run: runsByDate[dateKey] || null,
    });
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const ProjectHealthTimeline: React.FC<ProjectHealthTimelineProps> = ({
  projects,
  timeRange,
  onTimeRangeChange,
}) => {
  const router = useRouter();

  // Only show projects that have at least one run OR show all if few projects
  const projectsToShow = useMemo(() => {
    if (projects.length <= 8) return projects;
    const withRuns = projects.filter(p => p.runs_history.length > 0);
    return withRuns.length > 0 ? withRuns : projects.slice(0, 8);
  }, [projects]);

  const projectSlots = useMemo(() => {
    return projectsToShow.map(project => ({
      project,
      slots: buildSlots(project.runs_history, timeRange),
    }));
  }, [projectsToShow, timeRange]);

  // Get date labels for axis
  const dateLabels = useMemo(() => {
    if (projectSlots.length === 0) return [];
    const slots = projectSlots[0].slots;
    if (slots.length === 0) return [];
    const labels = [
      formatDate(slots[0].date),
      formatDate(slots[Math.floor(slots.length / 2)].date),
      formatDate(slots[slots.length - 1].date),
    ];
    return labels;
  }, [projectSlots]);

  if (projects.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Typography variant="body2" sx={{ color: '#888' }}>
          No hay proyectos para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Time range selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, val) => val && onTimeRangeChange(val)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontSize: '0.75rem',
              px: 1.5,
              py: 0.5,
              border: '1px solid #E0E0E0',
              '&.Mui-selected': {
                backgroundColor: `${GREEN}15`,
                color: GREEN,
                borderColor: GREEN,
                '&:hover': { backgroundColor: `${GREEN}25` },
              },
            },
          }}
        >
          <ToggleButton value="30d">30 dias</ToggleButton>
          <ToggleButton value="90d">90 dias</ToggleButton>
          <ToggleButton value="all">Todo</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Timeline rows */}
      {projectSlots.map(({ project, slots }) => (
        <Box
          key={project.id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}
        >
          {/* Project name */}
          <Box
            sx={{
              width: 160,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              '&:hover .project-name': { color: GREEN },
            }}
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: project.latest_analysis?.quality_gate_status
                  ? GATE_COLORS[project.latest_analysis.quality_gate_status] || GRAY_EMPTY
                  : GRAY_EMPTY,
              }}
            />
            <Typography
              className="project-name"
              variant="body2"
              sx={{
                fontWeight: 500,
                color: '#333',
                fontSize: '0.8rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {project.name}
            </Typography>
          </Box>

          {/* Timeline bars */}
          <Box sx={{ display: 'flex', flex: 1, gap: '1.5px', height: 26, alignItems: 'center' }}>
            {slots.map((slot, i) => {
              const hasRun = slot.run !== null;
              const color = hasRun && slot.run!.quality_gate_status
                ? GATE_COLORS[slot.run!.quality_gate_status] || GRAY_EMPTY
                : GRAY_EMPTY;

              const tooltipContent = hasRun
                ? `${formatDate(slot.date)} - Score: ${slot.run!.quality_score?.toFixed(1) ?? 'N/A'}% - ${slot.run!.quality_gate_status || 'N/A'} - ${slot.run!.total_issues_count} incidencias`
                : `${formatDate(slot.date)} - Sin evaluacion`;

              return (
                <Tooltip key={i} title={tooltipContent} arrow placement="top">
                  <Box
                    sx={{
                      flex: 1,
                      height: hasRun ? '100%' : '60%',
                      minWidth: 2,
                      borderRadius: '2px',
                      backgroundColor: color,
                      cursor: hasRun ? 'pointer' : 'default',
                      transition: 'opacity 0.15s, transform 0.15s',
                      '&:hover': hasRun
                        ? { opacity: 0.75, transform: 'scaleY(1.15)' }
                        : {},
                    }}
                    onClick={() => {
                      if (hasRun && slot.run) {
                        router.push(`/projects/${project.id}/analysis/${slot.run.id}`);
                      }
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      ))}

      {/* Date axis labels */}
      {dateLabels.length > 0 && (
        <Box sx={{ display: 'flex', ml: '172px', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#AAA', flex: 1, textAlign: 'left', fontSize: '0.65rem' }}>
            {dateLabels[0]}
          </Typography>
          <Typography variant="caption" sx={{ color: '#AAA', flex: 1, textAlign: 'center', fontSize: '0.65rem' }}>
            {dateLabels[1]}
          </Typography>
          <Typography variant="caption" sx={{ color: '#AAA', flex: 1, textAlign: 'right', fontSize: '0.65rem' }}>
            {dateLabels[2]}
          </Typography>
        </Box>
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, ml: '172px' }}>
        {[
          { label: 'Passed', color: GREEN },
          { label: 'Warning', color: ORANGE },
          { label: 'Failed', color: RED },
          { label: 'Sin evaluacion', color: GRAY_EMPTY },
        ].map(item => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: item.color }} />
            <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ProjectHealthTimeline;
