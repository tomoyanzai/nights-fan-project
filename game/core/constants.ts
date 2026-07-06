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
  /** visual banking */
  bankTurnGain: 14,
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
