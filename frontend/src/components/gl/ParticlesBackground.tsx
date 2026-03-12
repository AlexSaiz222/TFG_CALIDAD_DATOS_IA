'use client';

import { Canvas } from "@react-three/fiber";
import { Particles } from "./Particles";

interface ParticlesBackgroundProps {
  color?: string;
  backgroundColor?: string;
}

export const ParticlesBackground = ({ 
  color = "#FFFFFF",
  backgroundColor = "#006B52"
}: ParticlesBackgroundProps) => {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      zIndex: 0 
    }}>
      <Canvas
        camera={{
          position: [1.26, 2.66, -1.82],
          fov: 50,
          near: 0.01,
          far: 300,
        }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[backgroundColor]} />
        <Particles
          speed={1.0}
          aperture={1.79}
          focus={3.8}
          size={512}
          noiseScale={0.6}
          noiseIntensity={0.52}
          timeScale={1.0}
          pointSize={10.0}
          opacity={0.8}
          planeScale={10.0}
          color={color}
        />
      </Canvas>
    </div>
  );
};

export default ParticlesBackground;
