import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isCollapsed: boolean;
  toggleOpen: () => void;
  toggleCollapsed: () => void;
  setOpen: (open: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Persist state in localStorage
  useEffect(() => {
    const savedOpen = localStorage.getItem('sidebar-open');
    
    if (savedOpen !== null) {
      setIsOpen(savedOpen === 'true');
    }
    // Always start expanded - reset any corrupted state
    localStorage.setItem('sidebar-collapsed', 'false');
    setIsCollapsed(false);
  }, []);

  const toggleOpen = () => {
    const newValue = !isOpen;
    setIsOpen(newValue);
    localStorage.setItem('sidebar-open', String(newValue));
  };

  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
  };

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem('sidebar-open', String(open));
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isCollapsed,
        toggleOpen,
        toggleCollapsed,
        setOpen,
        setCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export default SidebarContext;
