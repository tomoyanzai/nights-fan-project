import { PARALOOP } from "@/game/core/constants";
import type { Vec2 } from "@/game/core/types";
import { polygonArea2D, segSegIntersect2D } from "@/game/engine/math";
import type { PlayerState } from "./playerState";

/**
 * Paraloop detection: when the flight path crosses itself, everything inside
 * the enclosed loop is vacuumed to the player. All math happens in unwrapped
 * track-space 2D (sUnwrapped, y) — the flight path lives on the swept course
 * surface, so this is exact for our flight model, cheap, and immune to the
 * course seam.
 */
export class ParaloopDetector {
  /** invoked with the loop polygon (unwrapped track coords) */
  onLoop: ((polygon: Vec2[]) => void) | null = null;

  private crumbs: { x: number; y: number; t: number }[] = [];
  private now = 0;
  private hoverTime = 0;

  reset(): void {
    this.crumbs.length = 0;
    this.now = 0;
    this.hoverTime = 0;
  }

  update(dt: number, state: PlayerState): void {
    this.now += dt;

    // hovering wipes the trail — drawing a loop requires actual flight
    const speed = Math.hypot(state.vs, state.vy);
    if (speed < PARALOOP.hoverSpeed) {
      this.hoverTime += dt;
      if (this.hoverTime > PARALOOP.hoverResetTime) {
        this.crumbs.length = 0;
        return;
      }
    } else {
      this.hoverTime = 0;
    }

    // expire old crumbs from the front
    const cutoff = this.now - PARALOOP.maxAge;
    let expired = 0;
    while (expired < this.crumbs.length && this.crumbs[expired]!.t < cutoff) expired += 1;
    if (expired > 0) this.crumbs.splice(0, expired);

    // drop a crumb every crumbSpacing metres of travel
    const px = state.sUnwrapped;
    const py = state.y;
    const last = this.crumbs[this.crumbs.length - 1];
    if (last) {
      const moved = Math.hypot(px - last.x, py - last.y);
      if (moved < PARALOOP.crumbSpacing) return;
    }
    this.crumbs.push({ x: px, y: py, t: this.now });
    if (this.crumbs.length > PARALOOP.maxCrumbs) this.crumbs.shift();

    this.checkSelfIntersection();
  }

  /** current trail, for the debug visualizer */
  get trail(): readonly { x: number; y: number }[] {
    return this.crumbs;
  }

  private checkSelfIntersection(): void {
    const n = this.crumbs.length;
    if (n < PARALOOP.minCrumbs + 1) return;
    const a1 = this.crumbs[n - 2]!;
    const a2 = this.crumbs[n - 1]!;
    // test the newest segment against all older ones, skipping the 4 most
    // recent (adjacent segments always nearly touch)
    for (let i = 0; i < n - 5; i += 1) {
      const b1 = this.crumbs[i]!;
      const b2 = this.crumbs[i + 1]!;
      const hit = segSegIntersect2D(a1, a2, b1, b2);
      if (!hit) continue;

      const polygon: Vec2[] = [hit];
      for (let j = i + 1; j < n - 1; j += 1) {
        polygon.push({ x: this.crumbs[j]!.x, y: this.crumbs[j]!.y });
      }
      if (polygon.length < PARALOOP.minCrumbs) return;
      if (Math.abs(polygonArea2D(polygon)) < PARALOOP.minArea) return;

      this.crumbs.length = 0; // prevent double fires
      this.onLoop?.(polygon);
      return;
    }
  }
}
