import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { safeNavigate } from '../../utils/routeTransition';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Dataset as DatasetIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 240;

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Ya no necesitamos el LogoContainer porque quitamos el logo del menú lateral

const StyledListItemButton = styled(ListItemButton)(({ theme }) => ({
  margin: '6px 10px',
  borderRadius: '8px',
  transition: 'all 0.2s ease-in-out',
  padding: '10px 16px',
  '&.Mui-selected': {
    backgroundColor: 'rgba(0, 179, 126, 0.08)',
    '&:hover': {
      backgroundColor: 'rgba(0, 179, 126, 0.12)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    transform: 'translateX(2px)',
  },
}));

interface MainLayoutProps {
  children: React.ReactNode;
}

// Creamos un componente con estilos globales para los keyframes
const GlobalStyles = () => {
  return (
    <style jsx global>{`
      @keyframes shine {
        0%, 5% { background-position: -200% 0; }
        100% { background-position: 100% 0; }
      }
    `}</style>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isMobile]);

  // Redirección explícita para usuarios no autenticados
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('MainLayout: Usuario no autenticado, redirigiendo a login...');
      // Use router.replace directly for auth redirects as they are critical
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Mostrar pantalla de carga mientras se verifica la autenticación
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Si no está autenticado, no renderizar nada y esperar la redirección
  if (!isAuthenticated) {
    return null;
  }

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const handleProfileClick = () => {
    handleProfileMenuClose();
    safeNavigate('/profile');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Projects', icon: <StorageIcon />, path: '/projects' },
    { text: 'Datasets', icon: <DatasetIcon />, path: '/datasets' },
    { text: 'Evaluations', icon: <AssessmentIcon />, path: '/evaluations' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  // Ruta a la imagen del logo personalizada
  const logoPath = '/images/logo.png'; // Asegúrate de colocar tu imagen en public/images/logo.png

  return (
    <Box sx={{ display: 'flex', overflow: 'hidden' }}>
      <GlobalStyles />
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: '#FFFFFF',
          color: '#1A1A1A',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        })}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
            <Image
              src={logoPath}
              alt="Data Quality Platform Logo"
              width={35}
              height={35}
              style={{ marginRight: '10px' }}
            />
            <Box
              sx={{
                flexGrow: 1,
                position: 'relative',
                cursor: 'pointer',
                '&:hover .text-shine': {
                  animation: 'shine 5s linear infinite',
                  backgroundPosition: '-200%', /* Asegura que comienza completamente fuera */
                },
                '&:not(:hover) .text-shine': {
                  animation: 'none',
                  backgroundImage: 'none',
                  color: '#333333',
                  WebkitTextFillColor: '#333333',
                }
              }}
            >
              <Typography
                variant="h5"
                noWrap
                component="div"
                className="text-shine"
                sx={{
                  fontWeight: 700,
                  fontFamily: '"Segoe UI", "Trebuchet MS", "Helvetica", sans-serif',
                  color: '#333333',
                  backgroundImage: 'linear-gradient(90deg, #333333, #333333 40%, rgba(0,210,181,1) 45%, rgba(0,183,222,1) 50%, #333333 55%, #333333)',
                  backgroundSize: '300%',
                  backgroundPosition: '-200%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  // Sin transición para no interferir con la animación
                }}
              >
                DATAQUAL
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Account settings">
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              sx={{ ml: 2 }}
              aria-controls="profile-menu"
              aria-haspopup="true"
            >
              <Avatar sx={{ 
                bgcolor: '#00B37E',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                }
              }}>
                {user?.first_name ? user.first_name[0] : user?.username ? user.username[0] : 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
                mt: 1.5,
                borderRadius: '8px',
                minWidth: '180px',
                '& .MuiMenuItem-root': {
                  borderRadius: '4px',
                  margin: '2px 8px',
                  padding: '8px 16px',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 179, 126, 0.08)',
                  },
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonIcon fontSize="small" sx={{ color: '#00B37E' }} />
              </ListItemIcon>
              <Typography>Profile</Typography>
            </MenuItem>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#E5484D' }} />
              </ListItemIcon>
              <Typography>Logout</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #EEEEEE',
            position: 'fixed',
            height: '100%',
            boxShadow: open ? '1px 0px 5px rgba(0, 0, 0, 0.03)' : 'none',
            transition: 'all 0.3s ease',
          },
        }}
      >
        <DrawerHeader sx={{ 
          justifyContent: 'flex-end', 
          px: 2, 
          py: 3, 
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          mb: 1
        }}>
          <IconButton 
            onClick={handleDrawerToggle}
            sx={{
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: 'rgba(0, 179, 126, 0.08)',
              }
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        <List sx={{ px: 1, pt: 2, pb: 2 }}>
          {menuItems.map((item) => {
            const isSelected = router.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 1.5 }}>
                <StyledListItemButton
                  selected={isSelected}
                  onClick={() => safeNavigate(item.path)}
                  sx={{
                    pl: 2,
                    pr: 2,
                    py: 1.2,
                    ...(isSelected && {
                      background: 'linear-gradient(90deg, rgba(0, 179, 126, 0.08) 0%, rgba(0, 179, 126, 0.02) 100%)',
                      borderLeft: '3px solid #00B37E',
                      boxShadow: '0 1px 4px rgba(0, 179, 126, 0.08)',
                    }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isSelected ? '#00B37E' : '#757575',
                      minWidth: '42px',
                      display: 'flex',
                      justifyContent: 'center',
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.2rem',
                        transition: 'all 0.2s ease',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                      }
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#00B37E' : '#424242',
                      fontSize: '0.95rem',
                      letterSpacing: '0.2px'
                    }}
                    sx={{ transition: 'all 0.2s ease' }}
                  />
                </StyledListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          pl: 6, // Adjust this value to increase/decrease left padding
          pr: 3, // Right padding
          paddingTop: 4,
          position: 'absolute',
          left: open ? `${drawerWidth}px` : '0',
          width: open ? `calc(100% - ${drawerWidth + 24}px)` : 'calc(100% - 24px)', // Adjusted width to account for right margin
          transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out',
        }}
      >
        <DrawerHeader />
        {/* Asegurar que children siempre se renderice de forma segura */}
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
