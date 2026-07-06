"use client";

import { useMemo } from "react";
import { TorusGeometry } from "three";
import { CollectibleInstances } from "@/game/renderer/CollectibleInstances";
import { useGame } from "@/game/renderer/GameContext";

export function RingsView() {
  const game = useGame();
  const geometry = useMemo(() => new TorusGeometry(2.2, 0.14, 10, 36), []);
  return (
    <CollectibleInstances
      field={game.rings.field}
      geometry={geometry}
      color="#ffd76a"
      emissive="#b8860b"
      orient="ring"
    />
  );
}
