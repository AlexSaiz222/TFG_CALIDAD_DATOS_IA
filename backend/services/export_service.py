"""
Service for exporting evaluation results in different formats.
"""
import io
import json
import csv
import pandas as pd
from datetime import datetime
from flask import send_file

from models.evaluation import Evaluation
from models.dataset import Dataset

class ExportService:
    """Service for exporting evaluation results in different formats"""
    
    def export_evaluation(self, evaluation_id, format='json'):
        """
        Export evaluation results in the specified format
        
        Args:
            evaluation_id: ID of the evaluation to export
            format: Format to export (json, csv, html)
            
        Returns:
            Flask response with the exported file
        """
        # Get evaluation from database
        evaluation = Evaluation.query.get(evaluation_id)
        if not evaluation:
            raise ValueError(f"Evaluation with ID {evaluation_id} not found")
            
        # Get dataset information
        dataset = Dataset.query.get(evaluation.dataset_id)
        if not dataset:
            raise ValueError(f"Dataset with ID {evaluation.dataset_id} not found")
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename_base = f"evaluation_{evaluation_id}_{timestamp}"
        
        # Export in the requested format
        if format.lower() == 'json':
            return self._export_json(evaluation, dataset, filename_base)
        elif format.lower() == 'csv':
            return self._export_csv(evaluation, dataset, filename_base)
        elif format.lower() == 'html':
            return self._export_html(evaluation, dataset, filename_base)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_json(self, evaluation, dataset, filename_base):
        """Export evaluation results as JSON"""
        # Prepare data structure
        export_data = {
            "evaluation": {
                "id": evaluation.id,
                "dataset_id": evaluation.dataset_id,
                "dataset_name": dataset.name,
                "status": evaluation.status,
                "quality_score": float(evaluation.quality_score) if evaluation.quality_score else None,
                "created_at": evaluation.created_at.isoformat() if evaluation.created_at else None,
                "completed_at": evaluation.completed_at.isoformat() if evaluation.completed_at else None,
                "results": evaluation.results
            }
        }
        
        # Convert to JSON
        json_data = json.dumps(export_data, indent=2, ensure_ascii=False)
        
        # Create in-memory file
        buffer = io.BytesIO()
        buffer.write(json_data.encode('utf-8'))
        buffer.seek(0)
        
        # Return file for download
        return send_file(
            buffer,
            mimetype='application/json',
            as_attachment=True,
            download_name=f"{filename_base}.json"
        )
    
    def _export_csv(self, evaluation, dataset, filename_base):
        """Export evaluation results as CSV"""
        # Create in-memory file
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        
        # Write header
        writer.writerow([
            "Evaluation ID", "Dataset", "Quality Score", "Status", 
            "Created At", "Completed At"
        ])
        
        # Write basic info
        writer.writerow([
            evaluation.id,
            dataset.name,
            float(evaluation.quality_score) if evaluation.quality_score else "",
            evaluation.status,
            evaluation.created_at.isoformat() if evaluation.created_at else "",
            evaluation.completed_at.isoformat() if evaluation.completed_at else ""
        ])
        
        # Add separator
        writer.writerow([])
        writer.writerow(["Metric Results"])
        writer.writerow(["Metric", "Score", "Status"])
        
        # Add metric results
        if evaluation.results and 'overall' in evaluation.results:
            overall = evaluation.results['overall']
            for key, value in overall.items():
                if key not in ['quality_score', 'metrics_processed']:
                    writer.writerow([key, value, self._get_status_for_score(value)])
        
        # Add column metrics if available
        if evaluation.results and 'column_metrics' in evaluation.results:
            writer.writerow([])
            writer.writerow(["Column Metrics"])
            
            column_metrics = evaluation.results['column_metrics']
            # First row with column names
            header_row = ["Metric"]
            for column in column_metrics.keys():
                header_row.append(column)
            writer.writerow(header_row)
            
            # Get all possible metrics
            all_metrics = set()
            for column, metrics in column_metrics.items():
                all_metrics.update(metrics.keys())
            
            # Write each metric row
            for metric in sorted(all_metrics):
                row = [metric]
                for column in column_metrics.keys():
                    if metric in column_metrics[column]:
                        value = column_metrics[column][metric]
                        if isinstance(value, dict):
                            # For complex metrics like histogram, just indicate it's available
                            row.append("Available")
                        else:
                            row.append(str(value))
                    else:
                        row.append("")
                writer.writerow(row)
        
        # Convert to bytes and return
        buffer.seek(0)
        bytes_buffer = io.BytesIO()
        bytes_buffer.write(buffer.getvalue().encode('utf-8'))
        bytes_buffer.seek(0)
        
        return send_file(
            bytes_buffer,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f"{filename_base}.csv"
        )
    
    def _export_html(self, evaluation, dataset, filename_base):
        """Export evaluation results as HTML"""
        # Create basic HTML structure
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Evaluation Report - {dataset.name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1A1A1A; }}
                .container {{ max-width: 1200px; margin: 0 auto; }}
                h1, h2, h3 {{ color: #1A1A1A; }}
                .header {{ background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .summary {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
                .summary-box {{ flex: 1; margin: 0 10px; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
                .quality-score {{ background-color: #00B37E; color: white; text-align: center; }}
                .quality-score h2 {{ color: white; margin: 0; font-size: 2.5em; }}
                table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f5f5f5; }}
                .excellent {{ color: #00B37E; }}
                .good {{ color: #00B37E; }}
                .acceptable {{ color: #FFB800; }}
                .poor {{ color: #E5484D; }}
                .footer {{ text-align: center; margin-top: 40px; color: #555555; font-size: 0.8em; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Data Quality Evaluation Report</h1>
                    <p>Dataset: <strong>{dataset.name}</strong></p>
                    <p>Evaluation ID: {evaluation.id}</p>
                    <p>Date: {evaluation.completed_at.strftime('%Y-%m-%d %H:%M:%S') if evaluation.completed_at else 'N/A'}</p>
                </div>
                
                <div class="summary">
                    <div class="summary-box">
                        <h3>Dataset Information</h3>
                        <p>Rows: {dataset.row_count or 'N/A'}</p>
                        <p>Columns: {dataset.column_count or 'N/A'}</p>
                    </div>
                    <div class="summary-box quality-score">
                        <h3>Quality Score</h3>
                        <h2>{evaluation.quality_score * 100:.1f}%</h2>
                        <p>{self._get_status_for_score(float(evaluation.quality_score) if evaluation.quality_score else 0)}</p>
                    </div>
                    <div class="summary-box">
                        <h3>Evaluation Status</h3>
                        <p>Status: <strong>{evaluation.status.upper()}</strong></p>
                        <p>Duration: {self._calculate_duration(evaluation)}</p>
                    </div>
                </div>
                
                <h2>Metric Results</h2>
                <table>
                    <tr>
                        <th>Metric</th>
                        <th>Score</th>
                        <th>Status</th>
                    </tr>
        """
        
        # Add metric results
        if evaluation.results and 'overall' in evaluation.results:
            overall = evaluation.results['overall']
            for key, value in overall.items():
                if key not in ['quality_score', 'metrics_processed']:
                    try:
                        score = float(value)
                        status = self._get_status_for_score(score)
                        status_class = status.lower()
                        html += f"""
                        <tr>
                            <td>{key.capitalize()}</td>
                            <td>{score:.2f}</td>
                            <td class="{status_class}">{status}</td>
                        </tr>
                        """
                    except (ValueError, TypeError):
                        # Skip non-numeric values
                        pass
        
        # Close metric table and add column metrics if available
        html += """
                </table>
                
                <h2>Column Metrics</h2>
        """
        
        if evaluation.results and 'column_metrics' in evaluation.results:
            column_metrics = evaluation.results['column_metrics']
            
            # Create a table for completeness
            html += """
                <h3>Completeness by Column</h3>
                <table>
                    <tr>
                        <th>Column</th>
                        <th>Completeness</th>
                        <th>Status</th>
                    </tr>
            """
            
            for column, metrics in column_metrics.items():
                if 'completeness' in metrics:
                    score = metrics['completeness']
                    status = self._get_status_for_score(score)
                    status_class = status.lower()
                    html += f"""
                    <tr>
                        <td>{column}</td>
                        <td>{score:.2f}</td>
                        <td class="{status_class}">{status}</td>
                    </tr>
                    """
            
            html += """
                </table>
                
                <h3>Uniqueness by Column</h3>
                <table>
                    <tr>
                        <th>Column</th>
                        <th>Uniqueness</th>
                        <th>Status</th>
                    </tr>
            """
            
            for column, metrics in column_metrics.items():
                if 'uniqueness' in metrics:
                    score = metrics['uniqueness']
                    status = self._get_status_for_score(score)
                    status_class = status.lower()
                    html += f"""
                    <tr>
                        <td>{column}</td>
                        <td>{score:.2f}</td>
                        <td class="{status_class}">{status}</td>
                    </tr>
                    """
            
            html += """
                </table>
            """
        
        # Add footer and close HTML
        html += """
                <div class="footer">
                    <p>Generated by Data Quality Evaluation Platform</p>
                    <p>© 2025 All Rights Reserved</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Convert to bytes and return
        buffer = io.BytesIO()
        buffer.write(html.encode('utf-8'))
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='text/html',
            as_attachment=True,
            download_name=f"{filename_base}.html"
        )
    
    def _get_status_for_score(self, score):
        """Get status label based on score"""
        if score >= 0.98:
            return "Excellent"
        elif score >= 0.95:
            return "Good"
        elif score >= 0.90:
            return "Acceptable"
        else:
            return "Poor"
    
    def _calculate_duration(self, evaluation):
        """Calculate duration of evaluation"""
        if evaluation.completed_at and evaluation.started_at:
            duration = evaluation.completed_at - evaluation.started_at
            seconds = duration.total_seconds()
            if seconds < 60:
                return f"{int(seconds)} seconds"
            elif seconds < 3600:
                return f"{int(seconds / 60)} minutes {int(seconds % 60)} seconds"
            else:
                hours = int(seconds / 3600)
                minutes = int((seconds % 3600) / 60)
                return f"{hours} hours {minutes} minutes"
        return "N/A"
