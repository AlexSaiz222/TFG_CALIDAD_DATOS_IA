import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Drawer,
  List,
  Divider,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
  Add as AddIcon,
  Assessment as AssessmentIcon,
  History as HistoryIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Tune as TuneIcon,
  Notifications as NotificationsIcon,
  List as ListIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import SidebarItemComponent from './SidebarItem';
import RecentItems from './RecentItems';
import { SidebarItem } from './types';
import { useSidebar } from '../../../contexts/SidebarContext';
import { projectsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 56;

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle }) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isCollapsed, toggleCollapsed, setCollapsed } = useSidebar();
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Array<{id: number; name: string}>>([]);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile, setCollapsed]);

  // Fetch projects for dynamic menu (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchProjects = async () => {
      try {
        const res = await projectsAPI.getProjects();
        // The API returns { data: { projects: [...] } } or { data: [...] } or directly [...]
        let projectsList: Array<{id: number; name: string}> = [];
        
        if (res?.data?.data?.projects) {
          projectsList = res.data.data.projects;
        } else if (res?.data?.projects) {
          projectsList = res.data.projects;
        } else if (res?.data?.data && Array.isArray(res.data.data)) {
          projectsList = res.data.data;
        } else if (Array.isArray(res?.data)) {
          projectsList = res.data;
        } else if (Array.isArray(res)) {
          projectsList = res;
        }
        
        setProjects(projectsList.slice(0, 8));
      } catch (error) {
        console.error('Error fetching projects for sidebar:', error);
      }
    };
    fetchProjects();
  }, [isAuthenticated]);

  const handleCollapseToggle = () => {
    toggleCollapsed();
  };

  // Build dynamic project children - "Ver todos" has projects as children
  const projectChildren: SidebarItem[] = [
    {
      id: 'projects-all',
      text: 'Ver todos',
      icon: <ListIcon />,
      path: '/projects',
      children: projects.length > 0 ? projects.map(p => ({
        id: `project-${p.id}`,
        text: p.name,
        icon: <FolderOpenIcon />,
        path: `/projects/${p.id}`,
      })) : undefined,
    },
    {
      id: 'projects-new',
      text: 'Nuevo proyecto',
      icon: <AddIcon />,
      path: '/projects/new',
    },
  ];

  // Dataset children - simple structure without nested datasets
  const datasetChildren: SidebarItem[] = [
    {
      id: 'datasets-all',
      text: 'Todos los datasets',
      icon: <ListIcon />,
      path: '/datasets',
    },
    {
      id: 'datasets-upload',
      text: 'Subir dataset',
      icon: <CloudUploadIcon />,
      path: '/datasets/upload',
    },
  ];

  const menuItems: SidebarItem[] = [
    {
      id: 'dashboard',
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
    },
    {
      id: 'projects',
      text: 'Proyectos',
      icon: <FolderIcon />,
      children: projectChildren,
    },
    {
      id: 'datasets',
      text: 'Datasets',
      icon: <StorageIcon />,
      children: datasetChildren,
    },
    {
      id: 'analysis',
      text: 'Análisis',
      icon: <AssessmentIcon />,
      children: [
        {
          id: 'analysis-history',
          text: 'Historial',
          icon: <HistoryIcon />,
          path: '/evaluations',
        },
      ],
    },
    {
      id: 'settings',
      text: 'Configuración',
      icon: <SettingsIcon />,
      children: [
        {
          id: 'settings-profile',
          text: 'Perfil',
          icon: <PersonIcon />,
          path: '/profile',
        },
        {
          id: 'settings-metrics',
          text: 'Métricas globales',
          icon: <TuneIcon />,
          path: '/settings',
        },
      ],
    },
  ];

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: currentWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          backgroundColor: '#FAFAFA',
          borderRight: '1px solid #E5E5E5',
          transition: 'width 0.3s ease-in-out',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: isCollapsed ? 'center' : 'flex-end',
          alignItems: 'center',
          px: isCollapsed ? 0.5 : 1,
          py: 1,
          borderBottom: '1px solid #E5E5E5',
          minHeight: 48,
        }}
      >
        <IconButton
          onClick={handleCollapseToggle}
          size="small"
          sx={{
            borderRadius: '6px',
            width: 32,
            height: 32,
            '&:hover': {
              backgroundColor: 'rgba(0, 179, 126, 0.1)',
            },
          }}
        >
          {isCollapsed ? (
            <ChevronRightIcon fontSize="small" />
          ) : (
            <ChevronLeftIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pt: 2, pb: 0.5 }}>
        <List component="nav" disablePadding>
          {menuItems.map((item) => (
            <SidebarItemComponent
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
            />
          ))}
        </List>
      </Box>

      <RecentItems isCollapsed={isCollapsed} />

      {!isCollapsed && (
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid #E5E5E5',
            backgroundColor: '#F5F5F5',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#999',
              display: 'block',
              textAlign: 'center',
            }}
          >
            DataQual v1.0
          </Typography>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar;
export { DRAWER_WIDTH, COLLAPSED_WIDTH };
