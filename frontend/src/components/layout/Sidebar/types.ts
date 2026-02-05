import { ReactNode } from 'react';

export interface SidebarItem {
  id: string;
  text: string;
  icon: ReactNode;
  path?: string;
  children?: SidebarItem[];
  action?: () => void;
  badge?: number | string;
  isControl?: boolean; // Mark items like "Ver todos" as controls, not content
}

export interface RecentItem {
  id: number;
  name: string;
  type: 'project' | 'dataset';
  path: string;
  updatedAt?: string;
}
