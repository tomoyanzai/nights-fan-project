import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { GameMode, GamePhase, Rank, ResultsKind } from "./types";
import { MARE } from "./constants";

/**
 * UI-facing state only. Systems write here when a value actually changes
 * (never per frame, except linkTimer01 which UI reads via transient
 * subscribe). React components subscribe with selectors.
 */
export interface GameUiState {
  phase: GamePhase;
  mode: GameMode;
  score: number;
  link: number;
  bestLink: number;
  /** 0..1 remaining fraction of the link window — transient-subscribed only */
  linkTimer01: number;
  chips: number;
  chipsRequired: number;
  timeLeft: number;
  boostMeter: number;
  goalUnlocked: boolean;
  /** the boss fight is live (gate crossed, not yet defeated) */
  bossActive: boolean;
  /** serpent hits remaining, drives the HUD pips */
  bossHitsLeft: number;
  rank: Rank | null;
  resultsKind: ResultsKind | null;
}

const initialState: GameUiState = {
  phase: "title",
  mode: "mare",
  score: 0,
  link: 0,
  bestLink: 0,
  linkTimer01: 0,
  chips: 0,
  chipsRequired: MARE.chipsRequired,
  timeLeft: MARE.timeLimit,
  boostMeter: 1,
  goalUnlocked: false,
  bossActive: false,
  bossHitsLeft: 0,
  rank: null,
  resultsKind: null,
};

export const gameStore = createStore<GameUiState>()(() => ({ ...initialState }));

export function resetGameUi(): void {
  const { phase, mode } = gameStore.getState();
  gameStore.setState({ ...initialState, phase, mode });
}

/** React hook — selector-based subscription to the vanilla store. */
export function useGameStore<T>(selector: (state: GameUiState) => T): T {
  return useStore(gameStore, selector);
}
