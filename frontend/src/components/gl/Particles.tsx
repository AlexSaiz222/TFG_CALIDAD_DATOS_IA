import * as THREE from "three";
import { useMemo, useState, useRef } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";

import { DofPointsMaterial } from "./shaders/pointMaterial";
import { SimulationMaterial } from "./shaders/simulationMaterial";

interface ParticlesProps {
  speed?: number;
  aperture?: number;
  focus?: number;
  size?: number;
  noiseScale?: number;
  noiseIntensity?: number;
  timeScale?: number;
  pointSize?: number;
  opacity?: number;
  planeScale?: number;
  color?: string;
}

export function Particles({
  speed = 1.0,
  aperture = 1.79,
  focus = 3.8,
  size = 512,
  noiseScale = 0.6,
  noiseIntensity = 0.52,
  timeScale = 1.0,
  pointSize = 10.0,
  opacity = 0.8,
  planeScale = 10.0,
  color = "#FFFFFF",
  ...props
}: ParticlesProps) {
  // Reveal animation state
  const revealStartTime = useRef<number | null>(null);
  const [isRevealing, setIsRevealing] = useState(true);
  const revealDuration = 3.5; // seconds

  // Create simulation material with scale parameter
  const simulationMaterial = useMemo(() => {
    return new SimulationMaterial(planeScale);
  }, [planeScale]);

  const target = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  const dofPointsMaterial = useMemo(() => {
    const m = new DofPointsMaterial();
    m.uniforms.positions.value = target.texture;
    m.uniforms.initialPositions.value =
      simulationMaterial.uniforms.positions.value;
    // Set the color uniform
    const threeColor = new THREE.Color(color);
    m.uniforms.uColor.value = threeColor;
    return m;
  }, [simulationMaterial, color]);

  const [scene] = useState(() => new THREE.Scene());
  const [camera] = useState(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1)
  );
  const [positions] = useState(
    () =>
      new Float32Array([
        -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
      ])
  );
  const [uvs] = useState(
    () => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0])
  );

  const particles = useMemo(() => {
    const length = size * size;
    const particlesArray = new Float32Array(length * 3);
    for (let i = 0; i < length; i++) {
      const i3 = i * 3;
      particlesArray[i3 + 0] = (i % size) / size;
      particlesArray[i3 + 1] = i / size / size;
    }
    return particlesArray;
  }, [size]);

  useFrame((state) => {
    if (!dofPointsMaterial || !simulationMaterial) return;

    state.gl.setRenderTarget(target);
    state.gl.clear();
    // @ts-ignore
    state.gl.render(scene, camera);
    state.gl.setRenderTarget(null);

    const currentTime = state.clock.elapsedTime;

    // Initialize reveal start time on first frame
    if (revealStartTime.current === null) {
      revealStartTime.current = currentTime;
    }

    // Calculate reveal progress
    const revealElapsed = currentTime - revealStartTime.current;
    const revealProgress = Math.min(revealElapsed / revealDuration, 1.0);

    // Ease out the reveal animation
    const easedProgress = 1 - Math.pow(1 - revealProgress, 3);

    // Map progress to reveal factor (0 = fully hidden, higher values = more revealed)
    const revealFactor = easedProgress * 4.0;

    if (revealProgress >= 1.0 && isRevealing) {
      setIsRevealing(false);
    }

    dofPointsMaterial.uniforms.uTime.value = currentTime;
    dofPointsMaterial.uniforms.uFocus.value = focus;
    dofPointsMaterial.uniforms.uBlur.value = aperture;
    dofPointsMaterial.uniforms.uTransition.value = 0.0;

    simulationMaterial.uniforms.uTime.value = currentTime;
    simulationMaterial.uniforms.uNoiseScale.value = noiseScale;
    simulationMaterial.uniforms.uNoiseIntensity.value = noiseIntensity;
    simulationMaterial.uniforms.uTimeScale.value = timeScale * speed;

    // Update point material uniforms
    dofPointsMaterial.uniforms.uPointSize.value = pointSize;
    dofPointsMaterial.uniforms.uOpacity.value = opacity;
    dofPointsMaterial.uniforms.uRevealFactor.value = revealFactor;
    dofPointsMaterial.uniforms.uRevealProgress.value = easedProgress;
  });

  return (
    <>
      {createPortal(
        // @ts-ignore
        <mesh material={simulationMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[positions, 3]}
            />
            <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
          </bufferGeometry>
        </mesh>,
        // @ts-ignore
        scene
      )}
      {/* @ts-ignore */}
      <points material={dofPointsMaterial} {...props}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
      </points>
    </>
  );
}
