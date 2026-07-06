"use client";

import { SplineVisualizer } from "@/game/debug/SplineVisualizer";
import { CameraController } from "@/game/camera/CameraController";
import { RingsView } from "@/game/gameplay/rings/RingsView";
import { ChipsView } from "@/game/gameplay/bluechips/ChipsView";
import { PlayerView } from "./PlayerView";
import { Particles } from "./Particles";

const showDebug =
  process.env.NODE_ENV === "development" ||
  (typeof window !== "undefined" && window.location.search.includes("debug"));

export function SceneRoot() {
  return (
    <>
      <hemisphereLight args={["#b9a7ff", "#3c5c3a", 1.1]} />
      <directionalLight position={[10, 40, 10]} intensity={1.4} color="#ffe0b8" />
      <PlayerView />
      <RingsView />
      <ChipsView />
      <Particles />
      <CameraController />
      {showDebug ? <SplineVisualizer /> : null}
    </>
  );
}
