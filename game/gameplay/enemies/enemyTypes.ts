export type EnemyKind = "floater" | "chaser";

/** Authored placement of one nightmaren in track space. */
export interface EnemySpawn {
  kind: EnemyKind;
  s: number;
  y: number;
}

/** Per-enemy FSM state. */
export const enum EnemyFsm {
  Idle = 0,
  Patrol = 1,
  Search = 2,
  Attack = 3,
  Recover = 4,
  Return = 5,
  Dead = 6,
}
