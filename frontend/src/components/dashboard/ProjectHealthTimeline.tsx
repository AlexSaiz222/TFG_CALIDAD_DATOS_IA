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

const GATE_LABELS: Record<string, string> = {
  PASSED: 'Aprobado',
  WARNING: 'Advertencia',
  FAILED: 'Fallido',
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
  runCount: number;
}

function getDateKey(dateStr: string): string {
  return dateStr.substring(0, 10);
}

function buildSlots(runs: DashboardRunHistory[], timeRange: TimeRange): TimeSlot[] {
  const now = new Date();
  // Work entirely in UTC to match the UTC-based date keys returned by getDateKey()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let startUTC: Date;

  if (timeRange === 'all') {
    if (runs.length === 0) {
      startUTC = new Date(todayUTC.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      const earliest = runs.reduce((min, r) => {
        const d = r.completed_at || r.created_at;
        return d < min ? d : min;
      }, runs[0].completed_at || runs[0].created_at);
      const e = new Date(earliest);
      startUTC = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
    }
  } else {
    const days = timeRange === '30d' ? 30 : 90;
    startUTC = new Date(todayUTC.getTime() - days * 24 * 60 * 60 * 1000);
  }

  // Build a map of date -> worst run + count
  const runsByDate: Record<string, DashboardRunHistory> = {};
  const countByDate: Record<string, number> = {};
  for (const run of runs) {
    const dateKey = getDateKey(run.completed_at || run.created_at);
    countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;
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

  // Generate one slot per UTC day from startUTC to todayUTC (inclusive)
  const slots: TimeSlot[] = [];
  const current = new Date(startUTC);

  while (current <= todayUTC) {
    const dateKey = current.toISOString().substring(0, 10);
    slots.push({
      date: dateKey,
      run: runsByDate[dateKey] || null,
      runCount: countByDate[dateKey] || 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return slots;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '–';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} d.`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return `Hace ${Math.floor(days / 30)} mes.`;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#888';
  return score >= 80 ? GREEN : score >= 60 ? ORANGE : RED;
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
              width: 120,
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

              const gateLabel = slot.run?.quality_gate_status
                ? GATE_LABELS[slot.run.quality_gate_status] || slot.run.quality_gate_status
                : 'N/A';
              const multiInfo = slot.runCount > 1
                ? ` · ${slot.runCount} evaluaciones (se muestra la más desfavorable)`
                : '';
              const tooltipContent = hasRun
                ? `${formatDate(slot.date)} · Score: ${slot.run!.quality_score?.toFixed(1) ?? 'N/A'}% · ${gateLabel} · ${slot.run!.total_issues_count} problemas${multiInfo}`
                : `${formatDate(slot.date)} · Sin evaluación`;

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
                        router.push(`/evaluations/${slot.run.id}`);
                      }
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>

          {/* Stats column */}
          <Box sx={{ width: 155, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.2 }}>
            {project.latest_analysis ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: scoreColor(project.latest_analysis.quality_score) }}>
                    {project.latest_analysis.quality_score?.toFixed(1) ?? '—'}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 500, color: project.latest_analysis.quality_gate_status ? GATE_COLORS[project.latest_analysis.quality_gate_status] || '#888' : '#888' }}>
                    {project.latest_analysis.quality_gate_status ? GATE_LABELS[project.latest_analysis.quality_gate_status] || project.latest_analysis.quality_gate_status : '–'}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.67rem', color: '#AAA' }}>
                  Última: {relativeTime(project.latest_analysis.completed_at)}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: '#AAA' }}>
                  {project.runs_history.length} eval. en el periodo
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.67rem', color: '#CCC' }}>Sin análisis</Typography>
            )}
          </Box>
        </Box>
      ))}

      {/* Date axis labels */}
      {dateLabels.length > 0 && (
        <Box sx={{ display: 'flex', ml: '132px', mr: '167px', mt: 0.5 }}>
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
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, ml: '132px' }}>
        {[
          { label: 'Aprobado', color: GREEN },
          { label: 'Advertencia', color: ORANGE },
          { label: 'Fallido', color: RED },
          { label: 'Sin evaluación', color: GRAY_EMPTY },
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
