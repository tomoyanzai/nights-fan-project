"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
} from "three";
import { ribbonVertex, ribbonFragment } from "@/game/shaders/ribbon";
import { useGame } from "./GameContext";

const SAMPLES = 64;
const BASE_HALF_WIDTH = 0.55;

const _pos = new Vector3();
const _up = new Vector3();
const _target = { position: new Vector3(), quaternion: new Quaternion() };

/**
 * The rainbow ribbon behind the flyer. A ring buffer of world-space samples
 * (position + banked up vector + speed-scaled width) is rewritten into a
 * dynamic triangle strip every frame — 128 vertices, trivial cost.
 */
export function RibbonTrail() {
  const game = useGame();
  const samples = useRef({
    pos: Array.from({ length: SAMPLES }, () => new Vector3()),
    up: Array.from({ length: SAMPLES }, () => new Vector3(0, 1, 0)),
    width: new Float32Array(SAMPLES),
    head: 0,
    filled: 0,
  });

  const { geometry, uniforms } = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3);
    positions.setUsage(DynamicDrawUsage);
    const ages = new Float32BufferAttribute(new Float32Array(SAMPLES * 2), 1);
    ages.setUsage(DynamicDrawUsage);
    const across = new Float32Array(SAMPLES * 2);
    for (let i = 0; i < SAMPLES; i += 1) {
      across[i * 2] = -1;
      across[i * 2 + 1] = 1;
    }
    geometry.setAttribute("position", positions);
    geometry.setAttribute("aAge", ages);
    geometry.setAttribute("aAcross", new Float32BufferAttribute(across, 1));
    const indices: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(indices);
    const uniforms = { uTime: { value: 0 } };
    return { geometry, uniforms };
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    const buf = samples.current;
    const st = game.player.state;

    game.player.writeRenderTransform(_target, game.loop.alpha);
    const speed = game.player.speed;

    // record a new sample while moving; when idle the trail drains away
    if (speed > 1.5) {
      buf.head = (buf.head + 1) % SAMPLES;
      buf.pos[buf.head]!.copy(_target.position);
      _up.set(0, 1, 0).applyQuaternion(_target.quaternion);
      buf.up[buf.head]!.copy(_up);
      buf.width[buf.head] =
        BASE_HALF_WIDTH * (0.4 + Math.min(speed / 26, 1.4)) * (st.boosting ? 1.6 : 1);
      buf.filled = Math.min(buf.filled + 1, SAMPLES);
    } else if (buf.filled > 0) {
      buf.filled -= 1;
    }

    const posAttr = geometry.attributes.position as Float32BufferAttribute;
    const ageAttr = geometry.attributes.aAge as Float32BufferAttribute;
    for (let i = 0; i < SAMPLES; i += 1) {
      // i = 0 newest … SAMPLES-1 oldest
      const alive = i < buf.filled;
      const idx = ((buf.head - i) % SAMPLES + SAMPLES) % SAMPLES;
      const p = buf.pos[idx]!;
      const u = buf.up[idx]!;
      const w = alive ? buf.width[idx]! : 0;
      _pos.copy(p).addScaledVector(u, -w);
      posAttr.setXYZ(i * 2, _pos.x, _pos.y, _pos.z);
      _pos.copy(p).addScaledVector(u, w);
      posAttr.setXYZ(i * 2 + 1, _pos.x, _pos.y, _pos.z);
      const age = buf.filled > 1 ? i / (buf.filled - 1) : 1;
      ageAttr.setX(i * 2, Math.min(age, 1));
      ageAttr.setX(i * 2 + 1, Math.min(age, 1));
    }
    posAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={ribbonVertex}
        fragmentShader={ribbonFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        fog={false}
      />
    </mesh>
  );
}
