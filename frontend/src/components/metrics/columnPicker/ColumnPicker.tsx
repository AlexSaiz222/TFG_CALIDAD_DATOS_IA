import React, { useState } from 'react';
import {
  Box, Typography, TextField, Checkbox, FormControlLabel,
  Chip, Alert, Divider,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { DatasetColumnLite } from '../../../types';

const TYPE_COLORS: Record<string, string> = {
  int64: '#1565C0',
  float64: '#0277BD',
  object: '#558B2F',
  bool: '#6A1B9A',
  datetime64: '#E65100',
};

function typeColor(type: string) {
  for (const key of Object.keys(TYPE_COLORS)) {
    if (type?.toLowerCase().includes(key.replace('64', ''))) return TYPE_COLORS[key];
  }
  return '#616161';
}

interface ColumnPickerProps {
  columns: DatasetColumnLite[];
  selectedColumns: string[];
  onChange: (cols: string[]) => void;
  missingColumns?: string[];
  loading?: boolean;
}

const ColumnPicker: React.FC<ColumnPickerProps> = ({
  columns, selectedColumns, onChange, missingColumns = [], loading = false,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const toggle = (name: string) => {
    if (selectedColumns.includes(name)) {
      onChange(selectedColumns.filter(c => c !== name));
    } else {
      onChange([...selectedColumns, name]);
    }
  };

  const filtered = columns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <Typography variant="caption" color="text.secondary">{t('columnPicker.loading')}</Typography>;
  }

  if (columns.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        {t('columnPicker.emptyDataset')}
      </Alert>
    );
  }

  return (
    <Box>
      <TextField
        size="small"
        fullWidth
        placeholder={t('columnPicker.searchPlaceholder')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 1.5 }}
      />

      <Box sx={{ maxHeight: 240, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1 }}>
        {filtered.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ py: 1, display: 'block' }}>
            {t('columnPicker.noMatch')}
          </Typography>
        ) : (
          filtered.map(col => (
            <Box key={col.name} display="flex" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={selectedColumns.includes(col.name)}
                    onChange={() => toggle(col.name)}
                    sx={{ '&.Mui-checked': { color: '#00B37E' } }}
                  />
                }
                label={<Typography variant="body2">{col.name}</Typography>}
                sx={{ m: 0, flex: 1 }}
              />
              <Chip
                label={col.type}
                size="small"
                sx={{ fontSize: '0.65rem', height: 18, bgcolor: typeColor(col.type), color: '#fff', ml: 1 }}
              />
            </Box>
          ))
        )}
      </Box>

      {missingColumns.length > 0 && (
        <Box mt={1.5}>
          <Divider sx={{ mb: 1 }} />
          <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
            <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="caption" color="warning.main" fontWeight={600}>
              {t('columnPicker.missingTitle')}
            </Typography>
          </Box>
          <Box display="flex" flexWrap="wrap" gap={0.5}>
            {missingColumns.map(col => (
              <Chip
                key={col}
                label={col}
                size="small"
                color="warning"
                variant="outlined"
                onDelete={() => onChange(selectedColumns.filter(c => c !== col))}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('columnPicker.missingCaption')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ColumnPicker;
