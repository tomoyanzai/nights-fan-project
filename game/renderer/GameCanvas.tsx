"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Game } from "@/game/core/game";
import { GameContext } from "./GameContext";
import { SceneRoot } from "./SceneRoot";

const DREAM_CLEAR_COLOR = "#3b2a63";

declare global {
  interface Window {
    __game?: Game;
  }
}

export function GameCanvas() {
  const [game] = useState(() => Game.create());

  useEffect(() => {
    game.start();
    if (process.env.NODE_ENV === "development") {
      window.__game = game;
    }
    return () => {
      game.dispose();
      if (window.__game === game) delete window.__game;
    };
  }, [game]);

  return (
    <GameContext.Provider value={game}>
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 0.1, far: 1000, position: [0, 5, 20] }}
        onCreated={({ gl }) => {
          gl.setClearColor(DREAM_CLEAR_COLOR);
        }}
      >
        <SceneRoot />
      </Canvas>
    </GameContext.Provider>
  );
}
