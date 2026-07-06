import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from "three";
import { DEFAULT_CORRIDOR, type CourseDefinition } from "./courseTypes";

/** Orthonormal frame at an arc length s along the track. */
export class TrackFrame {
  readonly position = new Vector3();
  readonly tangent = new Vector3();
  readonly up = new Vector3();
  readonly side = new Vector3();
  readonly quaternion = new Quaternion();
}

export interface TrackSample {
  s: number;
  position: Vector3;
  quaternion: Quaternion;
  corridor: [number, number];
}

const WORLD_UP = new Vector3(0, 1, 0);

// scratch objects — frameAt is called many times per frame
const _m = new Matrix4();
const _qa = new Quaternion();
const _qRot = new Quaternion();
const _va = new Vector3();
const _vb = new Vector3();

/**
 * Closed course spline with an explicit arc-length sample table and
 * rotation-minimizing frames.
 *
 * Why not three's getPointAt: its internal LUT is coarse and its frames
 * (Frenet) flip at inflection points. We parallel-transport an up vector
 * along the curve instead (never flips, works through vertical loops) and
 * distribute the end-to-start roll mismatch across the whole loop so the
 * closed course is seamless.
 */
export class SplineTrack {
  readonly totalLength: number;
  readonly samples: TrackSample[];

  private readonly cumulative: Float64Array;
  private lastIndex = 0;

  constructor(def: CourseDefinition) {
    const controlPoints = def.points.map((p) => new Vector3(...p.pos));
    const curve = new CatmullRomCurve3(controlPoints, true, "centripetal");
    const numPoints = def.points.length;
    const n = numPoints * (def.samplesPerSegment ?? 32);

    // --- positions + cumulative arc length ---
    const positions: Vector3[] = [];
    const tangents: Vector3[] = [];
    this.cumulative = new Float64Array(n + 1);
    for (let i = 0; i <= n; i += 1) {
      const t = (i % n) / n;
      positions.push(curve.getPoint(t));
      tangents.push(curve.getTangent(t).normalize());
      if (i > 0) {
        this.cumulative[i] = this.cumulative[i - 1]! + positions[i]!.distanceTo(positions[i - 1]!);
      }
    }
    this.totalLength = this.cumulative[n]!;

    // --- rotation-minimizing frames via parallel transport ---
    const ups: Vector3[] = [];
    const up0 = WORLD_UP.clone().addScaledVector(tangents[0]!, -WORLD_UP.dot(tangents[0]!));
    if (up0.lengthSq() < 1e-6) up0.set(0, 0, 1); // tangent is vertical at start
    up0.normalize();
    ups.push(up0);
    for (let i = 1; i <= n; i += 1) {
      _qRot.setFromUnitVectors(tangents[i - 1]!, tangents[i]!);
      ups.push(ups[i - 1]!.clone().applyQuaternion(_qRot));
    }

    // --- closure correction: distribute the roll mismatch over the loop ---
    // tangents[n] === tangents[0], so the transported up[n] differs from
    // up[0] only by a roll about the tangent.
    const endUp = ups[n]!;
    const cosA = clampUnit(endUp.dot(up0));
    _va.crossVectors(endUp, up0);
    const sinA = clampUnit(_va.dot(tangents[0]!));
    const rollError = Math.atan2(sinA, cosA);
    for (let i = 0; i <= n; i += 1) {
      const roll = rollError * (this.cumulative[i]! / this.totalLength);
      _qRot.setFromAxisAngle(tangents[i]!, roll);
      ups[i]!.applyQuaternion(_qRot);
      // re-orthonormalize (parallel transport drifts slightly)
      ups[i]!.addScaledVector(tangents[i]!, -ups[i]!.dot(tangents[i]!)).normalize();
    }

    // --- pack samples: quaternion basis X=side, Y=up, Z=tangent ---
    // side = up × tangent keeps the basis right-handed (det +1); the reverse
    // order is a reflection and setFromRotationMatrix silently corrupts on it.
    this.samples = [];
    for (let i = 0; i <= n; i += 1) {
      const side = _va.crossVectors(ups[i]!, tangents[i]!).normalize().clone();
      _m.makeBasis(side, ups[i]!, tangents[i]!);
      const q = new Quaternion().setFromRotationMatrix(_m);
      const u = (i % n) / n;
      this.samples.push({
        s: this.cumulative[i]!,
        position: positions[i]!,
        quaternion: q,
        corridor: corridorAtParam(def, u),
      });
    }
  }

  wrap(s: number): number {
    const L = this.totalLength;
    return ((s % L) + L) % L;
  }

  frameAt(s: number, out: TrackFrame): TrackFrame {
    const [i, t] = this.locate(this.wrap(s));
    const a = this.samples[i]!;
    const b = this.samples[i + 1]!;
    out.position.lerpVectors(a.position, b.position, t);
    _qa.slerpQuaternions(a.quaternion, b.quaternion, t);
    out.quaternion.copy(_qa);
    out.side.set(1, 0, 0).applyQuaternion(_qa);
    out.up.set(0, 1, 0).applyQuaternion(_qa);
    out.tangent.set(0, 0, 1).applyQuaternion(_qa);
    return out;
  }

  /** World position of track-space coordinates (s, y). */
  worldPos(s: number, y: number, out: Vector3, frame?: TrackFrame): Vector3 {
    const f = frame ?? _sharedFrame;
    this.frameAt(s, f);
    return out.copy(f.position).addScaledVector(f.up, y);
  }

  /**
   * Signed curvature of the course heading in the swept plane (rad/m).
   * Positive when the course bends toward +side.
   */
  curvatureAt(s: number, ds = 1.5): number {
    this.frameAt(s - ds, _frameA);
    this.frameAt(s + ds, _frameB);
    _va.crossVectors(_frameA.tangent, _frameB.tangent);
    // component of the rotation axis along the (average) up = in-plane turn
    _vb.addVectors(_frameA.up, _frameB.up).normalize();
    return Math.asin(clampUnit(_va.dot(_vb))) / (2 * ds);
  }

  corridorAt(s: number): [number, number] {
    const [i, t] = this.locate(this.wrap(s));
    const a = this.samples[i]!.corridor;
    const b = this.samples[i + 1]!.corridor;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /** sample index + interpolation factor for a wrapped s (cached, coherent). */
  private locate(s: number): [number, number] {
    const cum = this.cumulative;
    const n = cum.length - 1;
    let i = this.lastIndex;
    if (i >= n) i = n - 1;
    // walk from the cached index (queries are frame-coherent)...
    if (cum[i]! <= s && s <= cum[i + 1]!) {
      // hit
    } else if (cum[i + 1]! < s) {
      while (i + 1 < n && cum[i + 1]! < s) i += 1;
    } else if (cum[i]! > s) {
      while (i > 0 && cum[i]! > s) i -= 1;
    }
    // ...fall back to binary search if the walk went wrong
    if (!(cum[i]! <= s && s <= cum[i + 1]!)) {
      let lo = 0;
      let hi = n;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! <= s) lo = mid;
        else hi = mid;
      }
      i = lo;
    }
    this.lastIndex = i;
    const span = cum[i + 1]! - cum[i]!;
    return [i, span > 0 ? (s - cum[i]!) / span : 0];
  }
}

const _sharedFrame = new TrackFrame();
const _frameA = new TrackFrame();
const _frameB = new TrackFrame();

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Interpolate control-point corridors at curve parameter u ∈ [0, 1). */
function corridorAtParam(def: CourseDefinition, u: number): [number, number] {
  const n = def.points.length;
  const x = u * n;
  const i = Math.floor(x) % n;
  const t = x - Math.floor(x);
  const a = def.points[i]?.corridor ?? DEFAULT_CORRIDOR;
  const b = def.points[(i + 1) % n]?.corridor ?? DEFAULT_CORRIDOR;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
