"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  Vector3,
} from "three";
import { useGame } from "./GameContext";

const MAX_PARTICLES = 512;

const _color = new Color();
const _pos = new Vector3();
const _playerPos = new Vector3();

/**
 * Single pooled CPU particle system for every burst effect: pickup sparkles,
 * paraloop vacuum spirals, boost motes. Additive points; "alpha" fade is done
 * by darkening vertex colors (black is invisible under additive blending).
 */
class ParticlePool {
  readonly positions = new Float32Array(MAX_PARTICLES * 3);
  readonly colors = new Float32Array(MAX_PARTICLES * 3);
  readonly velocities = new Float32Array(MAX_PARTICLES * 3);
  readonly baseColors = new Float32Array(MAX_PARTICLES * 3);
  readonly life = new Float32Array(MAX_PARTICLES);
  readonly maxLife = new Float32Array(MAX_PARTICLES);
  readonly drag = new Float32Array(MAX_PARTICLES);
  private cursor = 0;

  spawn(
    x: number,
    y: number,
    z: number,
    count: number,
    color: Color,
    speed: number,
    lifeSeconds: number,
    dir?: Vector3,
    spread = 1,
  ): void {
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const rx = (Math.random() - 0.5) * 2 * spread;
      const ry = (Math.random() - 0.5) * 2 * spread;
      const rz = (Math.random() - 0.5) * 2 * spread;
      this.velocities[i * 3] = ((dir?.x ?? 0) + rx) * speed;
      this.velocities[i * 3 + 1] = ((dir?.y ?? 0) + ry) * speed;
      this.velocities[i * 3 + 2] = ((dir?.z ?? 0) + rz) * speed;
      this.baseColors[i * 3] = color.r;
      this.baseColors[i * 3 + 1] = color.g;
      this.baseColors[i * 3 + 2] = color.b;
      this.life[i] = lifeSeconds;
      this.maxLife[i] = lifeSeconds;
      this.drag[i] = 2.5;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (this.life[i]! <= 0) continue;
      this.life[i] = this.life[i]! - dt;
      const k = Math.exp(-this.drag[i]! * dt);
      this.velocities[i * 3]! *= k;
      this.velocities[i * 3 + 1]! *= k;
      this.velocities[i * 3 + 2]! *= k;
      this.positions[i * 3] = this.positions[i * 3]! + this.velocities[i * 3]! * dt;
      this.positions[i * 3 + 1] = this.positions[i * 3 + 1]! + this.velocities[i * 3 + 1]! * dt;
      this.positions[i * 3 + 2] = this.positions[i * 3 + 2]! + this.velocities[i * 3 + 2]! * dt;
      const fade = Math.max(this.life[i]! / this.maxLife[i]!, 0);
      const f = fade * fade;
      this.colors[i * 3] = this.baseColors[i * 3]! * f;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1]! * f;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2]! * f;
    }
  }
}

export function Particles() {
  const game = useGame();
  const pointsRef = useRef<Points>(null);
  const pool = useMemo(() => new ParticlePool(), []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pool.positions, 3));
    geo.setAttribute("color", new Float32BufferAttribute(pool.colors, 3));
    return geo;
  }, [pool]);

  useEffect(() => {
    const offs = [
      game.events.on("ring:collected", (e) => {
        _color.set("#ffd76a");
        pool.spawn(e.worldPos[0], e.worldPos[1], e.worldPos[2], 14, _color, 6, 0.7);
      }),
      game.events.on("chip:collected", (e) => {
        _color.set("#7ad4ff");
        pool.spawn(e.worldPos[0], e.worldPos[1], e.worldPos[2], 16, _color, 7, 0.8);
      }),
      game.events.on("paraloop", (e) => {
        // shimmer along the loop polygon, drifting toward the player
        game.player.worldPosition(_playerPos);
        _color.set("#ff9af0");
        for (const p of e.polygon) {
          if (Math.random() > 0.6) continue;
          game.track.worldPos(game.track.wrap(p.x), p.y, _pos);
          const dir = _pos.clone().sub(_playerPos).multiplyScalar(-0.15);
          pool.spawn(_pos.x, _pos.y, _pos.z, 2, _color, 1, 1.1, dir, 0.2);
        }
      }),
      game.events.on("bounds:hit", () => {
        game.player.worldPosition(_playerPos);
        _color.set("#ffffff");
        pool.spawn(_playerPos.x, _playerPos.y, _playerPos.z, 8, _color, 4, 0.4);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [game, pool]);

  useFrame((_, frameDt) => {
    // boost motes stream continuously while drilling
    if (game.player.state.boosting) {
      game.player.worldPosition(_playerPos);
      _color.set("#ffb0ff");
      pool.spawn(_playerPos.x, _playerPos.y, _playerPos.z, 2, _color, 3, 0.5);
    }
    pool.update(Math.min(frameDt, 0.05));
    const geo = pointsRef.current?.geometry;
    if (geo) {
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.color!.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        vertexColors
        size={0.4}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
