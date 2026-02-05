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
import {
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { safeNavigate } from '../../../utils/routeTransition';
import { SidebarItem as SidebarItemType } from './types';

interface SidebarItemProps {
  item: SidebarItemType;
  depth?: number;
  isCollapsed?: boolean;
}

const StyledListItemButton = styled(ListItemButton)<{ depth?: number; isactive?: string; isexpanded?: string }>(
  ({ theme, depth = 0, isactive, isexpanded }) => ({
    margin: depth === 0 ? '2px 8px' : '1px 8px 1px 16px',
    borderRadius: '6px',
    padding: depth === 0 ? '8px 12px' : '6px 12px',
    minHeight: depth === 0 ? 40 : 32,
    transition: 'all 0.15s ease-in-out',
    // Only highlight if this exact item is active (not just expanded)
    ...(isactive === 'true' && {
      backgroundColor: 'rgba(0, 179, 126, 0.12)',
      borderLeft: '3px solid #00B37E',
      '&:hover': {
        backgroundColor: 'rgba(0, 179, 126, 0.18)',
      },
    }),
    // Subtle indicator for expanded parents (not active)
    ...(isexpanded === 'true' && isactive !== 'true' && {
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    }),
    '&:hover': {
      backgroundColor: isactive === 'true' 
        ? 'rgba(0, 179, 126, 0.18)' 
        : 'rgba(0, 0, 0, 0.04)',
    },
  })
);

const SidebarItemComponent: React.FC<SidebarItemProps> = ({ 
  item, 
  depth = 0,
  isCollapsed = false 
}) => {
  const router = useRouter();
  const hasChildren = item.children && item.children.length > 0;
  
  // Only mark as active if this exact path matches (not children)
  const isActive = item.path 
    ? router.pathname === item.path
    : false;

  // Check if any child (or grandchild) is active
  const checkChildActive = (children: typeof item.children): boolean => {
    if (!children) return false;
    return children.some(child => {
      if (child.path && (router.pathname === child.path || router.pathname.startsWith(child.path + '/'))) {
        return true;
      }
      if (child.children) {
        return checkChildActive(child.children);
      }
      return false;
    });
  };

  const isChildActive = checkChildActive(item.children);

  // Auto-expand when a child is active
  const [open, setOpen] = useState(isChildActive || false);

  // Update open state when route changes
  useEffect(() => {
    if (isChildActive && !open) {
      setOpen(true);
    }
  }, [isChildActive, router.pathname]);

  const handleClick = () => {
    if (hasChildren) {
      setOpen(!open);
    } else if (item.action) {
      item.action();
    } else if (item.path) {
      safeNavigate(item.path);
    }
  };

  const buttonContent = (
    <StyledListItemButton
      depth={depth}
      isactive={isActive ? 'true' : 'false'}
      isexpanded={open && hasChildren ? 'true' : 'false'}
      onClick={handleClick}
      sx={{
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        px: isCollapsed ? 1 : 1.5,
      }}
    >
      <ListItemIcon
        sx={{
          color: isActive ? '#00B37E' : '#666666',
          minWidth: isCollapsed ? 0 : 32,
          mr: isCollapsed ? 0 : 1,
          justifyContent: 'center',
          '& .MuiSvgIcon-root': {
            fontSize: depth === 0 ? '1.2rem' : '1rem',
          },
        }}
      >
        {item.icon}
      </ListItemIcon>
      
      {!isCollapsed && (
        <>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontSize: depth === 0 ? '0.875rem' : '0.8rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#00B37E' : '#424242',
            }}
          />
          
          {item.badge && (
            <Chip
              label={item.badge}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: '#00B37E',
                color: 'white',
              }}
            />
          )}
          
          {hasChildren && (
            <Box sx={{ color: '#999' }}>
              {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </Box>
          )}
        </>
      )}
    </StyledListItemButton>
  );

  return (
    <>
      <ListItem 
        disablePadding 
        sx={{ display: 'block' }}
      >
        {isCollapsed ? (
          <Tooltip title={item.text} placement="right" arrow>
            {buttonContent}
          </Tooltip>
        ) : (
          buttonContent
        )}
      </ListItem>
      
      {hasChildren && !isCollapsed && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children!.map((child) => (
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
