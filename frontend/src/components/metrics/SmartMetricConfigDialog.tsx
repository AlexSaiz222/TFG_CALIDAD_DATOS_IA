/**
 * SmartMetricConfigDialog
 * Metric-specific configuration dialogs with user-friendly UX for all 6 metrics.
 * Replaces the generic parameter dialog with guided, plain-language controls.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Slider, Chip, Divider,
  FormControlLabel, Switch, Radio, RadioGroup, FormControl,
  TextField, IconButton, Tooltip, Collapse, Alert,
  ToggleButton, ToggleButtonGroup, Paper, List, ListItem,
  ListItemText, ListItemSecondaryAction, useMediaQuery, useTheme, Tab, Tabs,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  AutoFixHigh as AutoIcon,
  AddCircleOutline as AddRuleIcon,
  Bolt as BoltIcon,
  Code as CodeIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import LogicalConsistencyRuleEditor, { LogicalRule } from './LogicalConsistencyRuleEditor';
import { getIconMeta } from './MetricIcon';
import JsonParameterEditor from './JsonParameterEditor';
import ColumnPicker from './columnPicker/ColumnPicker';
import DatasetSelector from './columnPicker/DatasetSelector';
import ColumnPatternMatrix, { ColumnRule } from './columnPicker/ColumnPatternMatrix';
import PatternEditor from './columnPicker/PatternEditor';
import { datasetsAPI, patternsAPI } from '../../services/api';
import { DatasetColumnLite, ValidationPattern } from '../../types';

const GREEN = '#00B37E';
const GREEN_LIGHT = '#F0F9F6';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

interface SectionBannerProps {
  metricName: string;
  title: string;
  description: string;
  autoDetect?: boolean;
}
const SectionBanner: React.FC<SectionBannerProps> = ({ metricName, title, description, autoDetect }) => {
  const { t } = useTranslation();
  const meta = getIconMeta(metricName);
  const IconComp = meta.icon;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: meta.bg, flexShrink: 0,
        }}>
          <IconComp size={20} color={meta.color} strokeWidth={1.8} />
        </div>
        <Typography variant="h6" fontWeight={600}>{title}</Typography>
      </div>
      <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>{description}</Typography>
      {autoDetect && (
        <Box display="flex" alignItems="center" gap={0.5} mt={1}
          sx={{ px: 1.5, py: 0.5, bgcolor: GREEN_LIGHT, borderRadius: 1, width: 'fit-content' }}>
          <AutoIcon sx={{ fontSize: 16, color: GREEN }} />
          <Typography variant="caption" fontWeight={500} color={GREEN}>
            {t('metricConfig.smartDialog.autoWorks')}
          </Typography>
        </Box>
      )}
    </div>
  );
};

interface ThresholdSliderProps {
  label: string;
  value: number;          // 0–1
  onChange: (v: number) => void;
  presets?: number[];
  helpText?: string;
  invert?: boolean;       // true = lower is better (outlier direction)
}
const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
  label, value, onChange, presets = [0.80, 0.90, 0.95, 0.99], helpText, invert,
}) => {
  const pct = Math.round(value * 100);
  const color = invert
    ? (value <= 0.05 ? GREEN : value <= 0.10 ? '#FFB800' : '#E5484D')
    : (value >= 0.95 ? GREEN : value >= 0.80 ? '#FFB800' : '#E5484D');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color}>{pct}%</Typography>
      </div>
      <Slider
        value={value}
        onChange={(_, v) => onChange(v as number)}
        min={0.5} max={1.0} step={0.01}
        sx={{ color: GREEN }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {presets.map(p => (
          <Chip
            key={p}
            label={`${Math.round(p * 100)}%`}
            size="small"
            onClick={() => onChange(p)}
            variant={value === p ? 'filled' : 'outlined'}
            sx={value === p
              ? { bgcolor: GREEN, color: '#fff', fontWeight: 600 }
              : { cursor: 'pointer' }}
          />
        ))}
      </div>
      {helpText && <Typography variant="caption" color="text.secondary" mt={0.5} display="block">{helpText}</Typography>}
    </div>
  );
};

interface AdvancedSectionProps { children: React.ReactNode; initialOpen?: boolean; }
const AdvancedSection: React.FC<AdvancedSectionProps> = ({ children, initialOpen = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initialOpen);
  return (
    // @ts-ignore — TS2590: MUI Box type inference too complex when lucide-react types are in scope
    <Box mt={2}>
      <Divider />
      <Box mt={1.5}>
        <Button
          size="small"
          endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setOpen(!open)}
          sx={{ color: 'text.secondary', textTransform: 'none', px: 0 }}
        >
          {t('metricConfig.smartDialog.advancedOptions')}
        </Button>
        <Collapse in={open}>
          <Box mt={1.5}>{children}</Box>
        </Collapse>
      </Box>
    </Box>
  );
};

// Simple tag-input for column lists
interface ColumnTagInputProps {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  helpText?: string;
}
const ColumnTagInput: React.FC<ColumnTagInputProps> = ({ label, value, onChange, helpText }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };

  // Ensure value is always an array of strings (filter out any objects that might come from JSON sync)
  const safeValue = (value || []).filter((v: any) => typeof v === 'string') as string[];

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{label}</Typography>
      <Box display="flex" gap={1} mb={1}>
        <TextField
          size="small" fullWidth
          value={input}
          placeholder={t('metricConfig.smartDialog.columnPlaceholder')}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button size="small" variant="outlined" onClick={add}
          sx={{ borderColor: GREEN, color: GREEN, minWidth: 48 }}>{t('metricConfig.smartDialog.addButton')}</Button>
      </Box>
      <Box display="flex" flexWrap="wrap" gap={0.5}>
        {safeValue.map(col => (
          <Chip key={col} label={col} size="small" onDelete={() => onChange(safeValue.filter(c => c !== col))} />
        ))}
        {safeValue.length === 0 && (
          <Typography variant="caption" color="text.disabled">
            {helpText || t('metricConfig.smartDialog.emptyColumns')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Metric-specific config panels
// ─────────────────────────────────────────────────────────────────────────────

// ---------- COMPLETENESS ----------
const CompletenessConfig: React.FC<{ params: any; onChange: (p: any) => void; loadedColumns: DatasetColumnLite[]; columnsLoading: boolean; missingColumns: string[] }> = ({ params, onChange, loadedColumns, columnsLoading, missingColumns }) => {
  const { t } = useTranslation();
  const threshold = params.threshold ?? 0.95;
  const columns: string[] = (params.columns ?? []).filter((c: any) => typeof c === 'string');

  React.useEffect(() => {
    const needsUpdate = params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ threshold: params.threshold ?? 0.95, columns: params.columns ?? [], ...params });
    }
  }, []);

  return (
    <Box>
      <SectionBanner
        metricName="completeness"
        title={t('metricConfig.smartDialog.completeness.title')}
        description={t('metricConfig.smartDialog.completeness.description')}
        autoDetect
      />
      <ThresholdSlider
        label={t('metricConfig.smartDialog.completeness.thresholdLabel')}
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.80, 0.90, 0.95, 0.99]}
        helpText={t('metricConfig.smartDialog.completeness.thresholdHelp')}
      />
      <AdvancedSection>
        <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.completeness.columnsLabel')}</Typography>
        {loadedColumns.length > 0 || columnsLoading ? (
          <ColumnPicker
            columns={loadedColumns}
            selectedColumns={columns}
            onChange={v => onChange({ ...params, columns: v })}
            missingColumns={missingColumns}
            loading={columnsLoading}
          />
        ) : (
          <ColumnTagInput
            label=""
            value={columns}
            onChange={v => onChange({ ...params, columns: v })}
          />
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- UNIQUENESS ----------
const UniquenessConfig: React.FC<{ params: any; onChange: (p: any) => void; loadedColumns: DatasetColumnLite[]; columnsLoading: boolean; missingColumns: string[] }> = ({ params, onChange, loadedColumns, columnsLoading, missingColumns }) => {
  const { t } = useTranslation();
  const threshold = params.threshold ?? 1.0;
  const columns: string[] = (params.columns ?? []).filter((c: any) => typeof c === 'string');

  React.useEffect(() => {
    const needsUpdate = params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ threshold: params.threshold ?? 1.0, columns: params.columns ?? [], ...params });
    }
  }, []);

  return (
    <Box>
      <SectionBanner
        metricName="uniqueness"
        title={t('metricConfig.smartDialog.uniqueness.title')}
        description={t('metricConfig.smartDialog.uniqueness.description')}
        autoDetect
      />
      <ThresholdSlider
        label={t('metricConfig.smartDialog.uniqueness.thresholdLabel')}
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.90, 0.95, 0.99, 1.0]}
        helpText={t('metricConfig.smartDialog.uniqueness.thresholdHelp')}
      />
      <AdvancedSection>
        <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.uniqueness.columnsLabel')}</Typography>
        {loadedColumns.length > 0 || columnsLoading ? (
          <ColumnPicker
            columns={loadedColumns}
            selectedColumns={columns}
            onChange={v => onChange({ ...params, columns: v })}
            missingColumns={missingColumns}
            loading={columnsLoading}
          />
        ) : (
          <ColumnTagInput
            label=""
            value={columns}
            onChange={v => onChange({ ...params, columns: v })}
            helpText={t('metricConfig.smartDialog.uniqueness.columnsEmpty')}
          />
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- SYNTACTIC ACCURACY ----------
const SyntacticAccuracyConfig: React.FC<{
  params: any; onChange: (p: any) => void;
  loadedColumns: DatasetColumnLite[]; columnsLoading: boolean; missingColumns: string[];
  allPatterns: ValidationPattern[]; onPatternCreated: (p: ValidationPattern) => void;
}> = ({ params, onChange, loadedColumns, columnsLoading, missingColumns, allPatterns, onPatternCreated }) => {
  const { t } = useTranslation();
  const autoDetect = params.auto_detect_types !== false;
  const threshold = params.threshold ?? 0.95;
  const columnRules: ColumnRule[] = (params.columns ?? []).filter((c: any) => typeof c === 'object' && c?.column);
  const selectedColumns = columnRules.map(r => r.column);

  React.useEffect(() => {
    const needsUpdate = params.auto_detect_types === undefined || params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ auto_detect_types: params.auto_detect_types !== false, threshold: params.threshold ?? 0.95, columns: params.columns ?? [], ...params });
    }
  }, []);

  const handleColumnSelection = (cols: string[]) => {
    const ruleMap = new Map(columnRules.map(r => [r.column, r]));
    const firstPatternKey = allPatterns.find(p => p.is_system)?.key ?? 'email';
    const newRules: ColumnRule[] = cols.map(col => ruleMap.get(col) ?? { column: col, expected_type: firstPatternKey });
    onChange({ ...params, columns: newRules });
  };

  const handleMissingRemove = (cols: string[]) => {
    const updated = columnRules.filter(r => cols.includes(r.column) || loadedColumns.find(lc => lc.name === r.column));
    onChange({ ...params, columns: updated });
  };

  return (
    <Box>
      <SectionBanner
        metricName="syntactic_accuracy"
        title={t('metricConfig.smartDialog.syntacticAccuracy.title')}
        description={t('metricConfig.smartDialog.syntacticAccuracy.description')}
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect_types: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{t('metricConfig.smartDialog.syntacticAccuracy.autoDetectLabel')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('metricConfig.smartDialog.syntacticAccuracy.autoDetectCaption')}
              </Typography>
            </Box>
          }
        />
      </Paper>

      <ThresholdSlider
        label={t('metricConfig.smartDialog.syntacticAccuracy.thresholdLabel')}
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.80, 0.90, 0.95, 1.0]}
        helpText={t('metricConfig.smartDialog.syntacticAccuracy.thresholdHelp')}
      />

      <AdvancedSection initialOpen>
        <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.syntacticAccuracy.advancedTitle')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
          {t('metricConfig.smartDialog.syntacticAccuracy.advancedCaption')}
        </Typography>
        {loadedColumns.length > 0 || columnsLoading ? (
          <>
            <ColumnPicker
              columns={loadedColumns}
              selectedColumns={selectedColumns}
              onChange={handleColumnSelection}
              missingColumns={missingColumns}
              loading={columnsLoading}
            />
            {columnRules.length > 0 && (
              <Box mt={2}>
                <ColumnPatternMatrix
                  rules={columnRules}
                  allPatterns={allPatterns}
                  selectedColumns={selectedColumns}
                  onChange={rules => onChange({ ...params, columns: rules })}
                  onPatternCreated={onPatternCreated}
                />
              </Box>
            )}
          </>
        ) : (
          // Fallback to legacy input when no dataset loaded (network error)
          <Box>
            {columnRules.map((r, i) => (
              <Box key={i} display="flex" alignItems="center" gap={1} mb={0.5}>
                <Typography variant="body2"><strong>{r.column}</strong> → {r.expected_type}</Typography>
                <IconButton size="small" onClick={() => onChange({ ...params, columns: columnRules.filter((_, idx) => idx !== i) })}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- CLASS BALANCE ----------
const ClassBalanceConfig: React.FC<{ params: any; onChange: (p: any) => void; loadedColumns: DatasetColumnLite[]; columnsLoading: boolean; missingColumns: string[] }> = ({ params, onChange, loadedColumns, columnsLoading, missingColumns }) => {
  const { t } = useTranslation();
  const autoDetect = params.auto_detect !== false;
  const thresholdHigh = params.imbalance_threshold_high ?? 0.90;
  const thresholdLow = params.imbalance_threshold_low ?? 0.05;
  const columns: string[] = params.columns ?? [];

  React.useEffect(() => {
    const needsUpdate =
      params.auto_detect === undefined ||
      params.imbalance_threshold_high === undefined ||
      params.imbalance_threshold_low === undefined ||
      params.max_cardinality === undefined ||
      params.columns === undefined;

    if (needsUpdate) {
      onChange({
        auto_detect: params.auto_detect !== false,
        imbalance_threshold_high: params.imbalance_threshold_high ?? 0.90,
        imbalance_threshold_low: params.imbalance_threshold_low ?? 0.05,
        max_cardinality: params.max_cardinality ?? 50,
        columns: params.columns ?? [],
        ...params,
      });
    }
  }, []);

  return (
    <Box>
      <SectionBanner
        metricName="class_balance"
        title={t('metricConfig.smartDialog.classBalance.title')}
        description={t('metricConfig.smartDialog.classBalance.description')}
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{t('metricConfig.smartDialog.classBalance.autoDetectLabel')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('metricConfig.smartDialog.classBalance.autoDetectCaption')}
              </Typography>
            </Box>
          }
        />
      </Paper>

      <ThresholdSlider
        label={t('metricConfig.smartDialog.classBalance.thresholdHighLabel')}
        value={thresholdHigh}
        onChange={v => onChange({ ...params, imbalance_threshold_high: v })}
        presets={[0.70, 0.80, 0.90, 0.95]}
        helpText={t('metricConfig.smartDialog.classBalance.thresholdHighHelp')}
      />
      <ThresholdSlider
        label={t('metricConfig.smartDialog.classBalance.thresholdLowLabel')}
        value={thresholdLow}
        onChange={v => onChange({ ...params, imbalance_threshold_low: v })}
        presets={[0.01, 0.05, 0.10, 0.20]}
        helpText={t('metricConfig.smartDialog.classBalance.thresholdLowHelp')}
      />

      <AdvancedSection>
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.classBalance.maxCardinalityTitle')}</Typography>
          <ToggleButtonGroup exclusive size="small"
            value={String(params.max_cardinality ?? 50)}
            onChange={(_, v) => { if (v) onChange({ ...params, max_cardinality: Number(v) }); }}
            sx={{ flexWrap: 'wrap' }}>
            {[10, 20, 50, 100].map(n => (
              <ToggleButton key={n} value={String(n)} sx={{ fontSize: '0.8rem', '&.Mui-selected': { bgcolor: GREEN_LIGHT, color: GREEN, fontWeight: 600 } }}>
                {t('metricConfig.smartDialog.classBalance.valuesLabel', { count: n })}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.classBalance.columnsLabel')}</Typography>
        {loadedColumns.length > 0 || columnsLoading ? (
          <ColumnPicker
            columns={loadedColumns}
            selectedColumns={columns}
            onChange={v => onChange({ ...params, columns: v })}
            missingColumns={missingColumns}
            loading={columnsLoading}
          />
        ) : (
          <ColumnTagInput label="" value={columns} onChange={v => onChange({ ...params, columns: v })} />
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- currentness ----------
const STALENESS_PRESET_DAYS = [7, 30, 90, 180, 365];
const STALENESS_PRESET_KEYS = ['days7', 'days30', 'days90', 'months6', 'year1'];

const CurrentnessConfig: React.FC<{ params: any; onChange: (p: any) => void; loadedColumns: DatasetColumnLite[]; columnsLoading: boolean; missingColumns: string[] }> = ({ params, onChange, loadedColumns, columnsLoading, missingColumns }) => {
  const { t } = useTranslation();
  const autoDetect = params.auto_detect !== false;
  const staleness = params.staleness_threshold_days ?? 30;
  const columns: string[] = params.columns ?? [];
  const isCustom = !STALENESS_PRESET_DAYS.includes(staleness);

  // Ensure all default parameters are set (fix for default values not appearing in JSON)
  React.useEffect(() => {
    const needsUpdate =
      params.staleness_threshold_days === undefined ||
      params.auto_detect === undefined ||
      params.columns === undefined;

    if (needsUpdate) {
      onChange({
        auto_detect: params.auto_detect !== false,
        columns: params.columns ?? [],
        staleness_threshold_days: params.staleness_threshold_days ?? 30,
        ...params,
      });
    }
  }, []);

  return (
    <Box>
      <SectionBanner
        metricName="currentness"
        title={t('metricConfig.smartDialog.currentness.title')}
        description={t('metricConfig.smartDialog.currentness.description')}
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{t('metricConfig.smartDialog.currentness.autoDetectLabel')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('metricConfig.smartDialog.currentness.autoDetectCaption')}
              </Typography>
            </Box>
          }
        />
      </Paper>

      <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.currentness.stalenessTitle')}</Typography>
      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        {STALENESS_PRESET_DAYS.map((days, idx) => (
          <Chip
            key={days}
            label={t(`metricConfig.smartDialog.currentness.presets.${STALENESS_PRESET_KEYS[idx]}`)}
            onClick={() => onChange({ ...params, staleness_threshold_days: days })}
            variant={staleness === days ? 'filled' : 'outlined'}
            sx={staleness === days
              ? { bgcolor: GREEN, color: '#fff', fontWeight: 600, cursor: 'pointer' }
              : { cursor: 'pointer' }}
          />
        ))}
        <Chip
          label={t('metricConfig.smartDialog.currentness.customPreset')}
          variant={isCustom ? 'filled' : 'outlined'}
          sx={isCustom ? { bgcolor: GREEN, color: '#fff', fontWeight: 600 } : {}}
        />
      </Box>
      {isCustom && (
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <TextField
            size="small" type="number" label={t('metricConfig.smartDialog.currentness.daysLabel')}
            value={staleness}
            onChange={e => onChange({ ...params, staleness_threshold_days: Math.max(1, parseInt(e.target.value) || 30) })}
            sx={{ width: 120 }}
            inputProps={{ min: 1 }}
          />
          <Typography variant="body2" color="text.secondary">{t('metricConfig.smartDialog.currentness.daysAlertSuffix')}</Typography>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" mt={1} display="block">
        {t('metricConfig.smartDialog.currentness.stalenessCaption')}
      </Typography>

      <AdvancedSection>
        <Typography variant="subtitle2" gutterBottom>{t('metricConfig.smartDialog.currentness.columnsLabel')}</Typography>
        {loadedColumns.length > 0 || columnsLoading ? (
          <ColumnPicker
            columns={loadedColumns}
            selectedColumns={columns}
            onChange={v => onChange({ ...params, columns: v })}
            missingColumns={missingColumns}
            loading={columnsLoading}
          />
        ) : (
          <ColumnTagInput label="" value={columns} onChange={v => onChange({ ...params, columns: v })} helpText={t('metricConfig.smartDialog.currentness.columnsEmpty')} />
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- LOGICAL CONSISTENCY ----------
// Static rule template data (expressions/conditions don't change with language)
const RULE_TEMPLATES_DATA = [
  {
    categoryKey: 'values',
    rules: [
      { nameKey: 'noNegative', hintKey: 'noNegativeHint', type: 'violation' as const, expression: 'mi_columna < 0' },
      { nameKey: 'required', hintKey: 'requiredHint', type: 'violation' as const, expression: 'mi_columna != mi_columna' },
      { nameKey: 'range', hintKey: 'rangeHint', type: 'violation' as const, expression: 'mi_columna < 0 or mi_columna > 1000' },
    ],
  },
  {
    categoryKey: 'dates',
    rules: [
      { nameKey: 'dateOrder', hintKey: 'dateOrderHint', type: 'violation' as const, expression: 'fecha_fin < fecha_inicio' },
    ],
  },
  {
    categoryKey: 'ifThen',
    rules: [
      { nameKey: 'activeRequired', hintKey: 'activeRequiredHint', type: 'if_then' as const, condition: 'estado == "activo"', assertion: 'campo_requerido == campo_requerido' },
      { nameKey: 'qtyPrice', hintKey: 'qtyPriceHint', type: 'if_then' as const, condition: 'cantidad > 0', assertion: 'precio > 0' },
      { nameKey: 'paidAmount', hintKey: 'paidAmountHint', type: 'if_then' as const, condition: 'estado == "pagado"', assertion: 'importe > 0' },
    ],
  },
];

const LogicalConsistencyConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const { t } = useTranslation();
  const rules: LogicalRule[] = params.rules ?? [];
  const [templateOpen, setTemplateOpen] = useState(false);

  const addTemplateRule = (ruleData: typeof RULE_TEMPLATES_DATA[0]['rules'][0]) => {
    const name = t(`metricConfig.smartDialog.logicalConsistency.ruleTemplates.${ruleData.nameKey}`);
    const newRule: LogicalRule = ruleData.type === 'violation'
      ? { name, type: 'violation', expression: (ruleData as any).expression }
      : { name, type: 'if_then', condition: (ruleData as any).condition, assertion: (ruleData as any).assertion };
    onChange({ ...params, rules: [...rules, newRule] });
  };

  return (
    <Box>
      <SectionBanner
        metricName="logical_consistency"
        title={t('metricConfig.smartDialog.logicalConsistency.title')}
        description={t('metricConfig.smartDialog.logicalConsistency.description')}
      />

      {/* Rule templates (SonarQube-style) */}
      <Box mb={2}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <BoltIcon sx={{ fontSize: 18, color: '#FFB800' }} />
          <Typography variant="subtitle2">{t('metricConfig.smartDialog.logicalConsistency.templatesTitle')}</Typography>
          <Tooltip title={t('metricConfig.smartDialog.logicalConsistency.templatesHint')} arrow>
            <InfoIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>

        {RULE_TEMPLATES_DATA.map(group => (
          <Box key={group.categoryKey} mb={1.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              {t(`metricConfig.smartDialog.logicalConsistency.ruleTemplates.${group.categoryKey}`)}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.75}>
              {group.rules.map(rule => (
                <Tooltip key={rule.nameKey} title={t(`metricConfig.smartDialog.logicalConsistency.ruleTemplates.${rule.hintKey}`)} arrow placement="top">
                  <Chip
                    icon={<AddRuleIcon />}
                    label={t(`metricConfig.smartDialog.logicalConsistency.ruleTemplates.${rule.nameKey}`)}
                    size="small"
                    onClick={() => addTemplateRule(rule)}
                    variant="outlined"
                    sx={{ cursor: 'pointer', '&:hover': { borderColor: GREEN, color: GREEN, bgcolor: GREEN_LIGHT } }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Rule editor */}
      <Typography variant="subtitle2" gutterBottom>
        {t('metricConfig.smartDialog.logicalConsistency.rulesConfigured')}
        {rules.length > 0 && (
          <Chip label={rules.length} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem', bgcolor: GREEN_LIGHT, color: GREEN }} />
        )}
      </Typography>

      {rules.length === 0 && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.85rem' }}>
          {t('metricConfig.smartDialog.logicalConsistency.noRulesAlert')}
        </Alert>
      )}

      <LogicalConsistencyRuleEditor
        rules={rules}
        onChange={updatedRules => onChange({ ...params, rules: updatedRules })}
      />
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────────────

interface SmartMetricConfigDialogProps {
  open: boolean;
  onClose: () => void;
  metric: any | null;
  onSave: (updatedMetric: any) => void;
  projectId?: number | null;
}

const SmartMetricConfigDialog: React.FC<SmartMetricConfigDialogProps> = ({
  open, onClose, metric, onSave, projectId,
}) => {
  const { t } = useTranslation();
  const [params, setParams] = useState<Record<string, any>>({});
  const [jsonValid, setJsonValid] = useState(true);
  const [mobileTab, setMobileTab] = useState(0); // 0 = visual, 1 = JSON
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));

  // Dataset selector + column picker state
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [loadedColumns, setLoadedColumns] = useState<DatasetColumnLite[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [allPatterns, setAllPatterns] = useState<ValidationPattern[]>([]);
  const lastDatasetKey = projectId ? `metricConfig.lastDatasetId.${projectId}` : null;

  // Load patterns once per open
  useEffect(() => {
    if (!open) return;
    patternsAPI.list()
      .then((res: any) => setAllPatterns(res?.data?.patterns ?? []))
      .catch(() => {});
  }, [open]);

  // Restore last selected dataset from localStorage
  useEffect(() => {
    if (!open || !lastDatasetKey) return;
    try {
      const stored = localStorage.getItem(lastDatasetKey);
      if (stored) setSelectedDatasetId(Number(stored));
    } catch {}
  }, [open, lastDatasetKey]);

  // Load columns whenever selected dataset changes
  useEffect(() => {
    if (!selectedDatasetId) { setLoadedColumns([]); return; }
    setColumnsLoading(true);
    datasetsAPI.getDatasetColumns(selectedDatasetId)
      .then((res: any) => setLoadedColumns(res?.data?.columns ?? []))
      .catch(() => setLoadedColumns([]))
      .finally(() => setColumnsLoading(false));
  }, [selectedDatasetId]);

  // Persist dataset selection
  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    if (lastDatasetKey) {
      try { localStorage.setItem(lastDatasetKey, String(id)); } catch {}
    }
  };

  useEffect(() => {
    if (metric) {
      setParams({ ...(metric.parameters ?? {}) });
      setJsonValid(true);
      setMobileTab(0);
    }
  }, [metric]);

  const handleJsonValidation = useCallback((isValid: boolean) => {
    setJsonValid(isValid);
  }, []);

  if (!metric) return null;

  const handleSave = () => {
    onSave({ ...metric, parameters: params });
  };

  const showDatasetSelector = metric.name !== 'logical_consistency';

  // Compute missing columns (selected but not in loaded dataset)
  const getSelectedStringColumns = (): string[] => {
    const cols = params.columns ?? [];
    return cols.filter((c: any) => typeof c === 'string') as string[];
  };
  const getSelectedObjectColumns = (): string[] => {
    const cols = params.columns ?? [];
    return cols.filter((c: any) => typeof c === 'object' && c?.column).map((c: any) => c.column);
  };
  const missingStringCols = loadedColumns.length > 0
    ? getSelectedStringColumns().filter(c => !loadedColumns.find(lc => lc.name === c))
    : [];
  const missingObjectCols = loadedColumns.length > 0
    ? getSelectedObjectColumns().filter(c => !loadedColumns.find(lc => lc.name === c))
    : [];

  const renderContent = () => {
    switch (metric.name) {
      case 'completeness':
        return <CompletenessConfig params={params} onChange={setParams} loadedColumns={loadedColumns} columnsLoading={columnsLoading} missingColumns={missingStringCols} />;
      case 'uniqueness':
        return <UniquenessConfig params={params} onChange={setParams} loadedColumns={loadedColumns} columnsLoading={columnsLoading} missingColumns={missingStringCols} />;
      case 'syntactic_accuracy':
        return <SyntacticAccuracyConfig params={params} onChange={setParams} loadedColumns={loadedColumns} columnsLoading={columnsLoading} missingColumns={missingObjectCols} allPatterns={allPatterns} onPatternCreated={p => setAllPatterns(prev => [...prev, p])} />;
      case 'class_balance':
        return <ClassBalanceConfig params={params} onChange={setParams} loadedColumns={loadedColumns} columnsLoading={columnsLoading} missingColumns={missingStringCols} />;
      case 'currentness':
        return <CurrentnessConfig params={params} onChange={setParams} loadedColumns={loadedColumns} columnsLoading={columnsLoading} missingColumns={missingStringCols} />;
      case 'logical_consistency':
        return <LogicalConsistencyConfig params={params} onChange={setParams} />;
      default:
        return (
          <Alert severity="info">
            {t('metricConfig.smartDialog.noConfigNeeded')}
          </Alert>
        );
    }
  };

  const jsonEditor = (
    <JsonParameterEditor
      value={params}
      onChange={setParams}
      onValidationChange={handleJsonValidation}
      metricName={metric.name}
      height="100%"
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 2, height: isSmall ? '85vh' : '80vh', maxHeight: '85vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" fontWeight={600}>{t('metricConfig.smartDialog.title')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!jsonValid && (
            <Chip
              label={t('metricConfig.smartDialog.invalidJson')}
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />

      {/* Mobile: tabs to switch between visual and JSON */}
      {isSmall && (
        <Tabs
          value={mobileTab}
          onChange={(_, v) => setMobileTab(v)}
          sx={{
            minHeight: 40, flexShrink: 0,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.85rem' },
            '& .Mui-selected': { color: GREEN },
            '& .MuiTabs-indicator': { bgcolor: GREEN },
          }}
        >
          <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('metricConfig.smartDialog.visual')} />
          <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('metricConfig.smartDialog.json')} />
        </Tabs>
      )}

      {/* Content area */}
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        {isSmall ? (
          // Mobile: one panel at a time
          mobileTab === 0 ? (
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {showDatasetSelector && projectId && (
                <Box display="flex" alignItems="center" gap={1} mb={2} p={1.5} sx={{ bgcolor: '#F5F5F5', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {t('columnPicker.datasetSelectorLabel')}
                  </Typography>
                  <DatasetSelector
                    projectId={projectId}
                    value={selectedDatasetId}
                    onChange={handleDatasetChange}
                  />
                </Box>
              )}
              {renderContent()}
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {jsonEditor}
            </Box>
          )
        ) : (
          // Desktop: split-view
          <>
            {/* Left panel — visual form */}
            <Box sx={{
              flex: '0 0 70%', maxWidth: '70%', overflow: 'auto', p: 3,
              borderRight: '1px solid', borderColor: 'divider',
            }}>
              {showDatasetSelector && projectId && (
                <Box display="flex" alignItems="center" gap={1} mb={2.5} p={1.5} sx={{ bgcolor: '#F5F5F5', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {t('columnPicker.datasetSelectorLabel')}
                  </Typography>
                  <DatasetSelector
                    projectId={projectId}
                    value={selectedDatasetId}
                    onChange={handleDatasetChange}
                  />
                </Box>
              )}
              {renderContent()}
            </Box>
            {/* Right panel — JSON editor */}
            <Box sx={{
              flex: '0 0 30%', maxWidth: '30%', display: 'flex', flexDirection: 'column',
              minHeight: 0, bgcolor: '#FAFAFA',
            }}>
              {jsonEditor}
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2, flexShrink: 0 }}>
        <Button onClick={onClose} color="inherit">{t('metricConfig.smartDialog.cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={!jsonValid}
          sx={{ bgcolor: GREEN, color: '#FFFFFF', '&:hover': { bgcolor: '#00A070' }, '&.Mui-disabled': { bgcolor: '#E0E0E0' } }}>
          {t('metricConfig.smartDialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SmartMetricConfigDialog;
