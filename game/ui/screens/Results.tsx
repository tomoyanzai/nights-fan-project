"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/game/core/gameStore";
import { useGame } from "@/game/renderer/GameContext";

/** Count-up animation without React re-renders: rAF writes into the DOM. */
function ScoreCountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const DURATION = 1200;
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - (1 - t) ** 3;
      if (ref.current) ref.current.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span ref={ref}>0</span>;
}

export function ResultsScreen() {
  const game = useGame();
  const score = useGameStore((s) => s.score);
  const rank = useGameStore((s) => s.rank);
  const bestLink = useGameStore((s) => s.bestLink);
  const chips = useGameStore((s) => s.chips);
  const resultsKind = useGameStore((s) => s.resultsKind);
  const cleared = resultsKind === "clear";

  return (
    <div className="screen screen-results">
      <h2 className="screen-heading">{cleared ? "Dream Clear!" : "Night Over…"}</h2>
      <div className="results-panel">
        <div className="results-row">
          <span>Score</span>
          <ScoreCountUp target={score} />
        </div>
        <div className="results-row">
          <span>Best Link</span>
          <span>{bestLink}</span>
        </div>
        <div className="results-row">
          <span>Blue Chips</span>
          <span>{chips}</span>
        </div>
        {cleared && rank ? (
          <div className={`results-rank results-rank-${rank}`}>{rank}</div>
        ) : null}
      </div>
      <div className="menu-col">
        <button className="dream-button" onClick={() => game.startRun()}>
          Dream Again <kbd>Enter</kbd>
        </button>
        <button className="dream-button" onClick={() => game.quitToTitle()}>
          Wake Up <kbd>Q</kbd>
        </button>
      </div>
    </div>
  );
}
