"use client";

import { useMemo } from "react";
import { OctahedronGeometry } from "three";
import { CollectibleInstances } from "@/game/renderer/CollectibleInstances";
import { useGame } from "@/game/renderer/GameContext";

export function ChipsView() {
  const game = useGame();
  const geometry = useMemo(() => new OctahedronGeometry(0.95, 0), []);
  return (
    <CollectibleInstances
      field={game.chips.field}
      geometry={geometry}
      color="#4ab8ff"
      emissive="#1560b0"
      orient="chip"
    />
  );
}
