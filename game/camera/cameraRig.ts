import { Vector3 } from "three";
import { CAMERA } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { clamp, damp, lerp, springDamp } from "@/game/engine/math";
import { SplineTrack, TrackFrame } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";

const _frame = new TrackFrame();
const _playerPos = new Vector3();

/**
 * Track-space camera. The rig has its own (s, y) plus a lateral offset along
 * frame.side, so it stays perpendicular to the course plane and inherits the
 * course roll through loops — the authentic side-on NiGHTS view. All
 * smoothing is critically damped springs (frame-rate independent), never lerp.
 */
export class CameraRig {
  // spring state (track space, unwrapped s)
  private sCam = 0;
  private vsCam = 0;
  private yCam = 0;
  private vyCam = 0;
  private fov = CAMERA.fovBase;
  private vFov = 0;
  private sideDist = CAMERA.sideDist;

  private readonly smoothedUp = new Vector3(0, 1, 0);
  private boosting = false;
  private initialized = false;

  // world-space output, double-buffered for render interpolation
  private readonly curPos = new Vector3();
  private readonly prevPos = new Vector3();
  private readonly curTarget = new Vector3();
  private readonly prevTarget = new Vector3();
  private readonly curUp = new Vector3(0, 1, 0);
  private readonly prevUp = new Vector3(0, 1, 0);
  private curFov = CAMERA.fovBase;
  private prevFov = CAMERA.fovBase;

  constructor(
    private readonly track: SplineTrack,
    private readonly player: PlayerSystem,
    events: EventBus,
  ) {
    events.on("boost:start", () => {
      this.boosting = true;
    });
    events.on("boost:end", () => {
      this.boosting = false;
    });
  }

  reset(): void {
    this.initialized = false;
  }

  update(dt: number): void {
    const st = this.player.state;

    const lookAhead = clamp(st.vs * CAMERA.lookAheadGain, -CAMERA.lookAheadMax, CAMERA.lookAheadMax);
    const sTarget = st.sUnwrapped + lookAhead;
    const yTarget = st.y * CAMERA.yFollow + CAMERA.yBias;

    if (!this.initialized) {
      this.sCam = sTarget;
      this.yCam = yTarget;
      this.vsCam = 0;
      this.vyCam = 0;
      this.track.frameAt(this.track.wrap(this.sCam), _frame);
      this.smoothedUp.copy(_frame.up);
      this.computeWorld();
      this.prevPos.copy(this.curPos);
      this.prevTarget.copy(this.curTarget);
      this.prevUp.copy(this.curUp);
      this.prevFov = this.curFov;
      this.initialized = true;
      return;
    }

    this.prevPos.copy(this.curPos);
    this.prevTarget.copy(this.curTarget);
    this.prevUp.copy(this.curUp);
    this.prevFov = this.curFov;

    [this.sCam, this.vsCam] = springDamp(this.sCam, this.vsCam, sTarget, CAMERA.omegaS, dt);
    [this.yCam, this.vyCam] = springDamp(this.yCam, this.vyCam, yTarget, CAMERA.omegaY, dt);

    const fovTarget = this.boosting ? CAMERA.fovBoost : CAMERA.fovBase;
    [this.fov, this.vFov] = springDamp(this.fov, this.vFov, fovTarget, CAMERA.omegaFov, dt);
    this.sideDist = damp(
      this.sideDist,
      this.boosting ? CAMERA.sideDistBoost : CAMERA.sideDist,
      CAMERA.omegaFov,
      dt,
    );

    this.track.frameAt(this.track.wrap(this.sCam), _frame);
    // damp the up vector so loop transit rolls smoothly
    this.smoothedUp.lerp(_frame.up, 1 - Math.exp(-CAMERA.omegaUp * dt)).normalize();

    this.computeWorld();
  }

  private computeWorld(): void {
    this.track.frameAt(this.track.wrap(this.sCam), _frame);
    this.curPos
      .copy(_frame.position)
      .addScaledVector(_frame.up, this.yCam)
      .addScaledVector(_frame.side, this.sideDist);

    this.player.worldPosition(_playerPos);
    this.track.frameAt(this.player.state.s, _frame);
    this.curTarget
      .copy(_playerPos)
      .addScaledVector(_frame.tangent, this.player.state.facing * CAMERA.lookForwardBias);

    this.curUp.copy(this.smoothedUp);
    this.curFov = this.fov;
  }

  /** Interpolated output for the render camera. */
  writeToCamera(
    camera: { position: Vector3; up: Vector3; fov: number; lookAt(v: Vector3): void; updateProjectionMatrix(): void },
    alpha: number,
    scratch: Vector3,
  ): void {
    camera.position.lerpVectors(this.prevPos, this.curPos, alpha);
    camera.up.lerpVectors(this.prevUp, this.curUp, alpha).normalize();
    const fov = lerp(this.prevFov, this.curFov, alpha);
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    scratch.lerpVectors(this.prevTarget, this.curTarget, alpha);
    camera.lookAt(scratch);
  }
}
