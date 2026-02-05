import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Storage as StorageIcon,
  ExpandLess,
  ExpandMore,
  History as HistoryIcon,
} from '@mui/icons-material';
import { safeNavigate } from '../../../utils/routeTransition';
import { projectsAPI } from '../../../services/api';

interface RecentItem {
  id: number;
  name: string;
  type: 'project' | 'dataset';
  path: string;
  updatedAt?: string;
}

interface RecentItemsProps {
  isCollapsed?: boolean;
}

const RecentItems: React.FC<RecentItemsProps> = ({ isCollapsed = false }) => {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchRecentItems = async () => {
      try {
        setLoading(true);
        
        const projectsRes = await projectsAPI.getProjects().catch(() => ({ data: { data: { projects: [] } } }));

        const projects = projectsRes.data?.data?.projects || projectsRes.data?.projects || [];

        const recentProjects: RecentItem[] = projects
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            type: 'project' as const,
            path: `/projects/${p.id}`,
            updatedAt: p.updated_at,
          }));

        setRecentItems(recentProjects);
      } catch (error) {
        console.error('Error fetching recent items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentItems();
  }, []);

  if (isCollapsed) {
    return (
      <Box sx={{ py: 1, borderTop: '1px solid #E5E5E5' }}>
        <Tooltip title="Recientes" placement="right" arrow>
          <IconButton
            size="small"
            sx={{
              display: 'flex',
              mx: 'auto',
              color: '#888',
            }}
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ borderTop: '1px solid #E5E5E5' }}>
      <ListItemButton
        onClick={() => setExpanded(!expanded)}
        sx={{
          py: 1,
          px: 2,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: '#888' }}>
          <HistoryIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Recientes"
          primaryTypographyProps={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        />
        {expanded ? (
          <ExpandLess fontSize="small" sx={{ color: '#888' }} />
        ) : (
          <ExpandMore fontSize="small" sx={{ color: '#888' }} />
        )}
      </ListItemButton>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List disablePadding sx={{ pb: 1 }}>
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <ListItem key={i} sx={{ py: 0.5, px: 2 }}>
                  <Skeleton variant="rectangular" width="100%" height={32} sx={{ borderRadius: 1 }} />
                </ListItem>
              ))}
            </>
          ) : recentItems.length === 0 ? (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                color: '#999',
                py: 2,
              }}
            >
              No hay items recientes
            </Typography>
          ) : (
            recentItems.map((item) => (
              <ListItem key={`${item.type}-${item.id}`} disablePadding>
                <ListItemButton
                  onClick={() => safeNavigate(item.path)}
                  sx={{
                    py: 0.75,
                    px: 2,
                    mx: 1,
                    borderRadius: '6px',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 179, 126, 0.08)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 28,
                      color: item.type === 'project' ? '#00B37E' : '#3B82F6',
                    }}
                  >
                    {item.type === 'project' ? (
                      <FolderIcon sx={{ fontSize: '1rem' }} />
                    ) : (
                      <StorageIcon sx={{ fontSize: '1rem' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: '#555',
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </Collapse>
    </Box>
  );
};

export default RecentItems;
