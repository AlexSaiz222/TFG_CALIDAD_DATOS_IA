import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import Link from 'next/link';

/**
 * Simple landing page that avoids any complex components or dependencies
 * This bypasses the problematic code causing the r.reduce error
 */
export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        py: 4
      }}>
        <Paper sx={{ p: 4, width: '100%', maxWidth: 600 }}>
          <Typography variant="h3" component="h1" align="center" gutterBottom>
            Data Quality Platform
          </Typography>
          
          <Typography variant="body1" paragraph align="center">
            Evaluate and improve your AI datasets with our comprehensive quality metrics
          </Typography>
          
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button 
              variant="contained" 
              color="primary"
              component={Link}
              href="/dashboard-minimal"
              size="large"
            >
              Go to Dashboard
            </Button>
            
            <Button 
              variant="outlined"
              component={Link}
              href="/login"
              size="large"
            >
              Login
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
