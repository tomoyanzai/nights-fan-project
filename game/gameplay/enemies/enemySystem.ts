import { Vector3 } from "three";
import { ENEMIES } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { damp, wrapDelta } from "@/game/engine/math";
import type { SplineTrack } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";
import type { PlayerState } from "@/game/player/playerState";
import type { ComboSystem } from "../combo/comboSystem";
import type { Scoring } from "../scoring";
import { EnemyFsm, type EnemyKind, type EnemySpawn } from "./enemyTypes";

/**
 * Mutable runtime record for one nightmaren. Created once per spawn in the
 * constructor; the update loop only mutates these fields, never allocates.
 * The view reads {kind, s, y, vs, vy, state} to place and pose instances.
 */
export interface EnemyRuntime {
  readonly kind: EnemyKind;
  readonly homeS: number;
  readonly homeY: number;
  s: number;
  y: number;
  vs: number;
  vy: number;
  state: EnemyFsm;
  /** generic FSM countdown: lunge burst, recover, respawn */
  timer: number;
  /** free-running clock for bob/circle motion */
  phase: number;
}

const _pos = new Vector3();

/**
 * Enemy simulation. Runs an FSM per nightmaren entirely in track space (s, y),
 * the same space as the player, so distances use wrapped s-deltas and the
 * corridor frame carries them through loops for free. Sphere-vs-sphere contact
 * either damages the player (mare-time penalty + knockback) or, while the
 * player is drill-dashing, destroys the enemy.
 */
export class EnemySystem {
  readonly enemies: EnemyRuntime[];
  /** free-run: nightmaren become harmless drifting scenery (patrol forever) */
  passive = false;

  constructor(
    spawns: readonly EnemySpawn[],
    private readonly track: SplineTrack,
    private readonly player: PlayerSystem,
    private readonly combo: ComboSystem,
    private readonly scoring: Scoring,
    private readonly events: EventBus,
  ) {
    this.enemies = spawns.map((sp, i) => ({
      kind: sp.kind,
      homeS: track.wrap(sp.s),
      homeY: sp.y,
      s: track.wrap(sp.s),
      y: sp.y,
      vs: 0,
      vy: 0,
      state: EnemyFsm.Patrol,
      timer: 0,
      // stagger identical spawns so a pair doesn't move in lockstep
      phase: i * 0.7,
    }));
  }

  reset(): void {
    for (const e of this.enemies) this.respawn(e);
  }

  update(dt: number): void {
    const p = this.player.state;
    const L = this.track.totalLength;
    const sumR = ENEMIES.enemyRadius + ENEMIES.playerRadius;

    for (const e of this.enemies) {
      if (e.state === EnemyFsm.Dead) {
        e.timer -= dt;
        if (e.timer <= 0) this.respawn(e);
        continue;
      }

      e.phase += dt;
      const ds = wrapDelta(e.s, p.s, L);
      const dy = e.y - p.y;
      const dist = Math.hypot(ds, dy);

      if (e.kind === "floater") this.updateFloater(e, dt, dist, L);
      else this.updateChaser(e, dt, p, ds, dy, dist, L);

      e.s = this.track.wrap(e.s);

      // sphere-vs-sphere: both wrapped |Δs| and |Δy| under the combined radius
      // (passive dream critters drift right through the player)
      if (
        !this.passive &&
        Math.abs(wrapDelta(e.s, p.s, L)) < sumR &&
        Math.abs(e.y - p.y) < sumR
      ) {
        this.resolveCollision(e, p);
      }
    }
  }

  private updateFloater(e: EnemyRuntime, dt: number, dist: number, L: number): void {
    switch (e.state) {
      case EnemyFsm.Patrol: {
        // it IS the obstacle: a slow vertical bob with a little s-drift
        const w = (Math.PI * 2) / ENEMIES.floaterBobPeriod;
        e.y = e.homeY + Math.sin(e.phase * w) * ENEMIES.floaterBobAmp;
        e.s = e.homeS + Math.sin(e.phase * w * 0.5) * ENEMIES.floaterDriftS;
        e.vs = 0;
        e.vy = 0;
        if (!this.passive && dist <= ENEMIES.floaterSearchRange) e.state = EnemyFsm.Search;
        break;
      }
      case EnemyFsm.Search: {
        // stop and face the player (pose is view-side); hold position
        e.vs = 0;
        e.vy = 0;
        if (dist > ENEMIES.floaterSearchRange * 1.2) e.state = EnemyFsm.Return;
        break;
      }
      case EnemyFsm.Return: {
        const k = 1 - Math.exp(-ENEMIES.returnLambda * dt);
        e.s += wrapDelta(e.homeS, e.s, L) * k;
        e.y += (e.homeY - e.y) * k;
        if (
          Math.abs(wrapDelta(e.s, e.homeS, L)) < 0.3 &&
          Math.abs(e.y - e.homeY) < 0.3
        ) {
          e.state = EnemyFsm.Patrol;
        }
        break;
      }
      default:
        e.state = EnemyFsm.Patrol;
    }
  }

  private updateChaser(
    e: EnemyRuntime,
    dt: number,
    p: PlayerState,
    ds: number,
    dy: number,
    dist: number,
    L: number,
  ): void {
    switch (e.state) {
      case EnemyFsm.Patrol: {
        e.s = e.homeS + Math.cos(e.phase * ENEMIES.chaserPatrolOmega) * ENEMIES.chaserPatrolRadius;
        e.y = e.homeY + Math.sin(e.phase * ENEMIES.chaserPatrolOmega) * ENEMIES.chaserPatrolRadius;
        e.vs = 0;
        e.vy = 0;
        if (!this.passive && dist <= ENEMIES.chaserSearchRange) e.state = EnemyFsm.Search;
        break;
      }
      case EnemyFsm.Search: {
        // soft-accelerate toward the player, capped at chaserSpeed
        const inv = dist > 1e-4 ? 1 / dist : 0;
        e.vs = damp(e.vs, -ds * inv * ENEMIES.chaserSpeed, ENEMIES.chaserAccelLambda, dt);
        e.vy = damp(e.vy, -dy * inv * ENEMIES.chaserSpeed, ENEMIES.chaserAccelLambda, dt);
        e.s += e.vs * dt;
        e.y += e.vy * dt;
        if (dist <= ENEMIES.chaserAttackRange) {
          this.beginLunge(e, p, ds, dy);
        } else if (
          dist > ENEMIES.chaserReturnPlayerDist ||
          Math.hypot(wrapDelta(e.s, e.homeS, L), e.y - e.homeY) > ENEMIES.chaserStrayDist
        ) {
          e.state = EnemyFsm.Return;
        }
        break;
      }
      case EnemyFsm.Attack: {
        // fixed-velocity burst toward the position picked at lunge start
        e.s += e.vs * dt;
        e.y += e.vy * dt;
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = EnemyFsm.Recover;
          e.timer = ENEMIES.chaserRecoverTime;
        }
        break;
      }
      case EnemyFsm.Recover: {
        e.vs = damp(e.vs, 0, ENEMIES.chaserRecoverLambda, dt);
        e.vy = damp(e.vy, 0, ENEMIES.chaserRecoverLambda, dt);
        e.s += e.vs * dt;
        e.y += e.vy * dt;
        e.timer -= dt;
        if (e.timer <= 0) e.state = EnemyFsm.Search;
        break;
      }
      case EnemyFsm.Return: {
        const k = 1 - Math.exp(-ENEMIES.returnLambda * dt);
        e.s += wrapDelta(e.homeS, e.s, L) * k;
        e.y += (e.homeY - e.y) * k;
        e.vs = 0;
        e.vy = 0;
        if (Math.hypot(wrapDelta(e.s, e.homeS, L), e.y - e.homeY) < 0.5) {
          e.state = EnemyFsm.Patrol;
        }
        break;
      }
      default:
        e.state = EnemyFsm.Patrol;
    }
  }

  private beginLunge(e: EnemyRuntime, p: PlayerState, ds: number, dy: number): void {
    e.state = EnemyFsm.Attack;
    e.timer = ENEMIES.chaserLungeTime;
    // predicted player offset relative to the enemy (−ds = player − enemy)
    const tgtS = -ds + p.vs * ENEMIES.chaserLungeTime;
    const tgtY = -dy + p.vy * ENEMIES.chaserLungeTime;
    const d = Math.hypot(tgtS, tgtY) || 1;
    e.vs = (tgtS / d) * ENEMIES.chaserLungeSpeed;
    e.vy = (tgtY / d) * ENEMIES.chaserLungeSpeed;
  }

  private resolveCollision(e: EnemyRuntime, p: PlayerState): void {
    if (p.boosting) {
      e.state = EnemyFsm.Dead;
      e.timer = ENEMIES.respawnTime;
      const link = this.combo.registerPickup();
      this.scoring.addPickup(ENEMIES.destroyPoints, link);
      this.player.addBoost(ENEMIES.boostRefill);
      this.track.worldPos(e.s, e.y, _pos);
      this.events.emit({
        type: "enemy:destroyed",
        kind: e.kind,
        worldPos: [_pos.x, _pos.y, _pos.z],
      });
    } else if (p.invulnTimer <= 0) {
      // knockback: reflect part of the velocity, add a small upward pop, and
      // open the invuln window (mutating player state directly, like the
      // corridor bounce does)
      p.vs = -p.vs * ENEMIES.knockback;
      p.vy = -p.vy * ENEMIES.knockback + ENEMIES.knockbackPop;
      p.invulnTimer = ENEMIES.invulnTime;
      this.track.worldPos(p.s, p.y, _pos);
      this.events.emit({ type: "player:hit", worldPos: [_pos.x, _pos.y, _pos.z] });
    }
  }

  private respawn(e: EnemyRuntime): void {
    e.s = e.homeS;
    e.y = e.homeY;
    e.vs = 0;
    e.vy = 0;
    e.state = EnemyFsm.Patrol;
    e.timer = 0;
    e.phase = 0;
  }
}
