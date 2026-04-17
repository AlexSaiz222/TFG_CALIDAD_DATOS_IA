/**
 * JsonParameterEditor
 * Monaco-based JSON editor for metric parameters with validation,
 * auto-format, and per-metric schema hints.
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Box, Typography, IconButton, Tooltip, Chip, Alert,
} from '@mui/material';
import {
  FormatAlignLeft as FormatIcon,
  ContentCopy as CopyIcon,
  Lightbulb as LightbulbIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const GREEN = '#00B37E';

// ─────────────────────────────────────────────────────────────────────────────
// Per-metric JSON examples (derived from docs/metricas)
// ─────────────────────────────────────────────────────────────────────────────

export const METRIC_PARAMETER_EXAMPLES: Record<string, { example: Record<string, any>; descriptionKey: string }> = {
  completeness: {
    example: {
      threshold: 0.95,
      columns: ['nombre', 'email', 'telefono'],
    },
    descriptionKey: 'jsonEditor.paramHints.completeness',
  },
  uniqueness: {
    example: {
      threshold: 1.0,
      columns: ['user_id', 'transaction_id'],
    },
    descriptionKey: 'jsonEditor.paramHints.uniqueness',
  },
  syntactic_accuracy: {
    example: {
      auto_detect_types: true,
      threshold: 0.95,
      columns: [
        { column: 'email', expected_type: 'email' },
        { column: 'telefono', expected_type: 'phone_es' },
      ],
    },
    descriptionKey: 'jsonEditor.paramHints.syntactic_accuracy',
  },
  class_balance: {
    example: {
      auto_detect: true,
      columns: ['estado', 'categoria'],
      max_cardinality: 50,
      imbalance_threshold_high: 0.90,
      imbalance_threshold_low: 0.05,
    },
    descriptionKey: 'jsonEditor.paramHints.class_balance',
  },
  currentness: {
    example: {
      auto_detect: true,
      columns: ['fecha_registro', 'fecha_actualizacion'],
      staleness_threshold_days: 30,
    },
    descriptionKey: 'jsonEditor.paramHints.currentness',
  },
  logical_consistency: {
    example: {
      rules: [
        {
          name: 'Fecha pago si pagado',
          type: 'if_then',
          condition: "estado == 'pagado'",
          assertion: 'fecha_pago == fecha_pago',
        },
        {
          name: 'Sin precios negativos',
          type: 'violation',
          expression: 'precio < 0',
        },
      ],
    },
    descriptionKey: 'jsonEditor.paramHints.logical_consistency',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface JsonParameterEditorProps {
  value: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  onValidationChange?: (isValid: boolean) => void;
  metricName?: string;
  height?: string | number;
}

const JsonParameterEditor: React.FC<JsonParameterEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  metricName,
  height = '100%',
}) => {
  const { t } = useTranslation();
  const editorRef = useRef<any>(null);
  const isInternalUpdate = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Serialize current params to JSON string for the editor
  const jsonString = JSON.stringify(value, null, 2);

  // Keep a ref to the latest JSON string from the form to detect external changes
  const lastExternalJson = useRef(jsonString);

  // When value changes externally (from the form), update editor content
  useEffect(() => {
    const newJson = JSON.stringify(value, null, 2);
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && newJson !== lastExternalJson.current) {
      const currentValue = editorRef.current.getValue();
      // Only update if editor content is valid and differs
      if (currentValue !== newJson) {
        lastExternalJson.current = newJson;
        editorRef.current.setValue(newJson);
      }
    }
  }, [value]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = useCallback((newValue: string | undefined) => {
    if (!newValue) return;
    try {
      const parsed = JSON.parse(newValue);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setError(t('jsonEditor.validationErrors.mustBeObject'));
        onValidationChange?.(false);
        return;
      }

      // Validate threshold values (must be 0-1)
      if ('threshold' in parsed) {
        const thresh = parsed.threshold;
        if (typeof thresh === 'number' && (thresh < 0 || thresh > 1)) {
          setError(t('jsonEditor.validationErrors.thresholdRange'));
          onValidationChange?.(false);
          return;
        }
      }

      // Validate imbalance thresholds
      if ('imbalance_threshold_high' in parsed) {
        const thresh = parsed.imbalance_threshold_high;
        if (typeof thresh === 'number' && (thresh < 0 || thresh > 1)) {
          setError(t('jsonEditor.validationErrors.thresholdRange'));
          onValidationChange?.(false);
          return;
        }
      }
      if ('imbalance_threshold_low' in parsed) {
        const thresh = parsed.imbalance_threshold_low;
        if (typeof thresh === 'number' && (thresh < 0 || thresh > 1)) {
          setError(t('jsonEditor.validationErrors.thresholdRange'));
          onValidationChange?.(false);
          return;
        }
      }

      // Validate factor (outliers)
      if ('factor' in parsed) {
        const f = parsed.factor;
        if (typeof f === 'number' && (f < 0 || f > 10)) {
          setError(t('jsonEditor.validationErrors.factorPositive'));
          onValidationChange?.(false);
          return;
        }
      }

      setError(null);
      onValidationChange?.(true);
      isInternalUpdate.current = true;
      lastExternalJson.current = JSON.stringify(parsed, null, 2);
      onChange(parsed);
    } catch (e: any) {
      const msg = e.message?.replace(/^JSON\.parse: /, '') || t('jsonEditor.validationErrors.invalidJson');
      setError(msg);
      onValidationChange?.(false);
    }
  }, [onChange, onValidationChange]);

  const handleFormat = () => {
    if (editorRef.current) {
      try {
        const current = editorRef.current.getValue();
        const parsed = JSON.parse(current);
        const formatted = JSON.stringify(parsed, null, 2);
        editorRef.current.setValue(formatted);
      } catch {
        // Can't format invalid JSON
      }
    }
  };

  const handleCopy = async () => {
    if (editorRef.current) {
      const text = editorRef.current.getValue();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleLoadExample = () => {
    if (!metricName || !METRIC_PARAMETER_EXAMPLES[metricName]) return;
    const example = METRIC_PARAMETER_EXAMPLES[metricName].example;
    const formatted = JSON.stringify(example, null, 2);
    if (editorRef.current) {
      editorRef.current.setValue(formatted);
    }
    setError(null);
    onValidationChange?.(true);
    onChange(example);
  };

  const hint = metricName ? METRIC_PARAMETER_EXAMPLES[metricName] : null;

  return (
    // @ts-ignore — TS2590: MUI Box type inference too complex when lucide-react types are in scope
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: '#FAFAFA', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mr: 1 }}>
            {t('jsonEditor.json')}
          </Typography>
          <Chip label={t('jsonEditor.parameters')} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#E8F5E9', color: GREEN }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {hint && (
            <Tooltip title={t('jsonEditor.loadExample')} arrow>
              <IconButton size="small" onClick={handleLoadExample} sx={{ fontSize: 12 }}>
                <LightbulbIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('jsonEditor.formatJson')} arrow>
            <IconButton size="small" onClick={handleFormat}>
              <FormatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={copied ? t('jsonEditor.copied') : t('jsonEditor.copyToClipboard')} arrow>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckIcon fontSize="small" sx={{ color: GREEN }} /> : <CopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Hint bar */}
      {hint && (
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F5F5F5', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
            {t(hint.descriptionKey)}
          </Typography>
        </Box>
      )}

      {/* Monaco Editor */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height={height}
          language="json"
          theme="vs"
          value={jsonString}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            renderWhitespace: 'none',
            folding: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            padding: { top: 8, bottom: 8 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
          }}
        />
      </Box>

      {/* Error bar */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0, py: 0.25, px: 1.5, fontSize: '0.75rem', flexShrink: 0 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default JsonParameterEditor;
