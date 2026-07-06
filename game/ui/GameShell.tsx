"use client";

import dynamic from "next/dynamic";

// The whole game tree (canvas + DOM overlay sharing one Game instance) is
// client-only. Next 15 only allows `ssr: false` inside a client component,
// hence this shell.
const GameRoot = dynamic(() => import("./GameRoot").then((m) => m.GameRoot), {
  ssr: false,
  loading: () => <div className="game-root game-loading">entering the dream…</div>,
});

export function GameShell() {
  return <GameRoot />;
}
