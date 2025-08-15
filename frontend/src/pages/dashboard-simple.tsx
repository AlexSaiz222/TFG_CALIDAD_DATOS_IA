import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import Link from 'next/link';

// Simple type definition
type SimpleProject = {
  id: number;
  name: string;
};

// Mock data to avoid API calls
const mockProjects: SimpleProject[] = [
  { id: 1, name: 'Sample Project 1' },
  { id: 2, name: 'Sample Project 2' },
];

/**
 * Simple Dashboard Component
 * This is a minimal implementation to avoid the r.reduce error
 */
export default function DashboardSimple() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" paragraph>
          Welcome to the Data Quality Platform
        </Typography>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Sample Projects
          </Typography>
          
          {mockProjects.map((project) => (
            <Paper key={project.id} sx={{ p: 3, mb: 2 }}>
              <Typography variant="h6">{project.name}</Typography>
              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  color="primary"
                  component={Link}
                  href={`/projects/${project.id}`}
                >
                  View Details
                </Button>
              </Box>
            </Paper>
          ))}
          
          <Box sx={{ mt: 4 }}>
            <Button 
              variant="contained" 
              color="primary"
              component={Link}
              href="/projects/new"
            >
              Create New Project
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
