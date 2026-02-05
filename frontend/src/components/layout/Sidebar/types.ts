import { ReactNode } from 'react';

export interface SidebarItem {
  id: string;
  text: string;
  icon: ReactNode;
  path?: string;
  children?: SidebarItem[];
  action?: () => void;
  badge?: number | string;
  dividerAfter?: boolean;
  isControl?: boolean; // Mark items like "Ver todos" as controls, not content
}

export interface SidebarSection {
  id: string;
  title?: string;
  items: SidebarItem[];
}

export interface RecentItem {
  id: number;
  name: string;
  type: 'project' | 'dataset';
  path: string;
  updatedAt?: string;
}

export interface SidebarContextType {
  isOpen: boolean;
  expandedItems: string[];
  toggleSidebar: () => void;
  toggleExpanded: (itemId: string) => void;
  isExpanded: (itemId: string) => boolean;
}
