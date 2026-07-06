"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { useGame } from "./GameContext";

/**
 * Placeholder scene proving the render pattern: the cube's rotation is a pure
 * function of *game* time (owned by the fixed-timestep loop), read via ref in
 * useFrame with interpolation — no React state per frame.
 */
export function SceneRoot() {
  const game = useGame();
  const cubeRef = useRef<Mesh>(null);

  useFrame(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    const t = game.renderTime(game.loop.alpha);
    cube.rotation.set(t * 0.7, t * 1.1, 0);
  });

  return (
    <>
      <hemisphereLight args={["#b9a7ff", "#3c5c3a", 1.1]} />
      <directionalLight position={[10, 20, 10]} intensity={1.4} color="#ffe0b8" />
      <mesh ref={cubeRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#d24bd2" emissive="#3b1a4a" />
      </mesh>
    </>
  );
}
