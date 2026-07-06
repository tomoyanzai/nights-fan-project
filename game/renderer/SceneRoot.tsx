"use client";

import { SplineVisualizer } from "@/game/debug/SplineVisualizer";
import { CameraController } from "@/game/camera/CameraController";
import { RingsView } from "@/game/gameplay/rings/RingsView";
import { ChipsView } from "@/game/gameplay/bluechips/ChipsView";
import { PlayerView } from "./PlayerView";
import { Particles } from "./Particles";
import { useGame } from "./GameContext";

const showDebug =
  process.env.NODE_ENV === "development" ||
  (typeof window !== "undefined" && window.location.search.includes("debug"));

export function SceneRoot() {
  const game = useGame();
  const Environment = game.stage.Environment;
  return (
    <>
      <Environment />
      <PlayerView />
      <RingsView />
      <ChipsView />
      <Particles />
      <CameraController />
      {showDebug ? <SplineVisualizer /> : null}
    </>
  );
}
