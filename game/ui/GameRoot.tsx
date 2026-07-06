"use client";

import { useEffect, useState } from "react";
import { Game } from "@/game/core/game";
import { springValley } from "@/game/stages/springValley";
import { GameContext } from "@/game/renderer/GameContext";
import { GameCanvas } from "@/game/renderer/GameCanvas";
import { useStats } from "@/game/debug/statsHook";
import { DebugPanel, isDebugEnabled } from "@/game/debug/DebugPanel";
import { HudRoot } from "./HudRoot";
import { ScreenRouter } from "./ScreenRouter";

declare global {
  interface Window {
    __game?: Game;
  }
}

export function GameRoot() {
  const [game] = useState(() => Game.create(springValley));
  const debug = isDebugEnabled();
  useStats(debug);

  useEffect(() => {
    game.start();
    if (process.env.NODE_ENV === "development" || debug) {
      window.__game = game;
    }
    return () => {
      game.dispose();
      if (window.__game === game) delete window.__game;
    };
  }, [game, debug]);

  return (
    <GameContext.Provider value={game}>
      <div className="game-root">
        <GameCanvas game={game} />
        <HudRoot />
        <ScreenRouter />
        {debug ? <DebugPanel /> : null}
      </div>
    </GameContext.Provider>
  );
}
