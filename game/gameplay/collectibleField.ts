import type { Vec2 } from "@/game/core/types";
import { pointInPolygon2D, polygonCentroid2D, wrapDelta } from "@/game/engine/math";

export interface TrackPoint {
  s: number;
  y: number;
}

export const enum CollectibleState {
  Active = 0,
  Vacuuming = 1,
  Collected = 2,
}

const VACUUM_DURATION = 0.4;

/**
 * Flat data-oriented storage for one collectible type. No per-item objects,
 * no allocation after construction; broadphase is a window walk over indices
 * sorted by s.
 */
export class CollectibleField {
  readonly count: number;
  readonly s: Float32Array;
  readonly y: Float32Array;
  readonly state: Uint8Array;
  readonly vacuumT: Float32Array;
  /** free-run only: absolute time an item respawns (0 = never) */
  readonly respawnAt: Float32Array;
  private readonly order: Uint16Array;

  constructor(items: readonly TrackPoint[], private readonly trackLength: number) {
    this.count = items.length;
    this.s = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.state = new Uint8Array(this.count);
    this.vacuumT = new Float32Array(this.count);
    this.respawnAt = new Float32Array(this.count);
    items.forEach((item, i) => {
      this.s[i] = ((item.s % trackLength) + trackLength) % trackLength;
      this.y[i] = item.y;
    });
    this.order = new Uint16Array(this.count);
    const indices = Array.from({ length: this.count }, (_, i) => i);
    indices.sort((a, b) => this.s[a]! - this.s[b]!);
    indices.forEach((idx, i) => {
      this.order[i] = idx;
    });
  }

  reset(): void {
    this.state.fill(CollectibleState.Active);
    this.vacuumT.fill(0);
    this.respawnAt.fill(0);
  }

  /** Visit active items with wrapped |s - sCenter| <= radius. */
  forEachInWindow(sCenter: number, radius: number, visit: (index: number) => void): void {
    // items are few (≤ 128); a plain scan over the sorted order with early
    // wrap handling is simpler than two binary searches and just as fast here
    for (let i = 0; i < this.count; i += 1) {
      const idx = this.order[i]!;
      if (this.state[idx] !== CollectibleState.Active) continue;
      if (Math.abs(wrapDelta(this.s[idx]!, sCenter, this.trackLength)) <= radius) {
        visit(idx);
      }
    }
  }

  /**
   * Put every active item whose (s, y) lies inside the polygon (in unwrapped
   * track coordinates) into the vacuuming state. Returns how many started.
   */
  vacuumInPolygon(polygon: readonly Vec2[]): number {
    const centroid = polygonCentroid2D(polygon);
    let started = 0;
    for (let i = 0; i < this.count; i += 1) {
      if (this.state[i] !== CollectibleState.Active) continue;
      // lift the wrapped item s into the unwrapped range nearest the polygon
      const k = Math.round((centroid.x - this.s[i]!) / this.trackLength);
      const lifted = this.s[i]! + k * this.trackLength;
      if (pointInPolygon2D({ x: lifted, y: this.y[i]! }, polygon)) {
        this.state[i] = CollectibleState.Vacuuming;
        this.vacuumT[i] = 0;
        started += 1;
      }
    }
    return started;
  }

  /**
   * Free-run world refresh: return any Collected item whose respawn time has
   * arrived back to Active so it renders and can be flown through again.
   */
  updateRespawns(now: number): void {
    for (let i = 0; i < this.count; i += 1) {
      if (this.state[i] !== CollectibleState.Collected) continue;
      const at = this.respawnAt[i]!;
      if (at !== 0 && at <= now) {
        this.state[i] = CollectibleState.Active;
        this.vacuumT[i] = 0;
        this.respawnAt[i] = 0;
      }
    }
  }

  /**
   * Advance vacuum tweens; calls collect(index) for each item that reached
   * the player this step.
   */
  updateVacuums(dt: number, collect: (index: number) => void): void {
    for (let i = 0; i < this.count; i += 1) {
      if (this.state[i] !== CollectibleState.Vacuuming) continue;
      this.vacuumT[i] = this.vacuumT[i]! + dt / VACUUM_DURATION;
      if (this.vacuumT[i]! >= 1) {
        this.state[i] = CollectibleState.Collected;
        collect(i);
      }
    }
  }
}
