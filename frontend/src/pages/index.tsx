import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace('/dashboard-ultra-simple');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, loading, router]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#F8F9FA',
      }}
    >
      <CircularProgress sx={{ color: '#00B37E' }} />
    </Box>
  );
}
