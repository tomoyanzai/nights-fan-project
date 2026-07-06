"use client";

import { button, useControls } from "leva";
import { CAMERA, COMBO, FLIGHT, PARALOOP } from "@/game/core/constants";
import { useGame } from "@/game/renderer/GameContext";

export function isDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && window.location.search.includes("debug"))
  );
}

/**
 * Leva tuning panels. onChange writes straight into the mutable tuning
 * objects that systems read every step — live feel-tuning, no recompiles.
 */
export function DebugPanel() {
  const game = useGame();

  useControls("flight", {
    maxSpeed: { value: FLIGHT.maxSpeed, min: 8, max: 60, onChange: (v: number) => (FLIGHT.maxSpeed = v) },
    accel: { value: FLIGHT.accel, min: 10, max: 140, onChange: (v: number) => (FLIGHT.accel = v) },
    dragS: { value: FLIGHT.dragS, min: 0.05, max: 2, onChange: (v: number) => (FLIGHT.dragS = v) },
    dragY: { value: FLIGHT.dragY, min: 0.05, max: 2, onChange: (v: number) => (FLIGHT.dragY = v) },
    gravityBias: { value: FLIGHT.gravityBias, min: 0, max: 6, onChange: (v: number) => (FLIGHT.gravityBias = v) },
    boostSpeedMult: { value: FLIGHT.boostSpeedMult, min: 1.2, max: 4, onChange: (v: number) => (FLIGHT.boostSpeedMult = v) },
    boostDrainTime: { value: FLIGHT.boostDrainTime, min: 0.5, max: 8, onChange: (v: number) => (FLIGHT.boostDrainTime = v) },
    bankTurnGain: { value: FLIGHT.bankTurnGain, min: 0, max: 6, onChange: (v: number) => (FLIGHT.bankTurnGain = v) },
  });

  useControls("camera", {
    omegaS: { value: CAMERA.omegaS, min: 0.5, max: 12, onChange: (v: number) => (CAMERA.omegaS = v) },
    omegaY: { value: CAMERA.omegaY, min: 0.5, max: 12, onChange: (v: number) => (CAMERA.omegaY = v) },
    omegaUp: { value: CAMERA.omegaUp, min: 0.5, max: 10, onChange: (v: number) => (CAMERA.omegaUp = v) },
    lookAheadGain: { value: CAMERA.lookAheadGain, min: 0, max: 1.5, onChange: (v: number) => (CAMERA.lookAheadGain = v) },
    sideDist: { value: CAMERA.sideDist, min: 6, max: 30, onChange: (v: number) => (CAMERA.sideDist = v) },
    fovBase: { value: CAMERA.fovBase, min: 35, max: 90, onChange: (v: number) => (CAMERA.fovBase = v) },
    fovBoost: { value: CAMERA.fovBoost, min: 40, max: 110, onChange: (v: number) => (CAMERA.fovBoost = v) },
  });

  useControls("combo+paraloop", {
    linkWindow: { value: COMBO.linkWindow, min: 0.5, max: 5, onChange: (v: number) => (COMBO.linkWindow = v) },
    minArea: { value: PARALOOP.minArea, min: 2, max: 120, onChange: (v: number) => (PARALOOP.minArea = v) },
    crumbSpacing: { value: PARALOOP.crumbSpacing, min: 0.2, max: 2, onChange: (v: number) => (PARALOOP.crumbSpacing = v) },
  });

  useControls("cheats", {
    timeScale: { value: 1, min: 0.1, max: 4, onChange: (v: number) => (game.loop.timeScale = v) },
    unlockGoal: button(() => game.mare.debugUnlockGoal()),
    restart: button(() => game.startRun()),
  });

  return null;
}
