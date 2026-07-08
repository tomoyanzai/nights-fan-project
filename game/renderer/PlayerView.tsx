"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Group,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { CHARACTER } from "@/game/assets/characterSpec";
import { damp } from "@/game/engine/math";
import { useGame } from "./GameContext";
import { RibbonTrail } from "./RibbonTrail";

const TWO_PI = Math.PI * 2;

function useHornGeometry(side: 1 | -1): TubeGeometry {
  return useMemo(() => {
    const pts = [
      new Vector3(0, 0, 0),
      new Vector3(side * 0.16, 0.2, -0.05),
      new Vector3(side * 0.34, 0.3, -0.2),
      new Vector3(side * 0.5, 0.24, -0.38),
      new Vector3(side * CHARACTER.hornLength, 0.1, -0.5),
    ];
    return new TubeGeometry(new CatmullRomCurve3(pts), 12, 0.07, 6, false);
  }, [side]);
}

/**
 * The procedural jester flyer. Geometry is built once; every pose change is
 * procedural animation in useFrame driven by the flight state: banking arms,
 * idle bob, and the drill-dash spin.
 */
export function PlayerView() {
  const game = useGame();
  const rootRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const armRRef = useRef<Group>(null);
  const spinAngle = useRef(0);
  const armPose = useRef(0);
  const lastT = useRef(0);

  const torsoGeo = useMemo(
    () => new LatheGeometry(CHARACTER.torsoProfile.map(([r, y]) => new Vector2(r, y)), 20),
    [],
  );
  const hornL = useHornGeometry(-1);
  const hornR = useHornGeometry(1);

  useFrame(() => {
    const root = rootRef.current;
    const spin = spinRef.current;
    const armL = armLRef.current;
    const armR = armRRef.current;
    if (!root || !spin || !armL || !armR) return;

    game.player.writeRenderTransform(root, game.loop.alpha);

    const t = game.renderTime(game.loop.alpha);
    // blink while invulnerable after a hit (~12 Hz flicker), solid otherwise
    root.visible = game.player.state.invulnTimer <= 0 || Math.sin(t * 75) > -0.3;
    const dt = Math.max(t - lastT.current, 0);
    lastT.current = t;
    const st = game.player.state;
    const speed = game.player.speed;

    // idle floating bob, fading out with speed
    const bob = Math.sin(t * 2.1) * 0.08 * Math.max(1 - speed / 8, 0);
    spin.position.y = bob;

    // drill dash: spin around the flight axis + slight stretch
    if (st.boosting) {
      spinAngle.current = (spinAngle.current + dt * TWO_PI * 3.5) % TWO_PI;
      spin.scale.set(0.92, 0.92, 1.15);
    } else {
      // unwind to the nearest upright turn
      spinAngle.current = damp(
        spinAngle.current > Math.PI ? spinAngle.current - TWO_PI : spinAngle.current,
        0,
        10,
        dt,
      );
      spin.scale.set(1, 1, 1);
    }
    spin.rotation.z = spinAngle.current;

    // arms: relaxed at rest, swept back with speed, thrust forward drilling
    const targetPose = st.boosting ? -1 : Math.min(speed / 26, 1);
    armPose.current = damp(armPose.current, targetPose, 6, dt);
    const p = armPose.current;
    const back = Math.max(p, 0);
    const fwd = Math.max(-p, 0);
    // rest: slightly out and down; back: swept behind; fwd: superman
    armL.rotation.set(-0.5 + back * 1.5 - fwd * 2.2, 0.35 - back * 0.5 - fwd * 0.3, -0.4 + back * 0.7);
    armR.rotation.set(-0.5 + back * 1.5 - fwd * 2.2, -0.35 + back * 0.5 + fwd * 0.3, 0.4 - back * 0.7);
  });

  const c = CHARACTER.colors;
  return (
    <>
      {/* trail lives in world space — it must not inherit the player transform */}
      <RibbonTrail />
      <group ref={rootRef}>
      <group ref={spinRef}>
        {/* torso: lathe teardrop, nose along +Z */}
        <mesh geometry={torsoGeo} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color={c.body}
            emissive={c.body}
            emissiveIntensity={0.25}
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>
        {/* chest accent */}
        <mesh position={[0, 0.05, 0.3]} scale={[1, 1, 0.55]}>
          <sphereGeometry args={[0.27, 16, 12]} />
          <meshStandardMaterial color={c.chest} roughness={0.4} />
        </mesh>

        {/* head */}
        <group position={[0, 0.08, CHARACTER.headZ]}>
          <mesh>
            <sphereGeometry args={[CHARACTER.headRadius, 18, 14]} />
            <meshStandardMaterial color={c.head} roughness={0.5} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.1, 0.05, 0.21]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={c.eye} emissive={c.eye} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.1, 0.05, 0.21]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={c.eye} emissive={c.eye} emissiveIntensity={0.8} />
          </mesh>
          {/* jester hat: cap + two curling horns with lit tips */}
          <mesh position={[0, 0.12, -0.02]}>
            <sphereGeometry args={[0.27, 16, 10, 0, TWO_PI, 0, Math.PI / 2]} />
            <meshStandardMaterial color={c.hat} roughness={0.5} />
          </mesh>
          <group position={[0, 0.3, 0]}>
            <mesh geometry={hornL}>
              <meshStandardMaterial color={c.hat} roughness={0.5} />
            </mesh>
            <mesh geometry={hornR}>
              <meshStandardMaterial color={c.hat} roughness={0.5} />
            </mesh>
            <mesh position={[-CHARACTER.hornLength, 0.1, -0.5]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color={c.hatTip} emissive={c.hatTip} emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[CHARACTER.hornLength, 0.1, -0.5]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color={c.hatTip} emissive={c.hatTip} emissiveIntensity={1.2} />
            </mesh>
          </group>
        </group>

        {/* collar */}
        <mesh position={[0, 0.06, 0.62]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]}>
          <torusGeometry args={[0.26, 0.07, 8, 20]} />
          <meshStandardMaterial color={c.collar} roughness={0.6} />
        </mesh>

        {/* arms with gloved hands */}
        {(
          [
            [-1, armLRef],
            [1, armRRef],
          ] as const
        ).map(([side, ref]) => (
          <group
            key={side}
            ref={ref}
            position={[side * CHARACTER.shoulderX, 0.08, CHARACTER.shoulderZ]}
          >
            <mesh position={[side * 0.05, -CHARACTER.armLength / 2, 0]} rotation={[0, 0, side * 0.15]}>
              <capsuleGeometry args={[0.07, CHARACTER.armLength - 0.2, 4, 8]} />
              <meshStandardMaterial color={c.bodyAccent} roughness={0.45} />
            </mesh>
            <mesh position={[side * 0.09, -CHARACTER.armLength + 0.05, 0]}>
              <sphereGeometry args={[0.12, 10, 8]} />
              <meshStandardMaterial color={c.glove} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
      </group>
    </>
  );
}
