import type { EnemySpawn } from "@/game/gameplay/enemies/enemyTypes";

/**
 * Nightmaren placement along the ~976 m lap. Floaters are static obstacles that
 * guard collectible lines; chasers prowl the open flowing sections. Each is set
 * a couple of units off the exact pickup line so intended routes stay flyable.
 */
export const verdantHollowEnemies: EnemySpawn[] = [
  // south straight — a chaser on the warm-up run
  { kind: "chaser", s: 60, y: 5 },
  // loop entrance — a floater blocking the climb into the vertical loop
  { kind: "floater", s: 240, y: 6 },
  // paraloop classroom (chip circle at s≈380, radius 5) — a guarding pair
  { kind: "floater", s: 372, y: 7 },
  { kind: "floater", s: 388, y: -1 },
  // north ridge — two chasers on the long flowing wave
  { kind: "chaser", s: 450, y: 6 },
  { kind: "chaser", s: 520, y: 11 },
  // canyon — two floaters guarding the low risk/reward ring line (y ≈ -2)
  { kind: "floater", s: 620, y: 0 },
  { kind: "floater", s: 700, y: -4 },
  // banked turn home — a last chaser
  { kind: "chaser", s: 820, y: 5 },
];
