// @ts-nocheck
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import {
  LANDING_BACKGROUND_CLASS_NAME,
  LANDING_BACKGROUND_COLOR,
  LANDING_CANVAS_CAMERA,
  LANDING_CANVAS_DPR,
  LANDING_CANVAS_GL
} from "../utils/contants";
import { ambientRotationX } from "../utils/helpers";

/**
 * AmbientShape Component
 * @returns 
 */
function AmbientShape() {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
      groupRef.current.rotation.x = ambientRotationX(state.clock.elapsedTime);
    }
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[0, 0, -3]}>
        <torusGeometry args={[2.2, 0.6, 32, 64]} />
        <meshStandardMaterial
          color="#0d1117"
          emissive="#4A9EFF"
          emissiveIntensity={0.12}
          transparent
          opacity={0.48}
          wireframe
        />
      </mesh>
      <mesh position={[1.5, 0.8, -4]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color="#0a0a0f"
          emissive="#79F8C6"
          emissiveIntensity={0.07}
          transparent
          opacity={0.32}
          wireframe
        />
      </mesh>
      <mesh position={[-1.2, -0.5, -3.5]}>
        <torusKnotGeometry args={[0.8, 0.25, 64, 8]} />
        <meshStandardMaterial
          color="#0d1117"
          emissive="#7ab8ff"
          emissiveIntensity={0.10}
          transparent
          opacity={0.38}
          wireframe
        />
      </mesh>
    </group>
  );
}

/**
 * LandingBackground3D Component
 * @returns 
 */
export function LandingBackground3D() {
  return (
    <div className={LANDING_BACKGROUND_CLASS_NAME} aria-hidden>
      <Canvas
        camera={LANDING_CANVAS_CAMERA}
        dpr={LANDING_CANVAS_DPR}
        gl={LANDING_CANVAS_GL}
      >
        <color attach="background" args={[LANDING_BACKGROUND_COLOR]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.3} />
        <pointLight position={[-3, 2, 2]} intensity={0.2} color="#4A9EFF" />
        <pointLight position={[3, -1, 2]} intensity={0.15} color="#79F8C6" />
        <AmbientShape />
      </Canvas>
    </div>
  );
}
