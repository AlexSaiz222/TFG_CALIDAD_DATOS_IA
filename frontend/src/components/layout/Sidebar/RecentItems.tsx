import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Storage as StorageIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { safeNavigate } from '../../../utils/routeTransition';
import { projectsAPI } from '../../../services/api';
import { useRouter } from 'next/router';

interface RecentItem {
  id: number;
  name: string;
  type: 'project' | 'dataset';
  path: string;
}

interface RecentItemsProps {
  isCollapsed?: boolean;
}

const MAX_ITEMS = 4;

const RecentItems: React.FC<RecentItemsProps> = ({ isCollapsed = false }) => {
  const [items, setItems]   = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    projectsAPI.getProjects()
      .then(res => {
        let projects: any[] = [];
        if (res?.data?.data?.projects)           projects = res.data.data.projects;
        else if (res?.data?.projects)            projects = res.data.projects;
        else if (Array.isArray(res?.data?.data)) projects = res.data.data;
        else if (Array.isArray(res?.data))       projects = res.data;
        else if (Array.isArray(res))             projects = res as any;

        setItems(
          projects.slice(0, MAX_ITEMS).map((p: any) => ({
            id: p.id, name: p.name, type: 'project', path: `/projects/${p.id}`,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Collapsed: just an icon
  if (isCollapsed) {
    return (
      <Box sx={{ py: 0.5, mt: 0.5, borderTop: '1px solid #E8E8E8' }}>
        <Tooltip title={t('nav.recentProjects')} placement="right">
          <IconButton size="small" sx={{ display: 'flex', mx: 'auto', color: '#BBBBBB', borderRadius: '7px' }}>
            <HistoryIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  if (!loading && items.length === 0) return null;

  return (
    <Box sx={{ mt: 1, borderTop: '1px solid #E8E8E8', pt: 1.5 }}>
      {/* Header */}
      <Box sx={{ px: 2.5, mb: 0.75 }}>
        <Typography sx={{
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: '#BBBBBB',
        }}>
          {t('nav.sections.recent')}
        </Typography>
      </Box>

      {/* Items */}
      {loading ? (
        <Box sx={{ px: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} height={32} sx={{ borderRadius: 1, mb: 0.25 }} />
          ))}
        </Box>
      ) : (
        items.map(item => {
          const isActive = router.pathname === item.path;
          return (
            <ListItemButton
              key={`${item.type}-${item.id}`}
              onClick={() => safeNavigate(item.path)}
              sx={{
                mx: '6px', py: 0.6, pl: 1.5, pr: 1,
                borderRadius: '8px', minHeight: 32,
                backgroundColor: isActive ? 'rgba(0,179,126,0.08)' : 'transparent',
                '&:hover': { backgroundColor: isActive ? 'rgba(0,179,126,0.12)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 26, color: isActive ? '#00B37E' : '#BBBBBB' }}>
                {item.type === 'project'
                  ? <FolderIcon sx={{ fontSize: '0.95rem' }} />
                  : <StorageIcon sx={{ fontSize: '0.95rem' }} />
                }
              </ListItemIcon>
              <ListItemText
                primary={item.name}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#00B37E' : '#555555',
                  noWrap: true,
                }}
              />
            </ListItemButton>
          );
        })
      )}
    </Box>
  );
};

export default RecentItems;
