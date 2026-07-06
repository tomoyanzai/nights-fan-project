export interface PlayerState {
  /** arc length along the track, wrapped into [0, totalLength) */
  s: number;
  /** vertical offset in the swept plane (along frame.up) */
  y: number;
  /** s without wrapping — paraloop and interpolation use this */
  sUnwrapped: number;
  /** track-space velocity, m/s */
  vs: number;
  vy: number;
  /** travel direction along the track (+1 with the spline, -1 against) */
  facing: 1 | -1;
  /** visual roll around the flight direction, radians */
  bank: number;
  /** visual pitch toward the vertical velocity, radians */
  pitch: number;
  boostMeter: number;
  boosting: boolean;
  /** seconds of post-collision control boost remaining */
  recoveryTimer: number;
  /** previous-step values for render interpolation */
  prev: {
    sUnwrapped: number;
    y: number;
    bank: number;
    pitch: number;
  };
}

export function createPlayerState(): PlayerState {
  return {
    s: 0,
    y: 4,
    sUnwrapped: 0,
    vs: 0,
    vy: 0,
    facing: 1,
    bank: 0,
    pitch: 0,
    boostMeter: 1,
    boosting: false,
    recoveryTimer: 0,
    prev: { sUnwrapped: 0, y: 4, bank: 0, pitch: 0 },
  };
}
