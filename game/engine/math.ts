import type { Vec2 } from "@/game/core/types";

export const TWO_PI = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate-independent exponential smoothing toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Critically damped spring step (stable implicit form). Returns the new
 * position and velocity; `omega` is the angular frequency (higher = snappier).
 */
export function springDamp(
  x: number,
  v: number,
  target: number,
  omega: number,
  dt: number,
): [number, number] {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const detInv = 1 / (f + dt * dt * oo);
  const newX = (f * x + dt * v + dt * dt * oo * target) * detInv;
  const newV = (v + dt * oo * (target - x)) * detInv;
  return [newX, newV];
}

/** Shortest-path angle wrap into (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  return a;
}

/**
 * Intersection of segments (a1→a2) and (b1→b2). Returns the intersection
 * point or null. Touching endpoints do not count (strict interior test),
 * which is what paraloop detection wants — adjacent path segments share
 * endpoints.
 */
export function segSegIntersect2D(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-12) return null; // parallel
  const dx = b1.x - a1.x;
  const dy = b1.y - a1.y;
  const t = (dx * dby - dy * dbx) / denom;
  const u = (dx * day - dy * dax) / denom;
  const EPS = 1e-9;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon2D(p: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    if (pi.y > p.y !== pj.y > p.y) {
      const xCross = ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
      if (p.x < xCross) inside = !inside;
    }
  }
  return inside;
}

/** Signed polygon area (shoelace). Positive = counter-clockwise. */
export function polygonArea2D(polygon: readonly Vec2[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    area += pj.x * pi.y - pi.x * pj.y;
  }
  return area / 2;
}

export function polygonCentroid2D(polygon: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  const n = Math.max(polygon.length, 1);
  return { x: cx / n, y: cy / n };
}
