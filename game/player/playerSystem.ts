import { Quaternion, Vector3 } from "three";
import type { EventBus } from "@/game/core/events";
import { FLIGHT } from "@/game/core/constants";
import type { InputManager } from "@/game/engine/input";
import { clamp, damp, lerp } from "@/game/engine/math";
import { SplineTrack, TrackFrame } from "@/game/spline/splineTrack";
import { createPlayerState, type PlayerState } from "./playerState";

const GRAVITY = 9.81;

const _frame = new TrackFrame();
const _q = new Quaternion();
const _qYaw = new Quaternion();
const _qPitch = new Quaternion();
const _qRoll = new Quaternion();
const _yAxis = new Vector3(0, 1, 0);
const _xAxis = new Vector3(1, 0, 0);
const _zAxis = new Vector3(0, 0, 1);

export interface RenderTarget {
  position: Vector3;
  quaternion: Quaternion;
}

/**
 * 2.5D flight controller. The player's authoritative state lives in track
 * space (s along the course, y up in the swept plane); the moving spline
 * frame turns that into loops, hills and banked turns for free.
 */
/** spawn just past the goal gate so it doesn't fill the opening frame */
const START_S = 10;

export class PlayerSystem {
  readonly state: PlayerState = createPlayerState(START_S);

  constructor(
    private readonly track: SplineTrack,
    private readonly input: InputManager,
    private readonly events: EventBus,
  ) {}

  reset(): void {
    Object.assign(this.state, createPlayerState(START_S));
  }

  /** Collectible systems feed the drill-dash meter. */
  addBoost(amount: number): void {
    this.state.boostMeter = clamp(this.state.boostMeter + amount, 0, 1);
  }

  get speed(): number {
    return Math.hypot(this.state.vs, this.state.vy);
  }

  update(dt: number): void {
    const st = this.state;
    const move = this.input.frame.move;

    st.prev.sUnwrapped = st.sUnwrapped;
    st.prev.y = st.y;
    st.prev.bank = st.bank;
    st.prev.pitch = st.pitch;

    // --- boost state machine ---
    if (!st.boosting && this.input.frame.boostPressed && st.boostMeter > FLIGHT.boostMinMeter) {
      st.boosting = true;
      this.events.emit({ type: "boost:start" });
    }
    if (st.boosting) {
      st.boostMeter -= dt / FLIGHT.boostDrainTime;
      if (!this.input.frame.boost || st.boostMeter <= 0) {
        st.boostMeter = Math.max(st.boostMeter, 0);
        st.boosting = false;
        this.events.emit({ type: "boost:end" });
      }
    }

    // --- acceleration: strong at rest, fading quadratically toward max ---
    const speed = this.speed;
    const authority =
      (st.recoveryTimer > 0 ? FLIGHT.recoveryAccelMult : 1) *
      Math.max(1 - (speed / FLIGHT.maxSpeed) ** 2, st.boosting ? 0 : 0.08);
    st.vs += move.x * FLIGHT.accel * authority * dt;
    st.vy += move.y * FLIGHT.accel * authority * dt;
    st.recoveryTimer = Math.max(st.recoveryTimer - dt, 0);
    st.invulnTimer = Math.max(st.invulnTimer - dt, 0);

    // --- drill dash: surge along the current velocity direction ---
    if (st.boosting) {
      const target = FLIGHT.maxSpeed * FLIGHT.boostSpeedMult;
      const cur = this.speed;
      if (cur > 0.1) {
        const scale = damp(1, target / cur, 6, dt);
        st.vs *= scale;
        st.vy *= scale;
      } else {
        st.vs = target * st.facing;
      }
    }

    // --- drag + idle gravity drift ---
    st.vs *= Math.exp(-FLIGHT.dragS * dt);
    st.vy *= Math.exp(-FLIGHT.dragY * dt);
    if (Math.abs(move.x) < 0.05 && Math.abs(move.y) < 0.05 && !st.boosting) {
      st.vy -= FLIGHT.gravityBias * dt;
    }

    // cap non-boost speed softly
    const maxNow = FLIGHT.maxSpeed * (st.boosting ? FLIGHT.boostSpeedMult : 1);
    const newSpeed = this.speed;
    if (newSpeed > maxNow) {
      const k = damp(1, maxNow / newSpeed, 10, dt);
      st.vs *= k;
      st.vy *= k;
    }

    // --- integrate ---
    st.sUnwrapped += st.vs * dt;
    st.y += st.vy * dt;
    st.s = this.track.wrap(st.sUnwrapped);

    // --- corridor clamp with soft bounce + quick recovery ---
    const [yMin, yMax] = this.track.corridorAt(st.s);
    if (st.y < yMin) {
      st.y = yMin;
      if (st.vy < 0) {
        st.vy = -st.vy * FLIGHT.bounceRestitution;
        st.recoveryTimer = FLIGHT.recoveryTime;
        this.events.emit({ type: "bounds:hit" });
      }
    } else if (st.y > yMax) {
      st.y = yMax;
      if (st.vy > 0) {
        st.vy = -st.vy * FLIGHT.bounceRestitution;
        st.recoveryTimer = FLIGHT.recoveryTime;
        this.events.emit({ type: "bounds:hit" });
      }
    }

    // --- facing with hysteresis ---
    if (st.vs > 0.5) st.facing = 1;
    else if (st.vs < -0.5) st.facing = -1;

    // --- visual banking from in-plane curvature (physical bank angle) ---
    const curvature = this.track.curvatureAt(st.s);
    const bankWorld = -Math.atan2(FLIGHT.bankTurnGain * st.vs * st.vs * curvature, GRAVITY);
    const bankTarget = clamp(bankWorld, -FLIGHT.maxBank, FLIGHT.maxBank) * st.facing;
    st.bank = damp(st.bank, bankTarget, FLIGHT.bankDampLambda, dt);

    // --- visual pitch toward vertical velocity ---
    const pitchTarget = Math.atan2(st.vy * FLIGHT.bankClimbGain, Math.max(Math.abs(st.vs), 6));
    st.pitch = damp(st.pitch, pitchTarget, FLIGHT.bankDampLambda, dt);
  }

  /** World position of the current (non-interpolated) state. */
  worldPosition(out: Vector3): Vector3 {
    return this.track.worldPos(this.state.s, this.state.y, out, _frame);
  }

  /**
   * Interpolated world transform for rendering. Interpolates in track space
   * (unwrapped s) so the course seam never pops.
   */
  writeRenderTransform(out: RenderTarget, alpha: number): void {
    const st = this.state;
    const s = lerp(st.prev.sUnwrapped, st.sUnwrapped, alpha);
    const y = lerp(st.prev.y, st.y, alpha);
    const bank = lerp(st.prev.bank, st.bank, alpha);
    const pitch = lerp(st.prev.pitch, st.pitch, alpha);

    this.track.frameAt(this.track.wrap(s), _frame);
    out.position.copy(_frame.position).addScaledVector(_frame.up, y);

    _q.copy(_frame.quaternion);
    if (st.facing === -1) {
      _qYaw.setFromAxisAngle(_yAxis, Math.PI);
      _q.multiply(_qYaw);
    }
    _qPitch.setFromAxisAngle(_xAxis, pitch);
    _qRoll.setFromAxisAngle(_zAxis, bank);
    out.quaternion.copy(_q.multiply(_qPitch).multiply(_qRoll));
  }
}
