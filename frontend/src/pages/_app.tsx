import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '../contexts/AuthContext';
import { SidebarProvider } from '../contexts/SidebarContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { initRouteChangeHandlers } from '../utils/routeTransition';
import i18n from '../i18n';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#00B37E',
    },
    secondary: {
      main: '#FFB800',
    },
    error: {
      main: '#E5484D',
    },
    background: {
      default: '#F8F9FA',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#555555',
    },
  },
  typography: {
    fontFamily: 'Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

function MyApp({ Component, pageProps }: AppProps) {
  // Initialize route change handlers on app mount
  useEffect(() => {
    initRouteChangeHandlers();
  }, []);

  return (
    <>
      <Head>
        <title>Data Quality Platform</title>
        <meta name="description" content="Data Quality Evaluation Platform for AI Projects" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <I18nextProvider i18n={i18n}>
        <LanguageProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
              <SidebarProvider>
                <NotificationProvider>
                  <Component {...pageProps} />
                </NotificationProvider>
              </SidebarProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </I18nextProvider>
    </>
  );
}

export default MyApp;
