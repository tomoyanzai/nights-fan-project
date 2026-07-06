"use client";

import { useGame } from "@/game/renderer/GameContext";

export function TitleScreen() {
  const game = useGame();
  return (
    <div className="screen screen-title">
      <h1 className="title-logo">Dreamflight</h1>
      <p className="title-sub">a browser homage to flying through dreams</p>
      <button
        className="dream-button title-start"
        onClick={() => {
          game.events.emit({ type: "ui:select" });
          game.startRun();
        }}
      >
        Press Enter to Dream
      </button>
      <div className="title-controls">
        <span>← → fly</span>
        <span>↑ ↓ climb / dive</span>
        <span>Space / Shift — drill dash</span>
        <span>fly a loop around things to paraloop them</span>
      </div>
      <p className="title-footnote">
        an educational fan recreation inspired by NiGHTS into Dreams — all assets procedural &
        original
      </p>
    </div>
  );
}
