"use client";

import { Canvas } from "@react-three/fiber";
import type { Game } from "@/game/core/game";
import { GameContext } from "./GameContext";
import { SceneRoot } from "./SceneRoot";

const DREAM_CLEAR_COLOR = "#3b2a63";

/**
 * R3F mounts its own reconciler root, so parent React context does not cross
 * the <Canvas> boundary — the game is re-provided inside.
 */
export function GameCanvas({ game }: { game: Game }) {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 55, near: 0.1, far: 2000, position: [0, 20, -160] }}
      onCreated={({ gl }) => {
        gl.setClearColor(DREAM_CLEAR_COLOR);
      }}
    >
      <GameContext.Provider value={game}>
        <SceneRoot />
      </GameContext.Provider>
    </Canvas>
  );
}
