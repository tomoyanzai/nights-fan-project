"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/game/core/gameStore";
import { useGame } from "@/game/renderer/GameContext";
import { TitleScreen } from "./screens/Title";
import { PauseScreen } from "./screens/Pause";
import { ResultsScreen } from "./screens/Results";

/** Renders the screen for the current phase and drives phase transitions. */
export function ScreenRouter() {
  const game = useGame();
  const phase = useGameStore((s) => s.phase);
  const [overlayKey, setOverlayKey] = useState(0);

  // dream-blink overlay on every phase change
  useEffect(() => {
    setOverlayKey((k) => k + 1);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (phase) {
        case "title":
          if (e.code === "Enter" || e.code === "Space") {
            game.events.emit({ type: "ui:select" });
            game.startRun();
          } else if (e.code === "KeyF") {
            game.events.emit({ type: "ui:select" });
            game.startRun("freerun");
          }
          break;
        case "flying":
          if (e.code === "Escape" || e.code === "KeyP") game.setPaused(true);
          break;
        case "paused":
          if (e.code === "Escape" || e.code === "KeyP" || e.code === "Enter") {
            game.events.emit({ type: "ui:select" });
            game.setPaused(false);
          } else if (e.code === "KeyQ") {
            game.quitToTitle();
          } else if (e.code === "KeyR") {
            game.startRun();
          }
          break;
        case "results":
          if (e.code === "Enter" || e.code === "KeyR") {
            game.events.emit({ type: "ui:select" });
            game.startRun();
          } else if (e.code === "KeyQ") {
            game.quitToTitle();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, phase]);

  return (
    <>
      {overlayKey > 1 ? <div key={overlayKey} className="dream-blink" /> : null}
      {phase === "title" ? <TitleScreen /> : null}
      {phase === "paused" ? <PauseScreen /> : null}
      {phase === "results" ? <ResultsScreen /> : null}
    </>
  );
}
