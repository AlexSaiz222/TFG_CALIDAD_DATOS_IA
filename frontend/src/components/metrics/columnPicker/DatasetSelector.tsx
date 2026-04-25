import React, { useEffect, useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, Typography, Button, CircularProgress } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { datasetsAPI } from '../../../services/api';
import { Dataset } from '../../../types';

interface DatasetSelectorProps {
  projectId: number;
  value: number | null;
  onChange: (id: number) => void;
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({ projectId, value, onChange }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    datasetsAPI.getDatasets(projectId)
      .then((res: any) => {
        if (!active) return;
        const list: Dataset[] = res?.data?.data ?? res?.data ?? [];
        setDatasets(list);
        if (list.length > 0 && !value) {
          onChange(list[0].id);
        }
      })
      .catch(() => setDatasets([]))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  if (loading) {
    return <Box display="flex" alignItems="center" gap={1}><CircularProgress size={14} /><Typography variant="caption">{t('datasetSelector.loading')}</Typography></Box>;
  }

  if (datasets.length === 0) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="caption" color="text.secondary">{t('datasetSelector.empty')}</Typography>
        <Button
          size="small"
          startIcon={<UploadIcon />}
          onClick={() => router.push(`/datasets/upload?projectId=${projectId}`)}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          {t('datasetSelector.uploadCta')}
        </Button>
      </Box>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel sx={{ fontSize: '0.8rem' }}>{t('datasetSelector.label')}</InputLabel>
      <Select
        value={value ?? ''}
        label={t('datasetSelector.label')}
        onChange={e => onChange(Number(e.target.value))}
        sx={{ fontSize: '0.85rem' }}
      >
        {datasets.map(ds => (
          <MenuItem key={ds.id} value={ds.id}>
            {ds.name}{ds.version_tag ? ` (${ds.version_tag})` : ` v${ds.version}`}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default DatasetSelector;
