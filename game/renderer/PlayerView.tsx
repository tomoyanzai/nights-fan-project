"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useGame } from "./GameContext";

/**
 * Placeholder player visual (capsule nose-forward) until the procedural
 * character lands. Reads the interpolated transform from the player system —
 * no React state, no logic.
 */
export function PlayerView() {
  const game = useGame();
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    game.player.writeRenderTransform(group, game.loop.alpha);
  });

  return (
    <group ref={groupRef}>
      {/* capsule length axis is Y; rotate so the nose points along local +Z */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.45, 1.2, 8, 16]} />
        <meshStandardMaterial color="#d24bd2" emissive="#4a1a5c" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 1.1]}>
        <coneGeometry args={[0.3, 0.6, 12]} />
        <meshStandardMaterial color="#ffd76a" emissive="#7a5a1a" roughness={0.4} />
      </mesh>
    </group>
  );
}
