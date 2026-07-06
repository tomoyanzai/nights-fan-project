"use client";

import dynamic from "next/dynamic";

// The R3F canvas must never be server-rendered (it touches window/WebGL).
// Next 15 only allows `ssr: false` inside a client component, hence this shell.
const GameCanvas = dynamic(
  () => import("@/game/renderer/GameCanvas").then((m) => m.GameCanvas),
  { ssr: false },
);

export function GameShell() {
  return (
    <div className="game-root">
      <GameCanvas />
    </div>
  );
}
