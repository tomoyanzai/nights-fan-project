"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { Vector3 } from "three";
import { useGame } from "./GameContext";
import { SplineVisualizer } from "@/game/debug/SplineVisualizer";

const showDebug =
  process.env.NODE_ENV === "development" ||
  (typeof window !== "undefined" && window.location.search.includes("debug"));

/**
 * Temporary scene while systems come online: a marker sphere sweeps along the
 * track at constant speed (visually verifying arc-length parameterization)
 * and OrbitControls let us inspect the course + frame triads.
 */
export function SceneRoot() {
  const game = useGame();
  const markerRef = useRef<Mesh>(null);
  const posRef = useRef(new Vector3());
  useThree(); // keep hook order stable when controls unmount later

  useFrame(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const t = game.renderTime(game.loop.alpha);
    game.track.worldPos(t * 20, 0, posRef.current); // 20 m/s sweep
    marker.position.copy(posRef.current);
  });

  return (
    <>
      <hemisphereLight args={["#b9a7ff", "#3c5c3a", 1.1]} />
      <directionalLight position={[10, 40, 10]} intensity={1.4} color="#ffe0b8" />
      <mesh ref={markerRef}>
        <sphereGeometry args={[1.5, 24, 16]} />
        <meshStandardMaterial color="#d24bd2" emissive="#661a66" />
      </mesh>
      {showDebug ? <SplineVisualizer /> : null}
      <OrbitControls target={[0, 20, 0]} />
    </>
  );
}
