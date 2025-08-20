import Router from 'next/router';

// Configuration
const ROUTE_CHANGE_DELAY = 300; // ms

// State tracking
let routeChangeInProgress = false;
let pendingNavigation: string | null = null;
let navigationTimeout: NodeJS.Timeout | null = null;

// Initialize route change listeners
export const initRouteChangeHandlers = () => {
  Router.events.on('routeChangeStart', () => {
    routeChangeInProgress = true;
  });

  Router.events.on('routeChangeComplete', () => {
    setTimeout(() => {
      routeChangeInProgress = false;
      
      // Process any pending navigation after the delay
      if (pendingNavigation) {
        const destination = pendingNavigation;
        pendingNavigation = null;
        Router.push(destination);
      }
    }, ROUTE_CHANGE_DELAY);
  });

  Router.events.on('routeChangeError', () => {
    setTimeout(() => {
      routeChangeInProgress = false;
      
      // Process any pending navigation after the delay
      if (pendingNavigation) {
        const destination = pendingNavigation;
        pendingNavigation = null;
        Router.push(destination);
      }
    }, ROUTE_CHANGE_DELAY);
  });
};

// Safe navigation function to prevent rapid route changes
export const safeNavigate = (path: string) => {
  if (routeChangeInProgress) {
    // Cancel any previous pending navigation
    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
    }
    
    // Store this navigation request to process after current one completes
    pendingNavigation = path;
    
    // Set a maximum wait time in case routeChangeComplete never fires
    navigationTimeout = setTimeout(() => {
      if (pendingNavigation) {
        const destination = pendingNavigation;
        pendingNavigation = null;
        routeChangeInProgress = false;
        Router.push(destination);
      }
    }, 2000); // 2 seconds maximum wait
  } else {
    Router.push(path);
  }
};
