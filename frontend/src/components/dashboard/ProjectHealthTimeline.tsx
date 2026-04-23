import React, { useMemo, useEffect } from 'react';
import { Box, Typography, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useRouter } from 'next/router';
import type { DashboardProject, DashboardRunHistory } from '../../types';
import { useTranslation } from 'react-i18next';

const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';

const GATE_COLORS: Record<string, string> = {
  PASSED: GREEN,
  WARNING: ORANGE,
  FAILED: RED,
};

export type AnalysisLimit = 20 | 50 | 100;

interface ProjectHealthTimelineProps {
  projects: DashboardProject[];
  analysisLimit: AnalysisLimit;
  onAnalysisLimitChange: (limit: AnalysisLimit) => void;
}

interface AnalysisSlot {
  run: DashboardRunHistory;
  datetime: string;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#888';
  return score >= 80 ? GREEN : score >= 60 ? ORANGE : RED;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ProjectHealthTimeline: React.FC<ProjectHealthTimelineProps> = ({
  projects,
  analysisLimit,
  onAnalysisLimitChange,
}) => {
  const router = useRouter();
  const { t } = useTranslation();

  const relativeTime = (dateStr: string | null): string => {
    if (!dateStr) return '–';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return t('time.today');
    if (days === 1) return t('time.yesterday');
    if (days < 7) return t('time.daysAgoShort', { count: days });
    if (days < 30) return t('time.weeksAgoShort', { count: Math.floor(days / 7) });
    return t('time.monthsAgoShort', { count: Math.floor(days / 30) });
  };

  const GATE_LABELS: Record<string, string> = {
    PASSED: t('projectHealthTimeline.legend.passed'),
    WARNING: t('projectHealthTimeline.legend.warning'),
    FAILED: t('projectHealthTimeline.legend.failed'),
  };

  const projectsToShow = useMemo(() => {
    if (projects.length <= 8) return projects;
    const withRuns = projects.filter(p => p.runs_history.length > 0);
    return withRuns.length > 0 ? withRuns : projects.slice(0, 8);
  }, [projects]);

  const projectSlots = useMemo(() => {
    return projectsToShow.map(project => {
      const slots: AnalysisSlot[] = [...project.runs_history]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(run => ({ run, datetime: run.completed_at ?? run.created_at }));
      return { project, slots };
    });
  }, [projectsToShow]);

  // Auto-scroll all timeline bar containers to the right (most recent analysis visible)
  useEffect(() => {
    const containers = document.querySelectorAll('[data-timeline-scroll]');
    containers.forEach(el => {
      (el as HTMLElement).scrollLeft = el.scrollWidth;
    });
  }, [projectSlots]);

  if (projects.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Typography variant="body2" sx={{ color: '#888' }}>
          {t('projectHealthTimeline.noAnalysis')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Analysis limit selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={analysisLimit}
          exclusive
          onChange={(_, val) => val !== null && onAnalysisLimitChange(val as AnalysisLimit)}
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
          <ToggleButton value={20}>{t('projectHealthTimeline.last20')}</ToggleButton>
          <ToggleButton value={50}>{t('projectHealthTimeline.last50')}</ToggleButton>
          <ToggleButton value={100}>{t('projectHealthTimeline.last100')}</ToggleButton>
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
                  ? GATE_COLORS[project.latest_analysis.quality_gate_status] || '#CCC'
                  : '#CCC',
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

          {/* Timeline bars - horizontally scrollable, newest on the right */}
          <Box
            data-timeline-scroll=""
            sx={{
              display: 'flex',
              flex: 1,
              gap: '1.5px',
              height: 26,
              alignItems: 'center',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {slots.length === 0 ? (
              <Typography sx={{ fontSize: '0.72rem', color: '#CCC', ml: 0.5 }}>
                {t('projectHealthTimeline.noAnalysis')}
              </Typography>
            ) : (
              slots.map((slot, i) => {
                const color = slot.run.quality_gate_status
                  ? GATE_COLORS[slot.run.quality_gate_status] || '#CCC'
                  : '#CCC';

                const gateLabel = slot.run.quality_gate_status
                  ? GATE_LABELS[slot.run.quality_gate_status] || slot.run.quality_gate_status
                  : t('projectHealthTimeline.noGateStatus');

                const tooltipContent = `${formatDateTime(slot.datetime)} · Score: ${slot.run.quality_score?.toFixed(1) ?? 'N/A'}% · ${gateLabel}`;

                return (
                  <Tooltip key={i} title={tooltipContent} arrow placement="top">
                    <Box
                      sx={{
                        flex: '1 0 6px',
                        maxWidth: 24,
                        minWidth: 6,
                        height: '100%',
                        flexShrink: 0,
                        borderRadius: '2px',
                        backgroundColor: color,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s, transform 0.15s',
                        '&:hover': { opacity: 0.75, transform: 'scaleY(1.15)' },
                      }}
                      onClick={() => router.push(`/evaluations/${slot.run.id}`)}
                    />
                  </Tooltip>
                );
              })
            )}
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
                  {t('projectHealthTimeline.lastAnalysis', { time: relativeTime(project.latest_analysis.completed_at) })}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: '#AAA' }}>
                  {t('projectHealthTimeline.evalCount', { count: project.runs_history.length })}
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.67rem', color: '#CCC' }}>{t('projectHealthTimeline.noAnalysis')}</Typography>
            )}
          </Box>
        </Box>
      ))}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, ml: '132px' }}>
        {[
          { key: 'passed', color: GREEN },
          { key: 'warning', color: ORANGE },
          { key: 'failed', color: RED },
        ].map(item => (
          <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: item.color }} />
            <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>
              {t(`projectHealthTimeline.legend.${item.key}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ProjectHealthTimeline;
