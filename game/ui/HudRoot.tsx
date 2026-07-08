"use client";

import { useEffect, useRef } from "react";
import { gameStore, useGameStore } from "@/game/core/gameStore";

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LinkCounter() {
  const link = useGameStore((s) => s.link);
  const barRef = useRef<HTMLDivElement>(null);

  // the drain bar animates at 60fps — transient subscription straight to the
  // DOM so nothing re-renders
  useEffect(() => {
    return gameStore.subscribe((state) => {
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${state.linkTimer01})`;
      }
    });
  }, []);

  if (link < 2) return null;
  return (
    <div className="hud-link" key={link}>
      <span className="hud-link-num">{link}</span>
      <span className="hud-link-label">LINK</span>
      <div className="hud-link-bar">
        <div ref={barRef} className="hud-link-bar-fill" />
      </div>
    </div>
  );
}

export function HudRoot() {
  const phase = useGameStore((s) => s.phase);
  const score = useGameStore((s) => s.score);
  const chips = useGameStore((s) => s.chips);
  const chipsRequired = useGameStore((s) => s.chipsRequired);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const boostMeter = useGameStore((s) => s.boostMeter);
  const goalUnlocked = useGameStore((s) => s.goalUnlocked);
  const bossActive = useGameStore((s) => s.bossActive);
  const bossHitsLeft = useGameStore((s) => s.bossHitsLeft);

  if (phase === "title") return null;

  return (
    <div className="hud">
      {bossActive ? (
        <div className="boss-pips" aria-label="serpent health">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`boss-pip${i < bossHitsLeft ? " boss-pip-filled" : ""}`} />
          ))}
        </div>
      ) : (
        <div className="hud-chips">
          <svg viewBox="0 0 20 20" className="hud-chip-icon" aria-hidden>
            <path d="M10 1 L18 10 L10 19 L2 10 Z" fill="#4ab8ff" stroke="#bfe6ff" strokeWidth="1" />
          </svg>
          <span>
            {Math.min(chips, chipsRequired)}/{chipsRequired}
          </span>
          {goalUnlocked ? <span className="hud-goal-hint">GOAL OPEN — fly the gate!</span> : null}
        </div>
      )}
      {bossActive ? (
        <div className="boss-banner" key="nightmare">
          NIGHTMARE
        </div>
      ) : null}
      <div className={`hud-timer${timeLeft < 20 ? " hud-timer-low" : ""}`}>
        {formatTime(timeLeft)}
      </div>
      <div className="hud-score">{score.toLocaleString()}</div>
      <LinkCounter />
      <div className="hud-boost">
        <div className="hud-boost-fill" style={{ width: `${Math.round(boostMeter * 100)}%` }} />
      </div>
    </div>
  );
}
