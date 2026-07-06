"use client";

import { Canvas } from "@react-three/fiber";

const DREAM_CLEAR_COLOR = "#3b2a63";

export function GameCanvas() {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 55, near: 0.1, far: 1000, position: [0, 5, 20] }}
      onCreated={({ gl }) => {
        gl.setClearColor(DREAM_CLEAR_COLOR);
      }}
    >
      {/* Scene content mounts here as systems come online. */}
    </Canvas>
  );
}
