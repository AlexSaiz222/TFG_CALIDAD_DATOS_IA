import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import MainLayout from '../../components/layout/MainLayout';
import { ColumnMetricsTable, IssuesSummary, MetricDetailsTabs, ExecutiveMetricCard } from '../../components/evaluations';
import QualityGateBadge from '../../components/QualityGateBadge';
import { analysisAPI, datasetsAPI, projectsAPI } from '../../services/api';
import type { AnalysisRun, DataQualityIssue, Issue, Dataset, ColumnMetrics } from '../../types';

const EvaluationDetail = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = router.query;
  const runId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rawIssues, setRawIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [scoreExpanded, setScoreExpanded] = useState(true);
  const [qgThreshold, setQgThreshold] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (runId === undefined || isNaN(runId)) {
        setLoading(false);
        setError(t('evaluations.detail.invalidId'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const runResponse = await analysisAPI.getAnalysisRun(runId);
        const runData = runResponse.data?.data?.analysis_run ||
                       runResponse.data?.analysis_run ||
                       runResponse.data?.data ||
                       runResponse.data;
        setRun(runData);

        if (runData?.dataset_id) {
          try {
            const datasetResponse = await datasetsAPI.getDataset(runData.dataset_id);
            setDataset(datasetResponse.data?.data || datasetResponse.data);
          } catch {
            console.warn('Error fetching dataset');
          }
        }

        if (runData?.project_id) {
          try {
            const qgResponse = await projectsAPI.getQualityGate(runData.project_id);
            const qgData = qgResponse.data?.data || qgResponse.data;
            setQgThreshold(qgData?.thresholds?.min_score ?? null);
          } catch {
            console.warn('Could not load quality gate');
          }
        }

        setLoading(false);

        setIssuesLoading(true);
        try {
          const issuesResponse = await analysisAPI.getAnalysisRunIssues(runId);
          const issuesData = issuesResponse.data?.data?.issues ||
                            issuesResponse.data?.issues || [];
          setRawIssues(Array.isArray(issuesData) ? issuesData : []);
        } catch {
          console.warn('Error fetching issues');
          setRawIssues([]);
        }
        setIssuesLoading(false);
      } catch (err: any) {
        console.error('Error fetching analysis run:', err);
        setError(err.response?.data?.message || t('evaluations.detail.loadError'));
        setLoading(false);
      }
    };

    if (router.isReady && runId !== undefined) {
      fetchData();
    }
  }, [runId, router.isReady]);

  // Severity mapping: DataQualityIssue ('critical'|'major'|'minor'|'info') → Issue ('critical'|'high'|'medium'|'low')
  const SEVERITY_MAP: Record<string, Issue['severity']> = {
    critical: 'critical', major: 'high', minor: 'medium', info: 'low',
  };
  const mapSeverity = (s: string): Issue['severity'] => SEVERITY_MAP[s] ?? 'low';

  const toIssue = (dqi: DataQualityIssue): Issue => ({
    id: dqi.id,
    evaluation_id: dqi.analysis_run_id,
    metric_id: dqi.metric_id,
    severity: mapSeverity(dqi.severity),
    description: dqi.description,
    issue_type: dqi.issue_type,
    affected_columns: dqi.affected_columns,
    affected_rows: dqi.affected_rows,
    created_at: dqi.created_at,
  } as unknown as Issue);

  const issues: Issue[] = rawIssues.map(toIssue);

  const getMetricName = (issue: { issue_type?: string; description: string }): string => {
    const type = issue.issue_type || '';
    if (type === 'completeness') return t('evaluations.detail.metricName.completeness');
    if (type === 'low_variability' || type === 'non_unique_identifier' || type === 'duplicate_rows') return t('evaluations.detail.metricName.uniqueness');
    if (type === 'outliers') return t('evaluations.detail.metricName.outliers');
    if (type === 'syntactic_accuracy') return t('evaluations.detail.metricName.syntacticAccuracy');
    if (type === 'class_balance') return t('evaluations.detail.metricName.classBalance');
    if (type === 'currentness') return t('evaluations.detail.metricName.currentness');
    if (type === 'logical_consistency') return t('evaluations.detail.metricName.logicalConsistency');
    const lower = (issue.description || '').toLowerCase();
    if (lower.includes('completitud') || lower.includes('completeness') || lower.includes('null') || lower.includes('nulo')) return t('evaluations.detail.metricName.completeness');
    if (lower.includes('unicidad') || lower.includes('unique') || lower.includes('duplicad') || lower.includes('variabilidad')) return t('evaluations.detail.metricName.uniqueness');
    if (lower.includes('atípico') || lower.includes('outlier')) return t('evaluations.detail.metricName.outliers');
    if (lower.includes('tipo esperado') || lower.includes('conformidad') || lower.includes('sintáct') || lower.includes('syntactic')) return t('evaluations.detail.metricName.syntacticAccuracy');
    if (lower.includes('clase') || lower.includes('desequilibr') || lower.includes('balance') || lower.includes('minoritaria')) return t('evaluations.detail.metricName.classBalance');
    if (lower.includes('desactualiz') || lower.includes('currentness') || lower.includes('obsolet') || lower.includes('frescura')) return t('evaluations.detail.metricName.currentness');
    if (lower.includes('regla') || lower.includes('consistencia') || lower.includes('violó') || lower.includes('logical')) return t('evaluations.detail.metricName.logicalConsistency');
    return t('evaluations.detail.metricName.general');
  };

  const filteredIssues = issues.filter((issue) => {
    const matchesSeverity = selectedSeverity ? issue.severity === selectedSeverity : true;
    const matchesMetric = selectedMetric ? getMetricName(issue) === selectedMetric : true;
    return matchesSeverity && matchesMetric;
  });

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error || !run) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {t('evaluations.detail.notFound')}
            </Typography>
          </Box>
          <Alert severity="error">{error || t('evaluations.detail.notFound')}</Alert>
          <Button variant="contained" onClick={() => router.push('/evaluations')} sx={{ mt: 3 }}>
            {t('evaluations.detail.backToHistory')}
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const results = run.results;
  const overallMetrics: Record<string, any> = results?.overall || {};
  const columnMetrics: Record<string, ColumnMetrics> = results?.column_metrics || {};

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {dataset?.name || t('evaluations.detail.analysisNumber', { id: run.id })}
            </Typography>
            <Typography variant="body2" sx={{ color: '#555555', mt: 0.5 }}>
              {new Date(run.completed_at || run.created_at).toLocaleString(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </Typography>
          </Box>
        </Box>

        {/* Results */}
        <>
            {/* Quality Score and Metrics Summary — Unified Grid */}
            {(() => {
              // Build metric cards data and compute tab indices for click-to-tab navigation
              const metricCards: Array<{ title: string; value: string; badge: { label: string; bg: string; color: string }; insight: string; tabKey: string }> = [];

              const badge = (v98: boolean, v90: boolean) =>
                v98 ? { label: t('evaluations.detail.badge.excellent'), bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                    : v90 ? { label: t('evaluations.detail.badge.needsAttention'), bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                    : { label: t('evaluations.detail.badge.critical'), bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

              if (overallMetrics.completeness !== undefined) {
                const v = overallMetrics.completeness;
                const nullCols = Object.values(columnMetrics).filter((col: any) => (col.n_nulls || 0) > 0).length;
                const totalCols = Object.keys(columnMetrics).length;
                metricCards.push({
                  title: t('evaluations.detail.metricName.completeness'),
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: badge(v >= 0.98, v >= 0.90),
                  insight: nullCols > 0
                    ? t('evaluations.detail.insight.completeness.partial', { count: nullCols, total: totalCols })
                    : t('evaluations.detail.insight.completeness.allComplete'),
                  tabKey: 'completeness',
                });
              }

              if (overallMetrics.uniqueness !== undefined) {
                const v = overallMetrics.uniqueness;
                const totalRows = Object.values(columnMetrics).length > 0
                  ? (columnMetrics[Object.keys(columnMetrics)[0]]?.n_nulls || 0) + (columnMetrics[Object.keys(columnMetrics)[0]]?.n_non_nulls || 0)
                  : 0;
                const dupes = totalRows > 0 ? Math.round((1 - v) * totalRows) : 0;
                metricCards.push({
                  title: t('evaluations.detail.metricName.uniqueness'),
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: badge(dupes === 0, dupes <= 2),
                  insight: dupes > 0
                    ? t('evaluations.detail.insight.uniqueness.duplicates', { count: dupes })
                    : t('evaluations.detail.insight.uniqueness.noDuplicates'),
                  tabKey: 'uniqueness',
                });
              }

              if (overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0) {
                const totalOut = Object.values(overallMetrics.outliers).reduce((s: number, c: any) => s + (c?.count || 0), 0);
                const totalVals = Object.values(overallMetrics.outliers).reduce((s: number, c: any) => s + (c?.total_values || 0), 0);
                const prop = totalVals > 0 ? totalOut / totalVals : 0;
                const colsAffected = Object.entries(overallMetrics.outliers).filter(([_, c]: [string, any]) => c?.count > 0).length;
                const mostAffected = Object.entries(overallMetrics.outliers)
                  .filter(([_, c]: [string, any]) => c?.count > 0)
                  .sort(([_, a]: [string, any], [__, b]: [string, any]) => (b?.count || 0) - (a?.count || 0))[0];
                metricCards.push({
                  title: t('evaluations.detail.metricName.outliers'),
                  value: `${totalOut}`,
                  badge: prop >= 0.05 ? { label: t('evaluations.detail.badge.critical'), bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' }
                       : prop >= 0.02 ? { label: t('evaluations.detail.badge.needsAttention'), bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
                       : totalOut === 0 ? { label: t('evaluations.detail.badge.excellent'), bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
                       : { label: t('evaluations.detail.badge.acceptable'), bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' },
                  insight: totalOut === 0 ? t('evaluations.detail.insight.outliers.none')
                         : colsAffected === 1 && mostAffected
                           ? t('evaluations.detail.insight.outliers.oneCol', { count: colsAffected, col: mostAffected[0], pct: (prop * 100).toFixed(1) })
                           : t('evaluations.detail.insight.outliers.multiCol', { count: colsAffected, pct: (prop * 100).toFixed(1) }),
                  tabKey: 'outliers',
                });
              }

              if (overallMetrics.syntactic_accuracy?.columns) {
                const sa = overallMetrics.syntactic_accuracy;
                const v = sa.overall_conformance ?? 0;
                metricCards.push({
                  title: t('evaluations.detail.metricName.syntacticAccuracy'),
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: badge(v >= 0.95, v >= 0.80),
                  insight: sa.columns_checked
                    ? t('evaluations.detail.insight.syntacticAccuracy.columns', { count: sa.columns_checked })
                    : t('evaluations.detail.insight.syntacticAccuracy.none'),
                  tabKey: 'syntactic_accuracy',
                });
              }

              if (overallMetrics.logical_consistency?.rules) {
                const lc = overallMetrics.logical_consistency;
                const v = lc.overall_compliance ?? 0;
                const withViol = lc.rules_with_violations ?? 0;
                const total = lc.rules_evaluated ?? (lc.rules?.length ?? 0);
                metricCards.push({
                  title: t('evaluations.detail.metricName.logicalConsistency'),
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: badge(withViol === 0, withViol <= 1),
                  insight: withViol === 0
                    ? t('evaluations.detail.insight.logicalConsistency.noViolations', { count: total })
                    : t('evaluations.detail.insight.logicalConsistency.violations', { count: withViol, total }),
                  tabKey: 'logical_consistency',
                });
              }

              if (overallMetrics.class_balance?.columns) {
                const cb = overallMetrics.class_balance;
                const v = cb.overall_balance_index ?? 0;
                const alerts = cb.columns_with_alerts ?? 0;
                metricCards.push({
                  title: t('evaluations.detail.metricName.classBalance'),
                  value: `${v.toFixed(1)}%`,
                  badge: badge(v >= 80, v >= 60),
                  insight: alerts === 0
                    ? t('evaluations.detail.insight.classBalance.noAlerts')
                    : t('evaluations.detail.insight.classBalance.alerts', { count: alerts }),
                  tabKey: 'class_balance',
                });
              }

              if (overallMetrics.currentness?.columns) {
                const tl = overallMetrics.currentness;
                const v = tl.overall_freshness_score ?? 0;
                const stale = tl.columns_stale ?? 0;
                const analyzed = tl.columns_analyzed ?? 0;
                metricCards.push({
                  title: t('evaluations.detail.metricName.currentness'),
                  value: `${(v * 100).toFixed(1)}%`,
                  badge: badge(v >= 0.90, v >= 0.70),
                  insight: stale === 0
                    ? t('evaluations.detail.insight.currentness.upToDate', { count: analyzed })
                    : t('evaluations.detail.insight.currentness.stale', { count: stale, total: analyzed }),
                  tabKey: 'currentness',
                });
              }

              // Tab order in MetricDetailsTabs: completeness, uniqueness, outliers, syntactic_accuracy, logical_consistency, class_balance, currentness
              const tabOrder = ['completeness', 'uniqueness', 'outliers', 'syntactic_accuracy', 'logical_consistency', 'class_balance', 'currentness'];
              const availableTabs = tabOrder.filter(key => {
                if (key === 'completeness') return overallMetrics.completeness !== undefined;
                if (key === 'uniqueness') return overallMetrics.uniqueness !== undefined;
                if (key === 'outliers') return overallMetrics.outliers && Object.keys(overallMetrics.outliers).length > 0;
                if (key === 'syntactic_accuracy') return overallMetrics.syntactic_accuracy?.columns;
                if (key === 'logical_consistency') return overallMetrics.logical_consistency?.rules;
                if (key === 'class_balance') return overallMetrics.class_balance?.columns;
                if (key === 'currentness') return overallMetrics.currentness?.columns;
                return false;
              });

              const scrollToTab = (tabKey: string) => {
                const idx = availableTabs.indexOf(tabKey);
                if (idx >= 0) setActiveDetailTab(idx);
                // Expand the accordion if collapsed, then scroll after DOM updates
                if (!detailsExpanded) {
                  setDetailsExpanded(true);
                  setTimeout(() => {
                    document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 300);
                } else {
                  document.getElementById('metric-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              };

              const score = run.quality_score || overallMetrics.quality_score || 0;
              const scoreColor = score >= 80 ? '#00B37E' : score >= 60 ? '#FFB800' : '#E5484D';
              const scoreColorBg = score >= 80 ? 'rgba(0, 179, 126, 0.1)' : score >= 60 ? 'rgba(255, 184, 0, 0.1)' : 'rgba(229, 72, 77, 0.1)';
              const scoreVerdict = score >= 90 ? t('evaluations.detail.scoreVerdict.excellent') : score >= 80 ? t('evaluations.detail.scoreVerdict.good') : score >= 60 ? t('evaluations.detail.scoreVerdict.acceptable') : score >= 40 ? t('evaluations.detail.scoreVerdict.poor') : t('evaluations.detail.scoreVerdict.critical');
              const metricsEvaluated = metricCards.length;
              const totalIssues = issues.length;

              const accordionSx = {
                mb: 3,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
              };

              return (
                <Box id="executive-summary" sx={{ scrollMarginTop: '120px' }}>
                  {/* ── Puntuación de calidad ── */}
                  <Paper elevation={0} sx={{ mb: 3, border: '1px solid #E0E0E0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SpeedIcon sx={{ color: '#888', fontSize: 20 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('evaluations.detail.score')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={scoreVerdict}
                          size="small"
                          sx={{ backgroundColor: scoreColorBg, color: scoreColor, fontWeight: 600, fontSize: '0.75rem' }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => setScoreExpanded(v => !v)}
                          sx={{ color: '#888' }}
                        >
                          <ExpandMoreIcon sx={{ transition: 'transform 0.2s', transform: scoreExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </IconButton>
                      </Box>
                    </Box>

                    <Collapse in={scoreExpanded}>
                      <Box sx={{ px: 3, pb: 3 }}>
                        {/* Quality Gate status banner */}
                        {run.quality_gate_status && (() => {
                          const passed = run.quality_gate_status === 'PASSED';
                          const warned = run.quality_gate_status === 'WARNING';
                          const gateColor = passed ? '#00B37E' : warned ? '#FFB800' : '#E5484D';
                          const gateBg = passed ? 'rgba(0,179,126,0.08)' : warned ? 'rgba(255,184,0,0.08)' : 'rgba(229,72,77,0.08)';
                          const gateBorder = passed ? 'rgba(0,179,126,0.25)' : warned ? 'rgba(255,184,0,0.25)' : 'rgba(229,72,77,0.25)';
                          const GateIcon = passed ? CheckCircleIcon : warned ? WarningIcon : CancelIcon;
                          const gateTitle = passed ? t('evaluations.detail.gate.passedTitle') : warned ? t('evaluations.detail.gate.warningTitle') : t('evaluations.detail.gate.failedTitle');
                          const gateDesc = passed
                            ? t('evaluations.detail.gate.passedDesc')
                            : warned
                            ? t('evaluations.detail.gate.warningDesc')
                            : qgThreshold !== null
                            ? t('evaluations.detail.gate.failedDescThreshold', { score: Math.round(score), threshold: qgThreshold })
                            : t('evaluations.detail.gate.failedDesc', { score: Math.round(score) });
                          return (
                            <Box sx={{ mb: 3, p: 2, borderRadius: 2, backgroundColor: gateBg, border: `1px solid ${gateBorder}`, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                              <GateIcon sx={{ color: gateColor, fontSize: 28, mt: 0.25, flexShrink: 0 }} />
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: gateColor, lineHeight: 1.3 }}>
                                  {gateTitle}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#666', mt: 0.4 }}>
                                  {gateDesc}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })()}

                        {/* Score numérico */}
                        <Typography variant="h2" component="div" sx={{ fontWeight: 800, color: scoreColor, lineHeight: 1, mb: 2 }}>
                          {Math.round(score)}
                          <Typography component="span" variant="h5" sx={{ color: '#BBBBBB', fontWeight: 400, ml: 0.5 }}>/100</Typography>
                        </Typography>

                        {/* Barra de progreso */}
                        <LinearProgress
                          variant="determinate"
                          value={score}
                          sx={{
                            height: 10,
                            borderRadius: 5,
                            mb: 2.5,
                            backgroundColor: '#EEEEEE',
                            '& .MuiLinearProgress-bar': { borderRadius: 5, backgroundColor: scoreColor },
                          }}
                        />

                        {/* Stats */}
                        <Typography variant="body2" sx={{ color: '#888' }}>
                          {t('evaluations.detail.metricsEvaluated', { count: metricsEvaluated })}
                          {' · '}
                          <Box component="span" sx={{ color: totalIssues > 0 ? '#E5484D' : '#00B37E', fontWeight: 600 }}>
                            {t('evaluations.detail.issuesCount', { count: totalIssues })}
                          </Box>
                        </Typography>
                      </Box>
                    </Collapse>
                  </Paper>

                  {/* ── Resumen de métricas ── */}
                  {metricCards.length > 0 && (
                    <Accordion elevation={0} defaultExpanded={true} sx={{ ...accordionSx, mb: 4 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <GridViewIcon sx={{ color: '#888', fontSize: 20 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {t('evaluations.detail.sections.metricSummary')}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 3, pb: 3 }}>
                        <Grid container spacing={2}>
                          {metricCards.map((card) => (
                            <ExecutiveMetricCard
                              key={card.tabKey}
                              title={card.title}
                              value={card.value}
                              badge={card.badge}
                              insight={card.insight}
                              onClickDetail={() => scrollToTab(card.tabKey)}
                            />
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              );
            })()}

            {/* Issues detectados - Collapsible */}
            <Accordion
              id="priority-issues"
              elevation={0}
              defaultExpanded={true}
              sx={{
                mb: 3,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
                scrollMarginTop: '80px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon sx={{ color: '#888', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('evaluations.detail.sections.detectedIssues', { count: issuesLoading ? '…' : issues.length })}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
              {issuesLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : issues.length > 0 ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <IssuesSummary
                      issues={issues}
                      onFilterChange={(severity) => setSelectedSeverity(severity)}
                      selectedSeverity={selectedSeverity}
                      onMetricFilterChange={(metric) => setSelectedMetric(metric)}
                      selectedMetric={selectedMetric}
                      getMetricName={getMetricName}
                    />
                  </Box>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>{t('evaluations.issues.columns.severity')}</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>{t('evaluations.issues.columns.metric')}</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>{t('evaluations.issues.columns.description')}</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>{t('evaluations.issues.columns.affectedColumns')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredIssues.map((issue) => {
                          const getSeverityLabel = (severity: string): string =>
                            t(`evaluations.detail.severityLabel.${severity}`, { defaultValue: severity });

                          return (
                            <TableRow key={issue.id} hover>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={getSeverityLabel(issue.severity)}
                                  sx={{
                                    backgroundColor:
                                      issue.severity === 'critical'
                                        ? 'rgba(139, 0, 0, 0.1)'
                                        : issue.severity === 'high'
                                        ? 'rgba(229, 72, 77, 0.1)'
                                        : issue.severity === 'medium'
                                        ? 'rgba(255, 184, 0, 0.1)'
                                        : 'rgba(0, 179, 126, 0.1)',
                                    color:
                                      issue.severity === 'critical'
                                        ? '#8B0000'
                                        : issue.severity === 'high'
                                        ? '#E5484D'
                                        : issue.severity === 'medium'
                                        ? '#FFB800'
                                        : '#00B37E',
                                    fontWeight: 500,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontWeight: 500, color: '#555' }}>
                                  {getMetricName(issue)}
                                </Typography>
                              </TableCell>
                              <TableCell>{issue.description}</TableCell>
                              <TableCell>
                                {issue.affected_columns && issue.affected_columns.length > 0
                                  ? issue.affected_columns.map((col: any) => {
                                      if (typeof col === 'string') return col;
                                      if (col.column) return col.column;
                                      if (col.name) return col.name;
                                      return JSON.stringify(col);
                                    }).join(', ')
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #CCCCCC', borderRadius: 2 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: '#00B37E', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: '#555555' }}>
                    {t('evaluations.detail.noIssuesDetected')}
                  </Typography>
                </Box>
              )}
              </AccordionDetails>
            </Accordion>
            {/* end issues accordion */}

            {/* Detalles de métricas - Collapsible Tabs */}
            <Accordion
              id="metric-details"
              elevation={0}
              expanded={detailsExpanded}
              onChange={(_, expanded) => setDetailsExpanded(expanded)}
              sx={{
                mb: 3,
                border: '1px solid #E0E0E0',
                borderRadius: '8px !important',
                backgroundColor: '#FFFFFF',
                '&:before': { display: 'none' },
                scrollMarginTop: '80px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon sx={{ color: '#888', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('evaluations.detail.metricDetails')}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <MetricDetailsTabs
                  overallMetrics={overallMetrics}
                  columnMetrics={columnMetrics}
                  initialTab={activeDetailTab}
                  datasetId={run.dataset_id}
                />
              </AccordionDetails>
            </Accordion>

            {/* Column Metrics Section - Hidden temporarily */}
            {false && Object.keys(columnMetrics).length > 0 && (
              <Paper id="column-metrics" elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #EEEEEE', borderRadius: 2, scrollMarginTop: '80px' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {t('evaluations.detail.columnMetrics', { count: Object.keys(columnMetrics).length })}
                </Typography>
                <ColumnMetricsTable columnMetrics={columnMetrics} />
              </Paper>
            )}

            {/* Cálculo de puntuación - Collapsed by default */}
            {overallMetrics.score_breakdown && (
              <Accordion
                elevation={0}
                defaultExpanded={false}
                sx={{
                  mb: 3,
                  border: '1px solid #E0E0E0',
                  borderRadius: '8px !important',
                  backgroundColor: '#FFFFFF',
                  '&:before': { display: 'none' },
                  scrollMarginTop: '80px',
                }}
                id="score-calculation"
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#888', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {t('evaluations.detail.sections.scoreCalculation')}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Typography variant="body2" sx={{ color: '#555555', mb: 3 }}>
                  {t('evaluations.detail.scoreCalculationDescription')}
                </Typography>

                {/* Step 1: Issue Penalty */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#333' }}>
                    {t('evaluations.detail.scoreCalculationSteps.penaltyByIssues')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
                    {t('evaluations.detail.scoreCalculationSteps.penaltyDescription')}
                  </Typography>
                  {(() => {
                    const ic = overallMetrics.score_breakdown.issue_counts || {};
                    const pw = overallMetrics.score_breakdown.penalty_weights || { critical: 0.12, high: 0.05, medium: 0.01, low: 0.003 };
                    const rawPenalty = overallMetrics.score_breakdown.raw_penalty ?? 0;
                    const COLORS: Record<string, { bg: string; color: string }> = {
                      critical: { bg: 'rgba(139,0,0,0.1)', color: '#8B0000' },
                      high:     { bg: 'rgba(229,72,77,0.1)', color: '#E5484D' },
                      medium:   { bg: 'rgba(255,184,0,0.1)', color: '#B8860B' },
                      low:      { bg: 'rgba(0,179,126,0.1)', color: '#00B37E' },
                    };
                    const LABEL: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' };
                    const order = ['critical', 'high', 'medium', 'low'];
                    const total = order.reduce((acc, s) => acc + (ic[s] || 0), 0);
                    if (total === 0) {
                      return <Typography variant="body2" sx={{ color: '#00B37E' }}>{t('evaluations.detail.scoreCalculationSteps.noIssuesPenalty')}</Typography>;
                    }
                    return (
                      <Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
                          {order.map(sev => {
                            const cnt = ic[sev] || 0;
                            if (cnt === 0) return null;
                            const c = COLORS[sev];
                            const contrib = cnt * (pw[sev] || 0);
                            return (
                              <Chip key={sev} size="small"
                                label={`${cnt} ${LABEL[sev]}${cnt > 1 ? 's' : ''} × −${((pw[sev] || 0) * 100).toFixed(1)}% = −${(contrib * 100).toFixed(1)}%`}
                                sx={{ backgroundColor: c.bg, color: c.color, fontWeight: 500 }}
                              />
                            );
                          })}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#888' }}>
                          {t('evaluations.detail.scoreCalculationSteps.rawPenalty', { value: (rawPenalty * 100).toFixed(1) })}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 2: Dimensionality normalisation */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#333' }}>
                    {t('evaluations.detail.scoreCalculationSteps.normalization')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
                    {t('evaluations.detail.scoreCalculationSteps.normalizationDescription')}
                  </Typography>
                  {(() => {
                    const numCols = overallMetrics.score_breakdown.num_columns ?? 0;
                    const scale   = overallMetrics.score_breakdown.column_scale ?? 1;
                    const raw     = overallMetrics.score_breakdown.raw_penalty ?? 0;
                    const adj     = overallMetrics.score_breakdown.issue_penalty ?? 0;
                    const capped  = adj >= 0.97 - 0.001;
                    return (
                      <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#444' }}>
                        <Box>√({numCols} cols / 10) = <strong>{scale.toFixed(3)}</strong></Box>
                        <Box sx={{ mt: 0.5 }}>
                          {(raw * 100).toFixed(1)}% / {scale.toFixed(3)} = <strong>{(adj * 100).toFixed(1)}%</strong>
                          {capped && <Box component="span" sx={{ color: '#888', ml: 1 }}>{t('evaluations.detail.scoreCalculationSteps.capped')}</Box>}
                        </Box>
                      </Box>
                    );
                  })()}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step 3: Final Score */}
                {(() => {
                  const finalScore = overallMetrics.score_breakdown.final_score ?? 0;
                  const penalty    = overallMetrics.score_breakdown.issue_penalty ?? 0;
                  return (
                    <Box sx={{
                      p: 2, borderRadius: 2, mb: 3,
                      backgroundColor: finalScore >= 0.8 ? 'rgba(0, 179, 126, 0.05)' :
                                       finalScore >= 0.5 ? 'rgba(255, 184, 0, 0.05)' : 'rgba(229, 72, 77, 0.05)',
                      border: '1px solid',
                      borderColor: finalScore >= 0.8 ? 'rgba(0, 179, 126, 0.2)' :
                                   finalScore >= 0.5 ? 'rgba(255, 184, 0, 0.2)' : 'rgba(229, 72, 77, 0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                        3. {t('evaluations.detail.finalScore')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        100% − {(penalty * 100).toFixed(1)}% ={' '}
                        <Box component="span" sx={{
                          fontSize: '1.2rem',
                          color: finalScore >= 0.8 ? '#00B37E' : finalScore >= 0.5 ? '#FFB800' : '#E5484D',
                        }}>
                          {(finalScore * 100).toFixed(1)}%
                        </Box>
                      </Typography>
                    </Box>
                  );
                })()}

                <Divider sx={{ mb: 3 }} />

                {/* Diagnostic: metric scores */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#333' }}>
                    {t('evaluations.detail.scoreCalculationSteps.diagnosticByDimension')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
                    {t('evaluations.detail.scoreCalculationSteps.diagnosticDescription')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {Object.entries(overallMetrics.score_breakdown.metric_scores || {}).map(([metric, score]: [string, any]) => {
                      const pct = (score * 100).toFixed(1);
                      const color = score >= 0.8 ? '#00B37E' : score >= 0.6 ? '#FFB800' : '#E5484D';
                      const weight = overallMetrics.score_breakdown.metric_weights?.[metric];
                      return (
                        <Paper key={metric} elevation={0} sx={{ px: 2, py: 1.5, border: '1px solid #EEEEEE', borderRadius: 2, minWidth: 140, backgroundColor: '#fafafa' }}>
                          <Typography variant="caption" sx={{ color: '#888', textTransform: 'capitalize' }}>
                            {metric}
                            {weight !== undefined && weight !== 1 && (
                              <Box component="span" sx={{ color: '#bbb', ml: 0.5 }}>×{weight}</Box>
                            )}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                            {pct}%
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Box>
                  {overallMetrics.score_breakdown.diagnostic_base_score !== undefined && (
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#aaa' }}>
                      {t('evaluations.detail.scoreCalculationSteps.weightedAverage', { value: ((overallMetrics.score_breakdown.diagnostic_base_score ?? 0) * 100).toFixed(1) })}
                    </Typography>
                  )}
                </Box>
                </AccordionDetails>
              </Accordion>
            )}

        </>
      </Box>
    </MainLayout>
  );
};

export default EvaluationDetail;
