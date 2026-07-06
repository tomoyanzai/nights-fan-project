"use client";

import { useGame } from "@/game/renderer/GameContext";

export function PauseScreen() {
  const game = useGame();
  return (
    <div className="screen screen-pause">
      <h2 className="screen-heading">dozing…</h2>
      <div className="menu-col">
        <button className="dream-button" onClick={() => game.setPaused(false)}>
          Resume <kbd>Esc</kbd>
        </button>
        <button className="dream-button" onClick={() => game.startRun()}>
          Restart <kbd>R</kbd>
        </button>
        <button className="dream-button" onClick={() => game.quitToTitle()}>
          Wake Up <kbd>Q</kbd>
        </button>
      </div>
    </div>
  );
}
