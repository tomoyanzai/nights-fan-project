export type GamePhase = "title" | "flying" | "paused" | "results";

export type Rank = "C" | "B" | "A" | "S";

export type ResultsKind = "clear" | "timeout";

export interface Vec2 {
  x: number;
  y: number;
}
