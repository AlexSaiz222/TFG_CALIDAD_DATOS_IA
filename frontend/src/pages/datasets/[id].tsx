import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  IconButton,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI, evaluationsAPI } from '../../services/api';
import { Dataset, Evaluation, Issue } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dataset-tabpanel-${index}`}
      aria-labelledby={`dataset-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const DatasetDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const datasetId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [runningEvaluation, setRunningEvaluation] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);

  useEffect(() => {
    const fetchDatasetData = async () => {
      if (!datasetId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch dataset details
        const datasetResponse = await datasetsAPI.getDataset(datasetId);
        setDataset(datasetResponse.data);

        // Fetch evaluations for this dataset
        const evaluationsResponse = await evaluationsAPI.getEvaluations(datasetId);
        setEvaluations(evaluationsResponse.data);

        // Fetch preview data
        const previewResponse = await datasetsAPI.previewDataset(datasetId);
        if (previewResponse.data && previewResponse.data.data) {
          setPreviewData(previewResponse.data.data);
          if (previewResponse.data.columns) {
            setPreviewColumns(previewResponse.data.columns);
          }
        }

        // Fetch issues if there are evaluations
        if (evaluationsResponse.data.length > 0) {
          const latestEvaluation = evaluationsResponse.data[0];
          const issuesResponse = await evaluationsAPI.getIssues(latestEvaluation.id);
          setIssues(issuesResponse.data);
        }

        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching dataset data:', error);
        setError(error.response?.data?.message || 'Failed to load dataset data. Please try again.');
        setLoading(false);
      }
    };

    if (datasetId) {
      fetchDatasetData();
    }
  }, [datasetId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!dataset) return;
    
    setDeleteLoading(true);
    try {
      await datasetsAPI.deleteDataset(dataset.id);
      
      // Redirect to project page
      router.push(`/projects/${dataset.project_id}`);
    } catch (error) {
      console.error('Error deleting dataset:', error);
      setError('Failed to delete dataset. Please try again later.');
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!dataset) return;
    
    setRunningEvaluation(true);
    setError(null);
    
    try {
      // Pass an empty metrics config as the second parameter
      const response = await evaluationsAPI.createEvaluation(dataset.id, {});
      const newEvaluation = response.data;
      
      // Add the new evaluation to the list
      setEvaluations([newEvaluation, ...evaluations]);
      
      // Poll for evaluation status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await evaluationsAPI.getEvaluation(newEvaluation.id);
          const updatedEvaluation = statusResponse.data;
          
          // Update the evaluation in the list
          setEvaluations(prev => 
            prev.map(evaluation => evaluation.id === updatedEvaluation.id ? updatedEvaluation : evaluation)
          );
          
          // If evaluation is complete, fetch issues and stop polling
          if (updatedEvaluation.status === 'completed' || updatedEvaluation.status === 'failed') {
            clearInterval(pollInterval);
            setRunningEvaluation(false);
            
            if (updatedEvaluation.status === 'completed') {
              const issuesResponse = await evaluationsAPI.getIssues(updatedEvaluation.id);
              setIssues(issuesResponse.data);
              
              // Switch to the Issues tab
              setTabValue(2);
            }
          }
        } catch (error) {
          console.error('Error polling evaluation status:', error);
          clearInterval(pollInterval);
          setRunningEvaluation(false);
        }
      }, 2000); // Poll every 2 seconds
    } catch (error: any) {
      console.error('Error running evaluation:', error);
      setError(error.response?.data?.message || 'Failed to run evaluation. Please try again.');
      setRunningEvaluation(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: '#00B37E' }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: '#E5484D' }} />;
      case 'running':
        return <HourglassEmptyIcon sx={{ color: '#FFB800' }} />;
      default:
        return <HourglassEmptyIcon sx={{ color: '#999999' }} />;
    }
  };

  const getIssueSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon sx={{ color: '#E5484D' }} />;
      case 'medium':
        return <WarningIcon sx={{ color: '#FFB800' }} />;
      case 'low':
        return <WarningIcon sx={{ color: '#00B37E' }} />;
      default:
        return <WarningIcon sx={{ color: '#999999' }} />;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error || !dataset) {
    return (
      <MainLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              Dataset Not Found
            </Typography>
          </Box>
          <Alert severity="error">{error || 'Dataset not found'}</Alert>
          <Button
            variant="contained"
            onClick={() => router.push('/projects')}
            sx={{
              mt: 3,
              backgroundColor: '#00B37E',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00A070',
              },
            }}
          >
            Back to Projects
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/projects/${dataset.project_id}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {dataset.name}
            </Typography>
            {dataset.description && (
              <Typography variant="body1" sx={{ color: '#555555', mt: 1 }}>
                {dataset.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              sx={{
                borderColor: '#E5484D',
                color: '#E5484D',
                '&:hover': {
                  borderColor: '#D03E43',
                  backgroundColor: 'rgba(229, 72, 77, 0.04)',
                },
              }}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
              onClick={handleRunEvaluation}
              disabled={runningEvaluation}
              sx={{
                backgroundColor: '#00B37E',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#00A070',
                },
              }}
            >
              {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Run Evaluation'}
            </Button>
          </Box>
        </Box>

        {/* Dataset Info Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            backgroundColor: '#FAFAFA',
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Project
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': {
                    color: '#00B37E',
                  },
                }}
                onClick={() => router.push(`/projects/${dataset.project_id}`)}
              >
                {/* Display project ID until project name is available */}
                Project {dataset.project_id}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Rows
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {dataset.row_count.toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Columns
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {dataset.column_count}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Uploaded
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(dataset.created_at).toLocaleDateString()}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="dataset tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
              },
              '& .Mui-selected': {
                color: '#00B37E',
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#00B37E',
              },
            }}
          >
            <Tab label="Preview" id="dataset-tab-0" aria-controls="dataset-tabpanel-0" />
            <Tab label="Evaluations" id="dataset-tab-1" aria-controls="dataset-tabpanel-1" />
            <Tab label="Issues" id="dataset-tab-2" aria-controls="dataset-tabpanel-2" />
          </Tabs>
        </Box>

        {/* Preview Tab */}
        <TabPanel value={tabValue} index={0}>
          {previewData.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table stickyHeader aria-label="dataset preview table" size="small">
                <TableHead>
                  <TableRow>
                    {previewColumns.map((column, index) => (
                      <TableCell key={index} sx={{ fontWeight: 600, backgroundColor: '#F5F5F5' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {previewColumns.map((column, colIndex) => (
                        <TableCell key={`${rowIndex}-${colIndex}`}>
                          {row[column] !== null && row[column] !== undefined ? String(row[column]) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ color: '#555555' }}>
                No preview data available.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Evaluations Tab */}
        <TabPanel value={tabValue} index={1}>
          {evaluations.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table aria-label="evaluations table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Completed</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Issues</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id} hover>
                      <TableCell>{evaluation.id}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(evaluation.status)}
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {evaluation.status}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{new Date(evaluation.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {evaluation.completed_at ? new Date(evaluation.completed_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{evaluation.issue_count || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            // Fetch issues for this evaluation
                            evaluationsAPI.getIssues(evaluation.id)
                              .then(response => {
                                setIssues(response.data);
                                setTabValue(2); // Switch to Issues tab
                              })
                              .catch(error => {
                                console.error('Error fetching issues:', error);
                                setError('Failed to fetch issues for this evaluation.');
                              });
                          }}
                          disabled={evaluation.status !== 'completed'}
                          sx={{
                            borderColor: '#00B37E',
                            color: '#00B37E',
                            '&:hover': {
                              borderColor: '#00A070',
                              backgroundColor: 'rgba(0, 179, 126, 0.04)',
                            },
                          }}
                        >
                          View Issues
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                No evaluations have been run for this dataset.
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
                onClick={handleRunEvaluation}
                disabled={runningEvaluation}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Run Evaluation'}
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Issues Tab */}
        <TabPanel value={tabValue} index={2}>
          {issues.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table aria-label="issues table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getIssueSeverityIcon(issue.severity)}
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              textTransform: 'capitalize',
                              color: issue.severity === 'high' ? '#E5484D' : 
                                     issue.severity === 'medium' ? '#FFB800' : '#00B37E'
                            }}
                          >
                            {issue.severity}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{issue.metric_id ? `Metric ${issue.metric_id}` : 'System'}</TableCell>
                      <TableCell>{issue.affected_columns && issue.affected_columns.length > 0 ? issue.affected_columns[0] : 'N/A'}</TableCell>
                      <TableCell>{issue.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#555555' }}>
                {evaluations.length > 0 
                  ? 'No issues found in the latest evaluation.' 
                  : 'Run an evaluation to identify data quality issues.'}
              </Typography>
              {evaluations.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon sx={{ color: '#FFFFFF' }} />}
                  onClick={handleRunEvaluation}
                  disabled={runningEvaluation}
                  sx={{
                    backgroundColor: '#00B37E',
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00A070',
                    },
                  }}
                >
                  {runningEvaluation ? <CircularProgress size={24} color="inherit" /> : 'Run Evaluation'}
                </Button>
              )}
            </Box>
          )}
        </TabPanel>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Delete Dataset?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete the dataset "{dataset.name}"? This action cannot be undone and will delete all associated evaluations and issues.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            autoFocus
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default DatasetDetail;
