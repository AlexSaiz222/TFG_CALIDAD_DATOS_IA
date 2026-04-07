import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { safeNavigate } from '../../../utils/routeTransition';
import { SidebarItem as SidebarItemType } from './types';

interface SidebarItemProps {
  item: SidebarItemType;
  depth?: number;
  isCollapsed?: boolean;
}

const SidebarItemComponent: React.FC<SidebarItemProps> = ({
  item,
  depth = 0,
  isCollapsed = false,
}) => {
  const router = useRouter();
  const hasChildren = Boolean(item.children?.length);

  const isActive = item.path ? router.pathname === item.path : false;

  const checkChildActive = (children: typeof item.children): boolean => {
    if (!children) return false;
    return children.some(child => {
      if (child.path && (router.pathname === child.path || router.pathname.startsWith(child.path + '/'))) return true;
      if (child.children) return checkChildActive(child.children);
      return false;
    });
  };

  const isChildActive = checkChildActive(item.children);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isChildActive && !isActive) setOpen(true);
    else if (isActive && hasChildren)  setOpen(false);
  }, [isChildActive, isActive, router.pathname]);

  const handleClick = () => {
    if (item.isControl && item.path) safeNavigate(item.path);
    else if (hasChildren) setOpen(o => !o);
    else if (item.path) safeNavigate(item.path);
    else item.action?.();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(o => !o);
  };

  // ── Visual variants based on depth and state ──────────────────────────
  const isTopLevel = depth === 0;
  const activeColor = '#00B37E';

  const buttonSx = {
    // Margins and padding
    mx: '6px',
    my: isTopLevel ? '1px' : '0px',
    pl: isCollapsed ? 0 : depth === 0 ? 1.5 : depth === 1 ? 3 : 4.5,
    pr: 1,
    borderRadius: '8px',
    minHeight: isTopLevel ? 40 : item.isControl ? 32 : 34,
    justifyContent: isCollapsed ? 'center' : 'flex-start',

    // Active state
    ...(isActive && {
      backgroundColor: 'rgba(0,179,126,0.1)',
      '&:hover': { backgroundColor: 'rgba(0,179,126,0.14)' },
    }),

    // Expanded parent (not active)
    ...(!isActive && open && isTopLevel && {
      backgroundColor: 'rgba(0,0,0,0.02)',
    }),

    // Default hover
    ...(!isActive && {
      '&:hover': {
        backgroundColor: depth === 0
          ? 'rgba(0,0,0,0.04)'
          : 'rgba(0,0,0,0.03)',
      },
    }),
  };

  const iconSx = {
    minWidth: isCollapsed ? 0 : depth === 0 ? 34 : 28,
    mr: isCollapsed ? 0 : 1,
    justifyContent: 'center',
    color: isActive ? activeColor : depth === 0 ? '#4B5563' : '#6B7280',
    '& .MuiSvgIcon-root': {
      fontSize: depth === 0 ? '1.2rem' : '1rem',
    },
  };

  const textProps = {
    fontSize: depth === 0 ? '0.875rem' : '0.8125rem',
    fontWeight: isActive ? 600 : depth === 0 ? 500 : 400,
    color: isActive ? activeColor : depth === 0 ? '#1F2937' : '#4B5563',
    letterSpacing: '0.005em',
  };

  const button = (
    <ListItemButton onClick={handleClick} sx={buttonSx}>
      {/* Active indicator dot (top-level only) */}
      {isTopLevel && !isCollapsed && isActive && (
        <Box sx={{
          position: 'absolute', left: 0,
          width: 3, height: 18,
          borderRadius: '0 2px 2px 0',
          backgroundColor: activeColor,
        }} />
      )}

      <ListItemIcon sx={iconSx}>
        {item.icon}
      </ListItemIcon>

      {!isCollapsed && (
        <>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={textProps}
          />

          {item.badge && (
            <Chip
              label={item.badge}
              size="small"
              sx={{
                height: 18, fontSize: '0.68rem', fontWeight: 700,
                backgroundColor: activeColor, color: '#fff',
              }}
            />
          )}

          {hasChildren && (
            <Box
              onClick={handleChevronClick}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '5px',
                transition: 'background-color 0.15s',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.07)' },
              }}
            >
              {open
                ? <ExpandLess  sx={{ fontSize: 16, color: '#AAAAAA' }} />
                : <ExpandMore sx={{ fontSize: 16, color: '#AAAAAA' }} />
              }
            </Box>
          )}
        </>
      )}
    </ListItemButton>
  );

  return (
    <>
      <ListItem disablePadding sx={{ display: 'block', position: 'relative' }}>
        {isCollapsed
          ? <Tooltip title={item.text} placement="right" arrow>{button}</Tooltip>
          : button
        }
      </ListItem>

      {hasChildren && !isCollapsed && (
        <Collapse in={open} timeout={200} unmountOnExit>
          <List component="div" disablePadding sx={{ mb: 0.5 }}>
            {item.children!.map(child => (
              <SidebarItemComponent
                key={child.id}
                item={child}
                depth={depth + 1}
                isCollapsed={isCollapsed}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default SidebarItemComponent;
