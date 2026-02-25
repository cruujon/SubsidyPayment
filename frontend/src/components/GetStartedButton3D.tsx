// @ts-nocheck
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import {
  GET_STARTED_BUTTON_ARIA_LABEL,
  GET_STARTED_BUTTON_BASE_CLASS,
  GET_STARTED_BUTTON_CANVAS_CLASS,
  GET_STARTED_BUTTON_LABEL,
  GET_STARTED_BUTTON_LABEL_CLASS,
  GET_STARTED_CANVAS_CAMERA,
  GET_STARTED_CANVAS_DPR,
  GET_STARTED_CANVAS_GL
} from "../utils/contants";
import { hoveredRotationX, hoveredScale, mergeClassName } from "../utils/helpers";
import type { ButtonShapeProps, GetStartedButton3DProps } from "../utils/types";

/**
 * ButtonShape Component
 * @param param0 
 * @returns 
 */
function ButtonShape({ isHovered }: ButtonShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.6;
    meshRef.current.rotation.x = hoveredRotationX(meshRef.current.rotation.x, isHovered);
    const s = hoveredScale(isHovered);
    meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.7, 0.7, 0.35, 24]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#4A9EFF"
        emissiveIntensity={isHovered ? 0.32 : 0.16}
        metalness={0.4}
        roughness={0.35}
      />
    </mesh>
  );
}

/**
 * GetStartedButton3D Component
 * @param param0 
 * @returns 
 */
export function GetStartedButton3D({
  onClick,
  className = "",
}: GetStartedButton3DProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={mergeClassName(GET_STARTED_BUTTON_BASE_CLASS, className)}
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-label={GET_STARTED_BUTTON_ARIA_LABEL}
    >
      <span className={GET_STARTED_BUTTON_LABEL_CLASS}>{GET_STARTED_BUTTON_LABEL}</span>
      <div className={GET_STARTED_BUTTON_CANVAS_CLASS}>
        <Canvas
          camera={GET_STARTED_CANVAS_CAMERA}
          dpr={GET_STARTED_CANVAS_DPR}
          gl={GET_STARTED_CANVAS_GL}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 2, 3]} intensity={1.2} />
          <pointLight position={[-1, 1, 2]} intensity={0.5} color="#4A9EFF" />
          <Suspense fallback={null}>
            <ButtonShape isHovered={hovered} />
          </Suspense>
        </Canvas>
      </div>
    </button>
  );
}
