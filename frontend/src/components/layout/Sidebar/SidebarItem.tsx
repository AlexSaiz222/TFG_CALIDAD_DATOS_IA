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

const StyledListItemButton = styled(ListItemButton)<{ depth?: number; isactive?: string; isexpanded?: string; iscontrol?: string }>(
  ({ theme, depth = 0, isactive, isexpanded, iscontrol }) => ({
    margin: depth === 0 ? '3px 8px' : iscontrol === 'true' ? '2px 8px 2px 16px' : '1px 8px 1px 16px',
    marginLeft: depth === 0 ? '8px' : depth === 1 ? '24px' : '40px',
    marginRight: '8px',
    borderRadius: depth === 0 ? '8px' : '6px',
    padding: depth === 0 ? '10px 14px' : iscontrol === 'true' ? '6px 12px' : '7px 12px',
    minHeight: depth === 0 ? 44 : iscontrol === 'true' ? 34 : 36,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    // Only highlight if this exact item is active
    ...(isactive === 'true' && {
      backgroundColor: 'rgba(0, 179, 126, 0.1)',
      borderLeft: '3px solid #00B37E',
      '&:hover': {
        backgroundColor: 'rgba(0, 179, 126, 0.15)',
      },
    }),
    // Expanded parent state (subtle)
    ...(isexpanded === 'true' && isactive !== 'true' && depth === 0 && {
      backgroundColor: 'rgba(0, 0, 0, 0.025)',
    }),
    // Hover states with clear visual feedback
    '&:hover': {
      backgroundColor: isactive === 'true' 
        ? 'rgba(0, 179, 126, 0.15)' 
        : depth === 0 ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      transform: depth === 0 ? 'translateX(2px)' : 'none',
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

  // Check if any child (or grandchild) is active (but not the parent itself)
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

  // Auto-expand ONLY when a specific child is active (not when parent route is active)
  const [open, setOpen] = useState(false);

  // Update open state when route changes - only expand if a CHILD is active, not the parent
  useEffect(() => {
    // Only auto-expand if a child is active AND we're not on the parent route
    if (isChildActive && !isActive) {
      setOpen(true);
    } else if (isActive && hasChildren) {
      // If we're on the parent route, collapse the children
      setOpen(false);
    }
  }, [isChildActive, isActive, router.pathname]);

  const handleClick = () => {
    // If item has a path, navigate (even if it has children)
    if (item.path) {
      safeNavigate(item.path);
    } else if (item.action) {
      item.action();
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    setOpen(!open);
  };

  const buttonContent = (
    <StyledListItemButton
      depth={depth}
      isactive={isActive ? 'true' : 'false'}
      isexpanded={open && hasChildren ? 'true' : 'false'}
      iscontrol={item.isControl ? 'true' : 'false'}
      onClick={handleClick}
      sx={{
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        px: isCollapsed ? 1 : 1.5,
      }}
    >
      <ListItemIcon
        sx={{
          color: isActive ? '#00B37E' : depth === 0 ? '#374151' : '#6B7280',
          minWidth: isCollapsed ? 0 : depth === 0 ? 36 : 32,
          mr: isCollapsed ? 0 : depth === 0 ? 1.5 : 1.25,
          justifyContent: 'center',
          opacity: depth === 0 ? 1 : 0.8,
          '& .MuiSvgIcon-root': {
            fontSize: depth === 0 ? '1.3rem' : '1.05rem',
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
              fontSize: depth === 0 ? '0.9375rem' : '0.8125rem',
              fontWeight: isActive ? 600 : depth === 0 ? 600 : 400,
              color: isActive ? '#00B37E' : depth === 0 ? '#1F2937' : '#4B5563',
              letterSpacing: depth === 0 ? '0.01em' : '0',
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
            <Box
              onClick={handleChevronClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '4px',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              {open ? (
                <ExpandLess fontSize="small" sx={{ color: '#888' }} />
              ) : (
                <ExpandMore fontSize="small" sx={{ color: '#888' }} />
              )}
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
          <List 
            component="div" 
            disablePadding 
            sx={{ 
              mt: depth === 0 ? 0.5 : 0.25, 
              mb: depth === 0 ? 1 : 0.5,
            }}
          >
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
