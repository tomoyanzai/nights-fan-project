/** One node of the serpent chain (head, a body segment, or the tail orb). */
export interface BossNode {
  /** unwrapped arc length — trailing history is interpolated in this space */
  su: number;
  /** wrapped arc length for world placement and collision */
  s: number;
  /** vertical offset in the swept plane */
  y: number;
}

/** Serpent lifecycle. Inactive until boss:intro; Done after boss:defeated. */
export const enum BossFsm {
  /** early-returns; nothing on the course */
  Inactive = 0,
  /** default combat state: weaving, scheduling dives */
  Swim = 1,
  /** fixed-velocity lunge at the player's predicted position */
  Dive = 2,
  /** post-dive settle (no attacks) */
  Recover = 3,
  /** knocked back after a tail hit (head flung forward, no attacks) */
  Reel = 4,
  /** death animation; segments scale away back-to-front */
  Dissolve = 5,
  /** dissolve finished, boss:defeated emitted */
  Done = 6,
}
