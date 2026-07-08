"use client";

import { useGame } from "@/game/renderer/GameContext";

export function TitleScreen() {
  const game = useGame();
  return (
    <div className="screen screen-title">
      <h1 className="title-logo">Dreamflight</h1>
      <p className="title-sub">a browser homage to flying through dreams</p>
      <div className="menu-col">
        <button
          className="dream-button title-start"
          onClick={() => {
            game.events.emit({ type: "ui:select" });
            game.startRun();
          }}
        >
          Dream Run <kbd>Enter</kbd>
        </button>
        <button
          className="dream-button"
          onClick={() => {
            game.events.emit({ type: "ui:select" });
            game.startRun("freerun");
          }}
        >
          Free Flight <kbd>F</kbd>
        </button>
      </div>
      <p className="title-hint">
        Free Flight (F): no clock, no score — just the dream, wider skies, and music that answers
        your flight.
      </p>
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
