import React, { useState } from 'react';
import {
  Box, Typography, MenuItem, TextField, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ValidationPattern } from '../../../types';
import PatternEditor from './PatternEditor';

export interface ColumnRule {
  column: string;
  expected_type: string;
  pattern?: string;
}

interface ColumnPatternMatrixProps {
  rules: ColumnRule[];
  allPatterns: ValidationPattern[];
  selectedColumns: string[];
  onChange: (rules: ColumnRule[]) => void;
  onPatternCreated: (pattern: ValidationPattern) => void;
}

const CREATE_NEW = '__create_new__';

const ColumnPatternMatrix: React.FC<ColumnPatternMatrixProps> = ({
  rules, allPatterns, selectedColumns, onChange, onPatternCreated,
}) => {
  const { t } = useTranslation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);

  // Sync rules with selectedColumns: add new, remove deleted
  const syncedRules = React.useMemo(() => {
    const ruleMap = new Map(rules.map(r => [r.column, r]));
    return selectedColumns.map(col => ruleMap.get(col) ?? { column: col, expected_type: allPatterns[0]?.key ?? '' });
  }, [selectedColumns, rules, allPatterns]);

  const updateRule = (idx: number, patternKey: string) => {
    if (patternKey === CREATE_NEW) {
      setEditingRowIdx(idx);
      setEditorOpen(true);
      return;
    }
    const updated = syncedRules.map((r, i) =>
      i === idx ? { ...r, expected_type: patternKey, pattern: undefined } : r
    );
    onChange(updated);
  };

  const handlePatternSaved = (pattern: ValidationPattern) => {
    onPatternCreated(pattern);
    if (editingRowIdx !== null) {
      const updated = syncedRules.map((r, i) =>
        i === editingRowIdx ? { ...r, expected_type: pattern.key, pattern: undefined } : r
      );
      onChange(updated);
    }
    setEditingRowIdx(null);
  };

  if (selectedColumns.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t('columnPatternMatrix.empty')}
      </Typography>
    );
  }

  const systemPatterns = allPatterns.filter(p => p.is_system);
  const customPatterns = allPatterns.filter(p => !p.is_system);

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{t('columnPatternMatrix.title')}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><Typography variant="caption" fontWeight={600}>{t('columnPatternMatrix.colColumn')}</Typography></TableCell>
            <TableCell><Typography variant="caption" fontWeight={600}>{t('columnPatternMatrix.colPattern')}</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {syncedRules.map((rule, idx) => (
            <TableRow key={rule.column}>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace">{rule.column}</Typography>
              </TableCell>
              <TableCell>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={rule.expected_type}
                  onChange={e => updateRule(idx, e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  {systemPatterns.length > 0 && (
                    <MenuItem disabled sx={{ fontSize: '0.72rem', opacity: 0.6 }}>{t('columnPatternMatrix.groupSystem')}</MenuItem>
                  )}
                  {systemPatterns.map(p => (
                    <MenuItem key={p.key} value={p.key}>{p.name}</MenuItem>
                  ))}
                  {customPatterns.length > 0 && (
                    <MenuItem disabled sx={{ fontSize: '0.72rem', opacity: 0.6 }}>{t('columnPatternMatrix.groupCustom')}</MenuItem>
                  )}
                  {customPatterns.map(p => (
                    <MenuItem key={p.key} value={p.key}>{p.name}</MenuItem>
                  ))}
                  <MenuItem value={CREATE_NEW} sx={{ color: '#00B37E', fontWeight: 600 }}>
                    <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />{t('columnPatternMatrix.createNew')}
                  </MenuItem>
                </TextField>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editorOpen && (
        <PatternEditor
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingRowIdx(null); }}
          onSaved={handlePatternSaved}
        />
      )}
    </Box>
  );
};

export default ColumnPatternMatrix;
