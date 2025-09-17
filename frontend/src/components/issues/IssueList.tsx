import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { Issue } from '../../types';
import IssueDetail from './IssueDetail';

interface IssueListProps {
  issues: Issue[];
  metrics: { id: number; name: string }[];
}

const IssueList: React.FC<IssueListProps> = ({ issues, metrics }) => {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterMetric, setFilterMetric] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon sx={{ color: '#E5484D' }} />;
      case 'medium':
        return <WarningIcon sx={{ color: '#FFB800' }} />;
      case 'low':
        return <InfoIcon sx={{ color: '#00B37E' }} />;
      default:
        return <InfoIcon sx={{ color: '#999999' }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#E5484D';
      case 'medium':
        return '#FFB800';
      case 'low':
        return '#00B37E';
      default:
        return '#999999';
    }
  };

  const getMetricName = (metricId: number | undefined, metricName?: string) => {
    // Si ya tenemos un nombre de métrica, usarlo directamente
    if (metricName) return metricName;
    
    // Si tenemos un ID de métrica, intentar encontrarlo en el catálogo
    if (metricId) {
      const metric = metrics.find(m => m.id === metricId);
      if (metric) return metric.name;
      return `Metric ${metricId}`;
    }
    
    // Si no se puede determinar, devolver Unknown
    return 'Unknown';
  };

  const getAffectedColumnsText = (issue: Issue) => {
    if (!issue.affected_columns || !Array.isArray(issue.affected_columns) || issue.affected_columns.length === 0) {
      return 'None';
    }
    
    // Manejar diferentes formatos de affected_columns
    return issue.affected_columns.map(col => {
      if (typeof col === 'string') {
        return col;
      } else if (typeof col === 'object' && col !== null) {
        return col.column || 'Unknown column';
      } else {
        return 'Unknown';
      }
    }).join(', ');
  };

  const filteredIssues = issues.filter(issue => {
    // Filter by severity
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) {
      return false;
    }
    
    // Filter by metric
    if (filterMetric !== 'all') {
      const metricIdStr = String(issue.metric_id);
      if (metricIdStr !== filterMetric) {
        return false;
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const descriptionMatch = issue.description.toLowerCase().includes(searchLower);
      const columnsMatch = issue.affected_columns ? 
        issue.affected_columns.some(col => col.column.toLowerCase().includes(searchLower)) : 
        false;
      
      return descriptionMatch || columnsMatch;
    }
    
    return true;
  });

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Data Quality Issues
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="severity-filter-label">Severity</InputLabel>
              <Select
                labelId="severity-filter-label"
                id="severity-filter"
                value={filterSeverity}
                label="Severity"
                onChange={(e) => setFilterSeverity(e.target.value)}
                startAdornment={
                  <FilterListIcon fontSize="small" sx={{ mr: 1, color: '#555555' }} />
                }
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="metric-filter-label">Metric</InputLabel>
              <Select
                labelId="metric-filter-label"
                id="metric-filter"
                value={filterMetric}
                label="Metric"
                onChange={(e) => setFilterMetric(e.target.value)}
                startAdornment={
                  <FilterListIcon fontSize="small" sx={{ mr: 1, color: '#555555' }} />
                }
              >
                <MenuItem value="all">All Metrics</MenuItem>
                {metrics.map((metric) => (
                  <MenuItem key={metric.id} value={String(metric.id)}>
                    {metric.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {filteredIssues.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table aria-label="issues table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '40%' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Affected Columns</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredIssues.map((issue) => (
                  <TableRow key={issue.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getSeverityIcon(issue.severity)}
                        <Chip
                          label={issue.severity.toUpperCase()}
                          size="small"
                          sx={{
                            ml: 1,
                            backgroundColor: `${getSeverityColor(issue.severity)}20`,
                            color: getSeverityColor(issue.severity),
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      {getMetricName(issue.metric_id, issue.metric_name)}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {issue.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {getAffectedColumnsText(issue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSelectedIssue(issue)}
                        sx={{
                          borderColor: '#00B37E',
                          color: '#00B37E',
                          '&:hover': {
                            borderColor: '#00A070',
                            backgroundColor: 'rgba(0, 179, 126, 0.04)',
                          },
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed #CCCCCC' }}>
            <Typography variant="body1" sx={{ color: '#555555' }}>
              {issues.length > 0
                ? 'No issues match your current filters.'
                : 'No issues found in the latest evaluation.'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Issue Detail Dialog */}
      <Dialog
        open={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            '& .MuiTypography-root': {
              fontSize: '1.25rem',
              fontWeight: 600
            }
          }}
        >
          Issue details
          <IconButton onClick={() => setSelectedIssue(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedIssue && <IssueDetail issue={selectedIssue} />}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IssueList;
