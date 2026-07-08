"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  type MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { BOSS } from "@/game/core/constants";
import { TrackFrame } from "@/game/spline/splineTrack";
import { useGame } from "@/game/renderer/GameContext";

const _dummy = new Object3D();
const _frame = new TrackFrame();
const _hpos = new Vector3();
const _npos = new Vector3();
const _prevPos = new Vector3();
const _yawQ = new Quaternion();
const _up = new Vector3(0, 1, 0);

/** per-segment radius taper, baked into instance scale (1.6 → 0.9) */
function segScale(i: number, count: number): number {
  const t = count > 1 ? i / (count - 1) : 0;
  return (BOSS.segmentRadius + (0.9 - BOSS.segmentRadius) * t) / BOSS.segmentRadius;
}

/**
 * The Maelstrom's body. Reads node positions straight from BossSystem every
 * frame (no game logic here): a stretched head mesh yaws toward its travel
 * direction, one InstancedMesh draws the tapering body segments, and the gold
 * tail orb pulses when exposed and dims when hidden. Hidden entirely while the
 * boss is inactive; the dissolve scales segments away back-to-front.
 */
export function BossView() {
  const game = useGame();
  const groupRef = useRef<Group>(null);
  const headRef = useRef<Mesh>(null);
  const segRef = useRef<InstancedMesh>(null);
  const tailRef = useRef<Mesh>(null);

  const headGeo = useMemo(() => {
    const g = new IcosahedronGeometry(2.5, 1);
    g.scale(0.8, 0.8, 1.35); // snout-forward
    return g;
  }, []);
  const segGeo = useMemo(() => new SphereGeometry(BOSS.segmentRadius, 16, 12), []);
  const tailGeo = useMemo(() => new SphereGeometry(1.0, 20, 16), []);
  const segCount = game.boss.segments.length;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const boss = game.boss;
    group.visible = boss.active;
    if (!boss.active) return;

    const t = game.renderTime(game.loop.alpha);
    const dissolve = boss.dissolveProgress; // 0..1

    // --- head: place and yaw toward travel (head → first segment vector) ---
    const head = headRef.current;
    if (head) {
      game.track.worldPos(boss.head.s, boss.head.y, _hpos, _frame);
      head.position.copy(_hpos);
      const seg0 = boss.segments[0]!;
      game.track.worldPos(seg0.s, seg0.y, _prevPos);
      // travel direction is head minus the node just behind it
      const dx = _hpos.x - _prevPos.x;
      const dy = _hpos.y - _prevPos.y;
      const dz = _hpos.z - _prevPos.z;
      const tang = dx * _frame.tangent.x + dy * _frame.tangent.y + dz * _frame.tangent.z;
      const side = dx * _frame.side.x + dy * _frame.side.y + dz * _frame.side.z;
      _yawQ.setFromAxisAngle(_up, Math.atan2(side, tang));
      head.quaternion.copy(_frame.quaternion).multiply(_yawQ);
      const hs = dissolve > 0 ? Math.max(1 - dissolve * 1.4, 0) : 1;
      head.scale.setScalar(hs);
    }

    // --- body segments (one InstancedMesh) ---
    const seg = segRef.current;
    if (seg) {
      for (let i = 0; i < segCount; i += 1) {
        const node = boss.segments[i]!;
        game.track.worldPos(node.s, node.y, _npos);
        _dummy.position.copy(_npos);
        _dummy.quaternion.identity();
        let s = segScale(i, segCount);
        if (dissolve > 0) {
          // vanish back-to-front: the tail-most segment goes first
          const local = 1 - i / segCount; // ~1 at tail end, ~0 near head
          s *= 1 - Math.min(Math.max(dissolve * 1.6 - local, 0), 1);
        }
        _dummy.scale.setScalar(Math.max(s, 0.0001));
        _dummy.updateMatrix();
        seg.setMatrixAt(i, _dummy.matrix);
      }
      seg.instanceMatrix.needsUpdate = true;
    }

    // --- tail orb: pulse when exposed, dim + shrink when hidden ---
    const tail = tailRef.current;
    if (tail) {
      game.track.worldPos(boss.tail.s, boss.tail.y, _npos);
      tail.position.copy(_npos);
      const exposed = boss.tailExposed;
      const pulse = exposed ? 1 + Math.sin(t * 6) * 0.12 : 0.6;
      const ts = dissolve > 0 ? Math.max(1 - dissolve * 1.2, 0) * pulse : pulse;
      tail.scale.setScalar(Math.max(ts, 0.0001));
      (tail.material as MeshStandardMaterial).emissiveIntensity = exposed ? 1.8 : 0.1;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={headRef} geometry={headGeo} frustumCulled={false}>
        <meshStandardMaterial color="#2a0f44" emissive="#c81fd0" emissiveIntensity={0.9} roughness={0.4} metalness={0.5} />
        {/* eyes */}
        <mesh position={[0.9, 0.5, 1.4]}>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffd76a" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[-0.9, 0.5, 1.4]}>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffd76a" emissiveIntensity={2.4} />
        </mesh>
      </mesh>

      <instancedMesh ref={segRef} args={[segGeo, undefined, segCount]} frustumCulled={false}>
        <meshStandardMaterial color="#1e0a34" emissive="#8e2fbe" emissiveIntensity={1.0} roughness={0.45} metalness={0.4} />
      </instancedMesh>

      <mesh ref={tailRef} geometry={tailGeo} frustumCulled={false}>
        <meshStandardMaterial color="#fff0b8" emissive="#ffd76a" emissiveIntensity={1.8} roughness={0.2} metalness={0.3} />
      </mesh>
    </group>
  );
}
