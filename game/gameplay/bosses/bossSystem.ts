import { Vector3 } from "three";
import { BOSS, ENEMIES } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { gameStore } from "@/game/core/gameStore";
import { clamp, damp, lerp, wrapDelta } from "@/game/engine/math";
import type { SplineTrack } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";
import type { PlayerState } from "@/game/player/playerState";
import type { ComboSystem } from "../combo/comboSystem";
import type { Scoring } from "../scoring";
import { BossFsm, type BossNode } from "./bossTypes";

/** phase tuning resolved from hits remaining */
interface PhaseParams {
  omega: number;
  amp: number;
  /** seconds between dives; Infinity = never dives (phase 3) */
  diveCooldown: number;
  /** tail blinks on/off in the final phase; otherwise always exposed */
  tailBlinks: boolean;
}

const _pos = new Vector3();

/** breadcrumb ring capacity: crumbStep 0.5 × 96 ≈ 48 units of head history,
 *  well past the tail at segmentSpacing × (segmentCount + 1) ≈ 20 units. */
const CRUMB_CAP = 96;

/**
 * The Maelstrom — a serpent nightmaren fought on the course during the boss
 * phase of a Mare. Entirely track-space (s, y), like the enemies: the head
 * swims an anchor kept a fixed distance ahead of the player while weaving in
 * the corridor; the body segments and the weak-point tail orb trail the head
 * along a breadcrumb history of its own past positions (the same technique the
 * paraloop crumb trail uses). Drill-dashing the exposed tail lands a hit;
 * touching the head or a body segment while not boosting costs the player mare
 * time. Inactive (early-return) until it hears boss:intro.
 *
 * Head arc length is kept UNWRAPPED and grows monotonically so the breadcrumb
 * trail interpolates cleanly across the course seam; wrapping happens only when
 * a node is read for collision or rendering.
 */
export class BossSystem {
  private state: BossFsm = BossFsm.Inactive;
  private hitsLeft = BOSS.hits;
  /** free-running weave clock */
  private clock = 0;
  /** generic per-state countdown (dive burst, recover, reel, dissolve) */
  private stateTimer = 0;
  /** counts down to the next dive while swimming */
  private diveTimer = 0;
  /** boss post-hit invulnerability window */
  private hitInvuln = 0;
  /** tail duty-cycle clock (final phase); tailExposed derives from it */
  private tailClock = 0;

  /** head kinematics in track space (unwrapped s) */
  private headSU = 0;
  private headY = 0;
  private headVSU = 0;
  private headVY = 0;

  // breadcrumb ring buffer (unwrapped s, y, cumulative head travel)
  private readonly crumbSU = new Float64Array(CRUMB_CAP);
  private readonly crumbY = new Float64Array(CRUMB_CAP);
  private readonly crumbD = new Float64Array(CRUMB_CAP);
  private crumbWrite = 0;
  private crumbFilled = 0;
  private headTravel = 0;

  // readonly view state (structs created once, mutated in place)
  readonly head: BossNode = { su: 0, s: 0, y: 0 };
  readonly segments: BossNode[];
  readonly tail: BossNode = { su: 0, s: 0, y: 0 };
  /** whether the tail orb can currently be hit / glows */
  tailExposed = true;

  constructor(
    private readonly track: SplineTrack,
    private readonly player: PlayerSystem,
    private readonly combo: ComboSystem,
    private readonly scoring: Scoring,
    private readonly events: EventBus,
  ) {
    this.segments = Array.from({ length: BOSS.segmentCount }, () => ({ su: 0, s: 0, y: 0 }));
    events.on("boss:intro", () => this.activate(this.player.state.s));
  }

  reset(): void {
    this.state = BossFsm.Inactive;
    this.tailExposed = true;
  }

  /** true whenever the serpent should be simulated and drawn */
  get active(): boolean {
    return this.state !== BossFsm.Inactive && this.state !== BossFsm.Done;
  }

  /** 0 → 1 across the dissolve; 0 outside it (view scales segments away) */
  get dissolveProgress(): number {
    if (this.state !== BossFsm.Dissolve) return 0;
    return clamp(1 - this.stateTimer / BOSS.dissolveTime, 0, 1);
  }

  /** Spawn the serpent ahead of the player, chain stretched out behind it. */
  private activate(playerS: number): void {
    this.state = BossFsm.Swim;
    this.hitsLeft = BOSS.hits;
    this.clock = 0;
    this.tailClock = 0;
    this.hitInvuln = 0;
    this.headVSU = 0;
    this.headVY = 0;

    this.headSU = this.track.wrap(playerS) + BOSS.aheadDist;
    const [yMin, yMax] = this.track.corridorAt(this.track.wrap(this.headSU));
    this.headY = (yMin + yMax) * 0.5;

    // pre-fill the breadcrumb trail behind the head so segments have history
    // from the first frame (no bunching, no NaN sampling before travel).
    this.headTravel = 0;
    this.crumbWrite = 0;
    this.crumbFilled = 0;
    for (let k = CRUMB_CAP; k >= 1; k -= 1) {
      this.pushCrumb(this.headSU - k * BOSS.crumbStep, this.headY, -k * BOSS.crumbStep);
    }

    this.diveTimer = this.phase().diveCooldown;
    this.tailExposed = true;
    this.refreshNodes();
  }

  update(dt: number): void {
    if (!this.active) return;

    this.clock += dt;
    this.hitInvuln = Math.max(this.hitInvuln - dt, 0);
    const p = this.player.state;
    const ph = this.phase();

    switch (this.state) {
      case BossFsm.Swim:
        this.weave(dt, ph);
        this.diveTimer -= dt;
        if (Number.isFinite(ph.diveCooldown) && this.diveTimer <= 0) this.beginDive(p);
        break;
      case BossFsm.Dive:
        this.headSU += this.headVSU * dt;
        this.headY += this.headVY * dt;
        this.clampHeadY();
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = BossFsm.Recover;
          this.stateTimer = BOSS.diveRecoverTime;
        }
        break;
      case BossFsm.Recover:
        this.weave(dt, ph);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = BossFsm.Swim;
          this.diveTimer = ph.diveCooldown;
        }
        break;
      case BossFsm.Reel:
        // flung forward along the course, weaving suspended
        this.headSU += this.headVSU * dt;
        this.headVSU = damp(this.headVSU, 0, 2.5, dt);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = BossFsm.Swim;
          this.diveTimer = ph.diveCooldown;
        }
        break;
      case BossFsm.Dissolve:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.finishDefeat();
        return; // no crumb recording / collisions while dying
    }

    this.recordCrumb();
    this.refreshNodes();
    this.updateTailExposure(dt, ph);
    this.resolveCollisions(p);
  }

  // ------------------------------------------------------------- movement

  /** damped follow of the weave anchor kept aheadDist in front of the player */
  private weave(dt: number, ph: PhaseParams): void {
    const L = this.track.totalLength;
    const p = this.player.state;
    const headWrapped = this.track.wrap(this.headSU);

    const anchorS = this.track.wrap(p.s + BOSS.aheadDist);
    const dS = wrapDelta(anchorS, headWrapped, L);
    this.headSU = damp(this.headSU, this.headSU + dS, BOSS.headLambda, dt);

    const [yMin, yMax] = this.track.corridorAt(headWrapped);
    const yMid = (yMin + yMax) * 0.5;
    const yTarget = clamp(yMid + Math.sin(this.clock * ph.omega) * ph.amp, yMin, yMax);
    this.headY = damp(this.headY, yTarget, BOSS.headLambda, dt);
  }

  private beginDive(p: PlayerState): void {
    const L = this.track.totalLength;
    const headWrapped = this.track.wrap(this.headSU);
    // predicted player position at the end of the lunge (chaser math)
    const predS = this.track.wrap(p.s + p.vs * BOSS.diveTime);
    const dS = wrapDelta(predS, headWrapped, L);
    const dY = p.y + p.vy * BOSS.diveTime - this.headY;
    const d = Math.hypot(dS, dY) || 1;
    this.headVSU = (dS / d) * BOSS.diveSpeed;
    this.headVY = (dY / d) * BOSS.diveSpeed;
    this.state = BossFsm.Dive;
    this.stateTimer = BOSS.diveTime;
  }

  private clampHeadY(): void {
    const [yMin, yMax] = this.track.corridorAt(this.track.wrap(this.headSU));
    this.headY = clamp(this.headY, yMin, yMax);
  }

  private updateTailExposure(dt: number, ph: PhaseParams): void {
    if (!ph.tailBlinks) {
      this.tailExposed = true;
      return;
    }
    this.tailClock += dt;
    const period = BOSS.tailOnTime + BOSS.tailOffTime;
    this.tailExposed = this.tailClock % period < BOSS.tailOnTime;
  }

  // ---------------------------------------------------------- breadcrumbs

  private recordCrumb(): void {
    let step = BOSS.crumbStep;
    let lastD = -Infinity;
    if (this.crumbFilled > 0) {
      const i = (this.crumbWrite - 1 + CRUMB_CAP) % CRUMB_CAP;
      step = Math.hypot(this.headSU - this.crumbSU[i]!, this.headY - this.crumbY[i]!);
      lastD = this.crumbD[i]!;
    }
    this.headTravel += step;
    if (this.headTravel - lastD >= BOSS.crumbStep) {
      this.pushCrumb(this.headSU, this.headY, this.headTravel);
    }
  }

  private pushCrumb(su: number, y: number, d: number): void {
    this.crumbSU[this.crumbWrite] = su;
    this.crumbY[this.crumbWrite] = y;
    this.crumbD[this.crumbWrite] = d;
    this.crumbWrite = (this.crumbWrite + 1) % CRUMB_CAP;
    this.crumbFilled = Math.min(this.crumbFilled + 1, CRUMB_CAP);
  }

  /** Interpolate the trail `back` track-units behind the head into `out`. */
  private sampleTrail(back: number, out: BossNode): void {
    const targetD = this.headTravel - back;
    // treat the current head as the newest (virtual) crumb
    let newerSU = this.headSU;
    let newerY = this.headY;
    let newerD = this.headTravel;
    let idx = (this.crumbWrite - 1 + CRUMB_CAP) % CRUMB_CAP;
    for (let n = 0; n < this.crumbFilled; n += 1) {
      const olderD = this.crumbD[idx]!;
      if (olderD <= targetD) {
        const span = newerD - olderD;
        const t = span > 1e-6 ? (targetD - olderD) / span : 0;
        out.su = lerp(this.crumbSU[idx]!, newerSU, t);
        out.y = lerp(this.crumbY[idx]!, newerY, t);
        out.s = this.track.wrap(out.su);
        return;
      }
      newerSU = this.crumbSU[idx]!;
      newerY = this.crumbY[idx]!;
      newerD = olderD;
      idx = (idx - 1 + CRUMB_CAP) % CRUMB_CAP;
    }
    // not enough history: clamp to the oldest known point
    out.su = newerSU;
    out.y = newerY;
    out.s = this.track.wrap(newerSU);
  }

  private refreshNodes(): void {
    this.head.su = this.headSU;
    this.head.s = this.track.wrap(this.headSU);
    this.head.y = this.headY;
    for (let i = 0; i < this.segments.length; i += 1) {
      this.sampleTrail((i + 1) * BOSS.segmentSpacing, this.segments[i]!);
    }
    this.sampleTrail((this.segments.length + 1) * BOSS.segmentSpacing, this.tail);
  }

  // ---------------------------------------------------------- collisions

  private resolveCollisions(p: PlayerState): void {
    const L = this.track.totalLength;

    if (p.boosting) {
      // only the exposed tail is vulnerable while drilling; the body is
      // pass-through
      if (this.tailExposed && this.hitInvuln <= 0) {
        const d = Math.hypot(wrapDelta(this.tail.s, p.s, L), this.tail.y - p.y);
        if (d < BOSS.tailHitRadius + BOSS.playerRadius) this.hitTail();
      }
      return;
    }

    if (p.invulnTimer > 0) return;
    const sumR = BOSS.segmentRadius + BOSS.playerRadius;
    if (this.contacts(this.head, p, sumR, L)) {
      this.hurtPlayer(p);
      return;
    }
    for (const seg of this.segments) {
      if (this.contacts(seg, p, sumR, L)) {
        this.hurtPlayer(p);
        return;
      }
    }
  }

  private contacts(node: BossNode, p: PlayerState, sumR: number, L: number): boolean {
    return Math.abs(wrapDelta(node.s, p.s, L)) < sumR && Math.abs(node.y - p.y) < sumR;
  }

  private hitTail(): void {
    this.hitsLeft -= 1;
    this.hitInvuln = BOSS.hitInvuln;
    const link = this.combo.registerPickup();
    this.scoring.addPickup(BOSS.points, link);
    gameStore.setState({ bossHitsLeft: this.hitsLeft });

    this.track.worldPos(this.tail.s, this.tail.y, _pos);
    this.events.emit({
      type: "boss:hit",
      hitsLeft: this.hitsLeft,
      worldPos: [_pos.x, _pos.y, _pos.z],
    });

    if (this.hitsLeft <= 0) {
      this.state = BossFsm.Dissolve;
      this.stateTimer = BOSS.dissolveTime;
    } else {
      // reel: fling the head forward along the course, suspend attacks
      this.state = BossFsm.Reel;
      this.stateTimer = BOSS.reelTime;
      this.headVSU = BOSS.reelSpeed;
    }
  }

  private hurtPlayer(p: PlayerState): void {
    // identical treatment to an enemy body hit (see EnemySystem.resolveCollision)
    p.vs = -p.vs * ENEMIES.knockback;
    p.vy = -p.vy * ENEMIES.knockback + ENEMIES.knockbackPop;
    p.invulnTimer = ENEMIES.invulnTime;
    this.track.worldPos(p.s, p.y, _pos);
    this.events.emit({ type: "player:hit", worldPos: [_pos.x, _pos.y, _pos.z] });
  }

  private finishDefeat(): void {
    this.state = BossFsm.Done;
    gameStore.setState({ bossActive: false });
    this.events.emit({ type: "boss:defeated" });
  }

  private phase(): PhaseParams {
    if (this.hitsLeft >= 3) {
      return { omega: BOSS.p3Omega, amp: BOSS.p3Amp, diveCooldown: Infinity, tailBlinks: false };
    }
    if (this.hitsLeft === 2) {
      return { omega: BOSS.p2Omega, amp: BOSS.p2Amp, diveCooldown: BOSS.p2DiveCooldown, tailBlinks: false };
    }
    return { omega: BOSS.p1Omega, amp: BOSS.p1Amp, diveCooldown: BOSS.p1DiveCooldown, tailBlinks: true };
  }
}
