import React from 'react';
import Head from 'next/head';

// Extremadamente simple sin ninguna dependencia externa
export default function DashboardUltraSimple() {
  return (
    <>
      <Head>
        <title>Dashboard - Data Quality Platform</title>
      </Head>
      <div style={{ 
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{ color: '#1A1A1A', marginBottom: '20px' }}>Dashboard</h1>
        <p style={{ color: '#555555', marginBottom: '30px' }}>
          Bienvenido a la plataforma de calidad de datos para proyectos de IA
        </p>
        
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#1A1A1A', marginBottom: '15px' }}>Proyectos</h2>
          
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '15px',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ color: '#1A1A1A', marginTop: 0 }}>Proyecto de ejemplo 1</h3>
            <p style={{ color: '#555555' }}>Evaluación de calidad de datos para modelo de clasificación</p>
            <a href="/projects/1" style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#00B37E',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              marginTop: '10px'
            }}>Ver detalles</a>
          </div>
          
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '15px',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ color: '#1A1A1A', marginTop: 0 }}>Proyecto de ejemplo 2</h3>
            <p style={{ color: '#555555' }}>Evaluación de calidad de datos para modelo de regresión</p>
            <a href="/projects/2" style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#00B37E',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              marginTop: '10px'
            }}>Ver detalles</a>
          </div>
          
          <a href="/projects/new" style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#00B37E',
            color: 'white',
            borderRadius: '4px',
            textDecoration: 'none',
            marginTop: '20px',
            fontWeight: 'bold'
          }}>Crear nuevo proyecto</a>
        </div>
      </div>
    </>
  );
}
