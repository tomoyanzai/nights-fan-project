"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Quaternion, Vector3, type BufferGeometry } from "three";
import { CollectibleState, type CollectibleField } from "@/game/gameplay/collectibleField";
import { TrackFrame } from "@/game/spline/splineTrack";
import { useGame } from "./GameContext";

const _dummy = new Object3D();
const _playerPos = new Vector3();
const _spin = new Quaternion();
const _zAxis = new Vector3(0, 0, 1);
const _yAxis = new Vector3(0, 1, 0);

interface Props {
  field: CollectibleField;
  geometry: BufferGeometry;
  color: string;
  emissive: string;
  /** rings face along the track; chips are upright gems */
  orient: "ring" | "chip";
  scale?: number;
}

/**
 * One InstancedMesh for a whole collectible field. Base transforms are
 * precomputed; per frame we only compose spin/bob (and vacuum tweens toward
 * the player). Collected items collapse to zero scale.
 */
export function CollectibleInstances({ field, geometry, color, emissive, orient, scale = 1 }: Props) {
  const game = useGame();
  const meshRef = useRef<InstancedMesh>(null);

  const base = useMemo(() => {
    const frame = new TrackFrame();
    const positions: Vector3[] = [];
    const quaternions: Quaternion[] = [];
    for (let i = 0; i < field.count; i += 1) {
      const pos = new Vector3();
      game.track.worldPos(field.s[i]!, field.y[i]!, pos, frame);
      positions.push(pos);
      quaternions.push(frame.quaternion.clone());
    }
    return { positions, quaternions };
  }, [field, game]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = game.renderTime(game.loop.alpha);
    game.player.worldPosition(_playerPos);

    for (let i = 0; i < field.count; i += 1) {
      const state = field.state[i]!;
      if (state === CollectibleState.Collected) {
        _dummy.position.copy(base.positions[i]!);
        _dummy.scale.setScalar(0.0001);
        _dummy.quaternion.identity();
      } else {
        const bob = Math.sin(t * 2 + i * 1.7) * 0.25;
        _dummy.position.copy(base.positions[i]!);
        _dummy.position.y += bob;
        _dummy.quaternion.copy(base.quaternions[i]!);
        if (orient === "ring") {
          // slow roll around the through-axis
          _spin.setFromAxisAngle(_zAxis, t * 0.8 + i);
        } else {
          _spin.setFromAxisAngle(_yAxis, t * 1.6 + i * 0.5);
        }
        _dummy.quaternion.multiply(_spin);
        _dummy.scale.setScalar(scale);

        if (state === CollectibleState.Vacuuming) {
          const k = field.vacuumT[i]!;
          _dummy.position.lerp(_playerPos, k * k);
          _dummy.scale.setScalar(scale * (1 - k * 0.6));
        }
      }
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, field.count]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.9}
        roughness={0.25}
        metalness={0.3}
      />
    </instancedMesh>
  );
}
