/**
 * Gameplay tuning values. Exported as mutable objects on purpose: the Leva
 * debug panel writes straight into them, and systems read them live every
 * step, so feel can be tuned without recompiling.
 */

export const FLIGHT = {
  /** m/s reachable without boost */
  maxSpeed: 26,
  /** m/s² at standstill; fades quadratically toward maxSpeed */
  accel: 55,
  /** exponential drag on the along-track velocity */
  dragS: 0.35,
  /** slightly higher drag vertically so climbs/dives settle */
  dragY: 0.7,
  /** gentle downward drift when input is neutral (m/s²) */
  gravityBias: 1.2,
  boostSpeedMult: 2.2,
  /** seconds a full meter lasts */
  boostDrainTime: 2.5,
  /** meter needed to start a drill dash */
  boostMinMeter: 0.15,
  boostRefillRing: 0.08,
  boostRefillChip: 0.15,
  /** soft bounce off the corridor bounds */
  bounceRestitution: 0.3,
  /** seconds of extra control authority after hitting bounds */
  recoveryTime: 0.25,
  recoveryAccelMult: 1.8,
  /** visual banking: scales v²κ in the physical bank-angle formula */
  bankTurnGain: 1.4,
  bankClimbGain: 0.9,
  maxBank: 1.15,
  bankDampLambda: 8,
};

export const CAMERA = {
  omegaS: 4.0,
  omegaY: 3.0,
  omegaUp: 2.5,
  omegaFov: 5.0,
  lookAheadGain: 0.45,
  lookAheadMax: 8,
  sideDist: 14,
  sideDistBoost: 16,
  fovBase: 55,
  fovBoost: 68,
  yFollow: 0.7,
  yBias: 2.0,
  lookForwardBias: 3.0,
};

export const COMBO = {
  /** seconds between pickups that keeps a link alive */
  linkWindow: 2.0,
};

export const PARALOOP = {
  /** minimum metres travelled between breadcrumbs */
  crumbSpacing: 0.6,
  maxCrumbs: 256,
  /** seconds a crumb stays valid */
  maxAge: 4,
  /** m² — reject jitter loops */
  minArea: 20,
  minCrumbs: 8,
  /** m/s below which the crumb trail resets (hovering) */
  hoverSpeed: 2,
  hoverResetTime: 0.5,
};

export const SCORING = {
  ringPoints: 10,
  chipPoints: 20,
  paraloopBase: 100,
  paraloopPerItem: 20,
};

export const MARE = {
  timeLimit: 120,
  chipsRequired: 20,
};

export const ENEMIES = {
  /** collision spheres in track space (metres) */
  enemyRadius: 1.4,
  playerRadius: 0.8,
  /** seconds a destroyed nightmaren stays gone before returning home */
  respawnTime: 20,
  /** seconds of mare time a contact hit costs — the NiGHTS penalty */
  damageTimeCost: 5,
  /** post-hit invulnerability window (seconds) */
  invulnTime: 1.2,
  /** fraction of velocity reflected back on a hit */
  knockback: 0.4,
  /** upward pop added on a hit (m/s) */
  knockbackPop: 6,
  /** points for a drill-destroyed enemy, multiplied by the link count */
  destroyPoints: 50,
  /** drill-dash meter refilled per destroy */
  boostRefill: 0.1,

  // --- floater ---
  floaterBobAmp: 3,
  floaterBobPeriod: 4,
  floaterDriftS: 4,
  floaterSearchRange: 20,

  // --- chaser ---
  chaserPatrolRadius: 4,
  /** patrol circling rate (rad/s) */
  chaserPatrolOmega: 0.8,
  chaserSearchRange: 28,
  chaserAttackRange: 6,
  chaserSpeed: 14,
  /** soft-acceleration smoothing while pursuing (higher = snappier) */
  chaserAccelLambda: 3,
  chaserLungeSpeed: 26,
  chaserLungeTime: 0.5,
  chaserRecoverTime: 1.2,
  /** velocity settle rate while recovering */
  chaserRecoverLambda: 2.5,
  /** give up the chase past this player distance */
  chaserReturnPlayerDist: 45,
  /** or once strayed this far from home */
  chaserStrayDist: 35,
  /** glide-home smoothing rate */
  returnLambda: 1.8,
};

/**
 * The Maelstrom — the serpent nightmaren fought on the course after the goal
 * gate. A head + body-segment chain in track space; the tail orb is the weak
 * point. Phase behaviour is keyed on hits remaining (3 → 2 → 1).
 */
export const BOSS = {
  /** hits to defeat (also the pip count) */
  hits: 3,
  /** the head anchors this far ahead of the player along the course */
  aheadDist: 35,
  /** head follow smoothing toward its weave/anchor target (per second) */
  headLambda: 1.5,
  /** body segments trailing the head */
  segmentCount: 8,
  /** track-units between successive trailing nodes (segments + tail) */
  segmentSpacing: 2.2,
  /** record a breadcrumb every this many track-units of head travel */
  crumbStep: 0.5,

  /** collision spheres (track-space metres) */
  headRadius: 1.6,
  segmentRadius: 1.6,
  playerRadius: 0.8,
  /** how close the drill-dash must get to the tail orb to land a hit */
  tailHitRadius: 2.2,

  /** boss post-hit invulnerability (seconds) */
  hitInvuln: 1.0,
  /** knocked-back "reel" after a hit: no attacks, head flung forward */
  reelTime: 1.2,
  reelSpeed: 30,
  /** death animation length before boss:defeated fires */
  dissolveTime: 2.0,
  /** points per tail hit (× the link count, like enemies) */
  points: 500,

  /** dive lunge, shared across phases that use it */
  diveSpeed: 30,
  diveTime: 0.6,
  diveRecoverTime: 1.5,

  // --- phase 3 (3 hits): slow weave, tail always exposed, no dives ---
  p3Omega: 0.8,
  p3Amp: 6,

  // --- phase 2 (2 hits): faster weave, dives every ~6 s ---
  p2Omega: 1.1,
  p2Amp: 6,
  p2DiveCooldown: 6,

  // --- phase 1 (1 hit): fastest weave, dives every ~4.5 s, tail blinks ---
  p1Omega: 1.5,
  p1Amp: 8,
  p1DiveCooldown: 4.5,
  /** tail exposure duty cycle in the final phase (seconds on / off) */
  tailOnTime: 2.5,
  tailOffTime: 1.5,
};
