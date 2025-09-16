import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Issue, AffectedColumn } from '../../types';

interface IssueDetailProps {
  issue: Issue;
}

const IssueDetail: React.FC<IssueDetailProps> = ({ issue }) => {
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

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 2,
        border: '1px solid #EEEEEE',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {getSeverityIcon(issue.severity)}
        <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
          {issue.description}
        </Typography>
        <Chip
          label={issue.severity.toUpperCase()}
          size="small"
          sx={{
            ml: 2,
            backgroundColor: `${getSeverityColor(issue.severity)}20`,
            color: getSeverityColor(issue.severity),
            fontWeight: 600,
          }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#555555' }}>
            Metric
          </Typography>
          <Typography variant="body1">
            {issue.metric_name || (issue.metric_id ? `Metric ID: ${issue.metric_id}` : 'Unknown')}
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#555555' }}>
            Created
          </Typography>
          <Typography variant="body1">
            {issue.created_at && !isNaN(new Date(issue.created_at).getTime()) 
              ? new Date(issue.created_at).toLocaleString() 
              : issue.timestamp && !isNaN(new Date(issue.timestamp).getTime())
                ? new Date(issue.timestamp).toLocaleString()
                : issue.evaluation_id 
                  ? `Evaluación #${issue.evaluation_id}` 
                  : 'Fecha no disponible'}
          </Typography>
        </Grid>
      </Grid>

      {issue.affected_columns && Array.isArray(issue.affected_columns) && issue.affected_columns.length > 0 && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
            Affected Columns
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                  {issue.affected_columns.some(col => col.null_rate !== undefined) && (
                    <TableCell sx={{ fontWeight: 600 }}>Null Rate</TableCell>
                  )}
                  {issue.affected_columns.some(col => col.duplicate_count !== undefined) && (
                    <TableCell sx={{ fontWeight: 600 }}>Duplicates</TableCell>
                  )}
                  {issue.affected_columns.some(col => col.outlier_count !== undefined) && (
                    <TableCell sx={{ fontWeight: 600 }}>Outliers</TableCell>
                  )}
                  {issue.affected_columns.some(col => col.invalid_count !== undefined) && (
                    <TableCell sx={{ fontWeight: 600 }}>Invalid Values</TableCell>
                  )}
                  {issue.affected_columns.some(col => col.uniqueness !== undefined) && (
                    <TableCell sx={{ fontWeight: 600 }}>Uniqueness</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {issue.affected_columns.map((column: any, index: number) => {
                  // Asegurarse de que column es un objeto
                  const columnObj = typeof column === 'object' ? column : { column: String(column) };
                  return (
                  <TableRow key={index}>
                    <TableCell>{columnObj.column || `Columna ${index + 1}`}</TableCell>
                    {issue.affected_columns!.some(col => col.null_rate !== undefined) && (
                      <TableCell>
                        {columnObj.null_rate !== undefined ? `${(columnObj.null_rate * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                    )}
                    {issue.affected_columns!.some(col => col.duplicate_count !== undefined) && (
                      <TableCell>
                        {columnObj.duplicate_count !== undefined ? columnObj.duplicate_count : '-'}
                      </TableCell>
                    )}
                    {issue.affected_columns!.some(col => col.outlier_count !== undefined) && (
                      <TableCell>
                        {columnObj.outlier_count !== undefined ? columnObj.outlier_count : '-'}
                      </TableCell>
                    )}
                    {issue.affected_columns!.some(col => col.invalid_count !== undefined) && (
                      <TableCell>
                        {columnObj.invalid_count !== undefined ? columnObj.invalid_count : '-'}
                      </TableCell>
                    )}
                    {issue.affected_columns!.some(col => col.uniqueness !== undefined) && (
                      <TableCell>
                        {columnObj.uniqueness !== undefined ? `${(columnObj.uniqueness * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                    )}
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {issue.affected_rows && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
            Affected Rows
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">
              {issue.affected_rows.count} rows affected
            </Typography>
          </Box>

          {issue.affected_rows.sample && issue.affected_rows.sample.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {Object.keys(issue.affected_rows.sample[0]).map((key) => (
                      <TableCell key={key} sx={{ fontWeight: 600 }}>
                        {key}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issue.affected_rows.sample.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Object.values(row).map((value: any, valueIndex) => (
                        <TableCell key={valueIndex}>
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {issue.details && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
            Additional Details
          </Typography>
          <Box sx={{ mb: 2 }}>
            {Object.entries(issue.details).map(([key, value]) => (
              <Box key={key} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#555555' }}>
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
                </Typography>
                <Typography variant="body2">
                  {Array.isArray(value) 
                    ? value.join(', ') 
                    : typeof value === 'object' 
                      ? JSON.stringify(value) 
                      : String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default IssueDetail;
