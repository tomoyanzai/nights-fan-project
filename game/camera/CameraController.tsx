"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useGame } from "@/game/renderer/GameContext";

/** Thin bridge: copies the CameraRig's interpolated state onto the R3F camera. */
export function CameraController() {
  const game = useGame();
  const scratchRef = useRef(new Vector3());

  useFrame(({ camera }) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    game.cameraRig.writeToCamera(camera, game.loop.alpha, scratchRef.current);
  });

  return null;
}
