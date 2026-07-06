import type { TrackPoint } from "@/game/gameplay/collectibleField";

/**
 * Collectible placement authored as patterns along the course, compiled to
 * flat (s, y) lists. s in metres along the ~976 m lap, y as offset in the
 * swept plane.
 */
type LayoutPattern =
  | { type: "ringLine"; s0: number; s1: number; count: number; y0: number; y1?: number }
  | { type: "ringWave"; s0: number; s1: number; count: number; yBase: number; amp: number }
  | { type: "chipLine"; s0: number; s1: number; count: number; y0: number; y1?: number }
  /** circle in the (s, y) plane — invites a paraloop */
  | { type: "chipCircle"; s: number; y: number; radius: number; count: number };

const patterns: LayoutPattern[] = [
  // --- south straight: warm-up line + first chips ---
  { type: "ringLine", s0: 25, s1: 125, count: 9, y0: 3 },
  { type: "chipLine", s0: 135, s1: 175, count: 5, y0: 4.5 },
  // --- loop approach climbs ---
  { type: "ringWave", s0: 190, s1: 250, count: 7, yBase: 2, amp: 3 },
  // --- through the vertical loop ---
  { type: "ringLine", s0: 262, s1: 352, count: 7, y0: 0 },
  // --- loop exit: paraloop classroom ---
  { type: "chipCircle", s: 380, y: 3, radius: 5, count: 6 },
  // --- north ridge: long flowing wave ---
  { type: "ringWave", s0: 400, s1: 560, count: 14, yBase: 3, amp: 5 },
  { type: "chipLine", s0: 500, s1: 545, count: 5, y0: 9 },
  // --- canyon: low risk/reward line ---
  { type: "ringLine", s0: 585, s1: 700, count: 10, y0: -2 },
  { type: "chipCircle", s: 730, y: 1, radius: 4.5, count: 6 },
  // --- banked turn home ---
  { type: "ringWave", s0: 770, s1: 900, count: 11, yBase: 3, amp: 4 },
  { type: "chipLine", s0: 905, s1: 945, count: 6, y0: 3 },
];

export interface StageLayout {
  rings: TrackPoint[];
  chips: TrackPoint[];
}

export function compileLayout(): StageLayout {
  const rings: TrackPoint[] = [];
  const chips: TrackPoint[] = [];
  for (const p of patterns) {
    switch (p.type) {
      case "ringLine":
      case "chipLine": {
        const out = p.type === "ringLine" ? rings : chips;
        for (let i = 0; i < p.count; i += 1) {
          const t = p.count === 1 ? 0 : i / (p.count - 1);
          out.push({ s: p.s0 + (p.s1 - p.s0) * t, y: p.y0 + ((p.y1 ?? p.y0) - p.y0) * t });
        }
        break;
      }
      case "ringWave": {
        for (let i = 0; i < p.count; i += 1) {
          const t = p.count === 1 ? 0 : i / (p.count - 1);
          rings.push({
            s: p.s0 + (p.s1 - p.s0) * t,
            y: p.yBase + Math.sin(t * Math.PI * 2) * p.amp,
          });
        }
        break;
      }
      case "chipCircle": {
        for (let i = 0; i < p.count; i += 1) {
          const a = (i / p.count) * Math.PI * 2;
          chips.push({ s: p.s + Math.cos(a) * p.radius, y: p.y + Math.sin(a) * p.radius });
        }
        break;
      }
    }
  }
  return { rings, chips };
}
