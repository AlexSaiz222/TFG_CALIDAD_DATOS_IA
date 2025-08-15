// Extremely minimal dashboard to fix the r.reduce error
import React from 'react';

export default function Dashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <p>Welcome to the Data Quality Platform</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Projects</h2>
        <div style={{ 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3>Sample Project 1</h3>
          <a href="/projects/1" style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#00B37E',
            color: 'white',
            borderRadius: '4px',
            textDecoration: 'none',
            marginTop: '8px'
          }}>View Details</a>
        </div>
        
        <div style={{ 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3>Sample Project 2</h3>
          <a href="/projects/2" style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#00B37E',
            color: 'white',
            borderRadius: '4px',
            textDecoration: 'none',
            marginTop: '8px'
          }}>View Details</a>
        </div>
        
        <a href="/projects/new" style={{
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: '#00B37E',
          color: 'white',
          borderRadius: '4px',
          textDecoration: 'none',
          marginTop: '16px'
        }}>Create New Project</a>
      </div>
    </div>
  );
}
