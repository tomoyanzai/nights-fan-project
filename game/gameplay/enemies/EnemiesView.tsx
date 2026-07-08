"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import { TrackFrame } from "@/game/spline/splineTrack";
import { useGame } from "@/game/renderer/GameContext";
import { EnemyFsm, type EnemyKind } from "./enemyTypes";
import type { EnemyRuntime } from "./enemySystem";

const _dummy = new Object3D();
const _frame = new TrackFrame();
const _epos = new Vector3();
const _ppos = new Vector3();
const _yawQ = new Quaternion();
const _up = new Vector3(0, 1, 0);

interface KindProps {
  kind: EnemyKind;
  geometry: BufferGeometry;
  color: string;
  emissive: string;
}

/**
 * One InstancedMesh for every nightmaren of a kind. Poses are readable at a
 * glance: enemies billboard-yaw to face the player while Searching/Attacking,
 * pulse in Search, and stretch forward during the Attack lunge. Dead enemies
 * collapse to zero scale until they respawn.
 */
function EnemyInstances({ kind, geometry, color, emissive }: KindProps) {
  const game = useGame();
  const meshRef = useRef<InstancedMesh>(null);

  const list = useMemo(
    () => game.enemies.enemies.filter((e) => e.kind === kind),
    [game, kind],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = game.renderTime(game.loop.alpha);
    game.player.worldPosition(_ppos);

    for (let i = 0; i < list.length; i += 1) {
      const e = list[i]!;
      if (e.state === EnemyFsm.Dead) {
        _dummy.scale.setScalar(0.0001);
        _dummy.position.set(0, -9999, 0);
        _dummy.quaternion.identity();
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      // frame at the enemy also gives us its world position
      game.track.worldPos(e.s, e.y, _epos, _frame);
      _dummy.position.copy(_epos);

      const facing = e.state === EnemyFsm.Search || e.state === EnemyFsm.Attack;
      let yaw: number;
      if (facing) {
        const dx = _ppos.x - _epos.x;
        const dy = _ppos.y - _epos.y;
        const dz = _ppos.z - _epos.z;
        const tang = dx * _frame.tangent.x + dy * _frame.tangent.y + dz * _frame.tangent.z;
        const side = dx * _frame.side.x + dy * _frame.side.y + dz * _frame.side.z;
        yaw = Math.atan2(side, tang);
      } else {
        yaw = t * 0.6 + i;
      }
      _yawQ.setFromAxisAngle(_up, yaw);
      _dummy.quaternion.copy(_frame.quaternion).multiply(_yawQ);

      // pose: pulse while searching, stretch forward mid-lunge
      let sx = 1;
      let sy = 1;
      let sz = 1;
      if (e.state === EnemyFsm.Search) {
        const pulse = 1 + Math.sin(t * 8 + i) * 0.15;
        sx = sy = sz = pulse;
      } else if (e.state === EnemyFsm.Attack) {
        sz = 1.6;
        sx = sy = 0.75;
      }
      _dummy.scale.set(sx, sy, sz);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // at least one instance so the buffer is valid even if a kind is unused
  const count = Math.max(list.length, 1);
  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={1.1}
        roughness={0.35}
        metalness={0.4}
      />
    </instancedMesh>
  );
}

export function EnemiesView() {
  const floaterGeo = useMemo(() => new IcosahedronGeometry(1.3, 0), []);
  const chaserGeo = useMemo(() => {
    const g = new OctahedronGeometry(1.15, 0);
    g.scale(0.8, 1.6, 0.8); // stretch into a spike ball
    return g;
  }, []);

  return (
    <>
      <EnemyInstances kind="floater" geometry={floaterGeo} color="#2a1240" emissive="#7b3fe4" />
      <EnemyInstances kind="chaser" geometry={chaserGeo} color="#160512" emissive="#ff2fd0" />
    </>
  );
}
