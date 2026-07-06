"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { PALETTE } from "@/game/assets/palette";
import { fbm2D, createRng } from "@/game/engine/rng";
import { skyVertex, skyFragment } from "@/game/shaders/sky";
import { guideVertex, guideFragment } from "@/game/shaders/courseGuide";
import { useGame } from "@/game/renderer/GameContext";
import { useGameStore } from "@/game/core/gameStore";
import { GOAL_S } from "@/game/gameplay/mareDirector";
import { TrackFrame } from "@/game/spline/splineTrack";

const SEED = 20260706;

/* ------------------------------------------------------------------ sky */

function SkyDome() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new Color(PALETTE.skyZenith) },
      uMid: { value: new Color(PALETTE.skyMid) },
      uHorizon: { value: new Color(PALETTE.skyHorizon) },
      uSunColor: { value: new Color(PALETTE.sun) },
      uSunDir: { value: new Vector3(0.35, 0.42, -0.6).normalize() },
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[700, 32, 24]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
        uniforms={uniforms}
        side={BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------- terrain */

function useTerrainGeometry(): BufferGeometry {
  const game = useGame();
  return useMemo(() => {
    const SIZE = 560;
    const SEGS = 96;
    const plane = new PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    plane.rotateX(-Math.PI / 2);

    // course ground projection for carving the valley under the corridor
    const courseXZ = game.track.samples.map((s) => ({
      x: s.position.x,
      z: s.position.z,
      y: s.position.y,
    }));

    const pos = plane.attributes.position!;
    const low = new Color(PALETTE.terrainLow);
    const high = new Color(PALETTE.terrainHigh);
    const rock = new Color(PALETTE.terrainRock);
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let h = fbm2D(x * 0.008 + 10, z * 0.008 + 10, SEED, 4) * 26 - 6;
      // gentle bowl: rise toward the outside of the play area
      const r = Math.hypot(x, z);
      h += Math.max(r - 210, 0) * 0.12;

      // carve under the course so the corridor is always clear
      let nearest = Infinity;
      let courseY = 0;
      for (const p of courseXZ) {
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < nearest) {
          nearest = d;
          courseY = p.y;
        }
      }
      const dist = Math.sqrt(nearest);
      const ceiling = courseY - 13;
      const blend = smoothstep(14, 42, dist);
      h = Math.min(h, ceiling + (h - ceiling) * blend);

      pos.setY(i, h);

      const hn = clamp01((h + 8) / 34);
      c.copy(low).lerp(high, hn);
      if (hn > 0.75) c.lerp(rock, (hn - 0.75) / 0.25);
      // subtle patchiness
      const patch = fbm2D(x * 0.05, z * 0.05, SEED + 7, 2) * 0.16;
      c.offsetHSL(0, 0, patch - 0.08);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    plane.setAttribute("color", new Float32BufferAttribute(colors, 3));

    // flat-shaded low-poly look
    const geo = plane.toNonIndexed();
    geo.computeVertexNormals();
    plane.dispose();
    return geo;
  }, [game]);
}

function Terrain() {
  const geometry = useTerrainGeometry();
  return (
    <mesh geometry={geometry} receiveShadow={false}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

/* ------------------------------------------------------ floating islands */

interface IslandSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
}

function useIslandSpots(): IslandSpot[] {
  const game = useGame();
  return useMemo(() => {
    const rng = createRng(SEED + 99);
    const spots: IslandSpot[] = [];
    const samples = game.track.samples;
    let guard = 0;
    while (spots.length < 13 && guard < 400) {
      guard += 1;
      const angle = rng() * Math.PI * 2;
      const radius = 40 + rng() * 200;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 28 + rng() * 30;
      // keep clear of the course corridor
      let minD = Infinity;
      for (const s of samples) {
        const d =
          (s.position.x - x) ** 2 + (s.position.y - y) ** 2 + (s.position.z - z) ** 2;
        if (d < minD) minD = d;
      }
      if (minD < 33 * 33) continue;
      spots.push({ x, y, z, scale: 0.7 + rng() * 1.3, rot: rng() * Math.PI * 2 });
    }
    return spots;
  }, [game]);
}

function FloatingIslands() {
  const spots = useIslandSpots();
  const rockRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const canopyRef = useRef<InstancedMesh>(null);
  const trunkRef = useRef<InstancedMesh>(null);

  const geos = useMemo(() => {
    // jittered inverted cone reads as a torn-out chunk of rock
    const rock = new ConeGeometry(6, 9, 7, 2);
    rock.rotateX(Math.PI); // point down
    const rng = createRng(SEED + 5);
    const rp = rock.attributes.position!;
    for (let i = 0; i < rp.count; i += 1) {
      rp.setX(i, rp.getX(i) * (0.85 + rng() * 0.3));
      rp.setZ(i, rp.getZ(i) * (0.85 + rng() * 0.3));
    }
    rock.computeVertexNormals();
    const cap = new SphereGeometry(6.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopy = new SphereGeometry(2.4, 8, 6);
    const trunk = new ConeGeometry(0.5, 3.5, 6);
    return { rock, cap, canopy, trunk };
  }, []);

  // instances are static; write matrices on first frame only
  const initialized = useRef(false);
  useFrame(() => {
    if (initialized.current) return;
    const rock = rockRef.current;
    const cap = capRef.current;
    const canopy = canopyRef.current;
    const trunk = trunkRef.current;
    if (!rock || !cap || !canopy || !trunk) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const scl = new Vector3();
    spots.forEach((spot, i) => {
      q.setFromAxisAngle(up, spot.rot);
      scl.setScalar(spot.scale);
      m.compose(new Vector3(spot.x, spot.y - 4.5 * spot.scale, spot.z), q, scl);
      rock.setMatrixAt(i, m);
      m.compose(new Vector3(spot.x, spot.y, spot.z), q, scl);
      cap.setMatrixAt(i, m);
      // tree sits on the cap surface: at offset 2.5 the hemisphere (r 6.2)
      // stands ~5.7 high, so the trunk/canopy must clear that
      const tx = spot.x + Math.cos(spot.rot) * 2.5 * spot.scale;
      const tz = spot.z + Math.sin(spot.rot) * 2.5 * spot.scale;
      m.compose(new Vector3(tx, spot.y + 7.3 * spot.scale, tz), q, scl);
      trunk.setMatrixAt(i, m);
      m.compose(new Vector3(tx, spot.y + 9.7 * spot.scale, tz), q, scl);
      canopy.setMatrixAt(i, m);
    });
    rock.instanceMatrix.needsUpdate = true;
    cap.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
    initialized.current = true;
  });

  const n = spots.length;
  return (
    <group>
      <instancedMesh ref={rockRef} args={[geos.rock, undefined, n]}>
        {/* the cone underside faces away from every light; a touch of
            emissive keeps it violet instead of black */}
        <meshStandardMaterial
          color={PALETTE.islandRock}
          emissive={PALETTE.islandRock}
          emissiveIntensity={0.35}
          flatShading
          roughness={0.9}
        />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[geos.cap, undefined, n]}>
        <meshStandardMaterial color={PALETTE.islandGrass} flatShading roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[geos.trunk, undefined, n]}>
        <meshStandardMaterial color={PALETTE.treeTrunk} flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[geos.canopy, undefined, n]}>
        <meshStandardMaterial color={PALETTE.treeCanopy} flatShading roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

/* ----------------------------------------------------------- course guide */

function CourseGuide() {
  const game = useGame();
  const matRef = useRef<ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const track = game.track;
    const frame = new TrackFrame();
    const HALF_WIDTH = 2.6;
    const STEP = 3;
    const count = Math.floor(track.totalLength / STEP) + 1;
    const positions = new Float32Array(count * 2 * 3);
    const aS = new Float32Array(count * 2);
    const aAcross = new Float32Array(count * 2);
    const indices: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const s = Math.min(i * STEP, track.totalLength - 0.001);
      track.frameAt(s, frame);
      const base = i * 6;
      positions[base] = frame.position.x - frame.side.x * HALF_WIDTH;
      positions[base + 1] = frame.position.y - frame.side.y * HALF_WIDTH;
      positions[base + 2] = frame.position.z - frame.side.z * HALF_WIDTH;
      positions[base + 3] = frame.position.x + frame.side.x * HALF_WIDTH;
      positions[base + 4] = frame.position.y + frame.side.y * HALF_WIDTH;
      positions[base + 5] = frame.position.z + frame.side.z * HALF_WIDTH;
      aS[i * 2] = s / track.totalLength;
      aS[i * 2 + 1] = s / track.totalLength;
      aAcross[i * 2] = -1;
      aAcross[i * 2 + 1] = 1;
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aS", new Float32BufferAttribute(aS, 1));
    geometry.setAttribute("aAcross", new Float32BufferAttribute(aAcross, 1));
    geometry.setIndex(indices);
    const uniforms = {
      uColor: { value: new Color(PALETTE.guide) },
      uTime: { value: 0 },
    };
    return { geometry, uniforms };
  }, [game]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={guideVertex}
        fragmentShader={guideFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={DoubleSide}
        fog={false}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------- goal gate */

function GoalGate() {
  const game = useGame();
  const goalUnlocked = useGameStore((s) => s.goalUnlocked);
  const gateRef = useRef<Mesh>(null);

  const transform = useMemo(() => {
    const frame = new TrackFrame();
    game.track.frameAt(GOAL_S, frame);
    return {
      position: frame.position.clone().addScaledVector(frame.up, 3),
      quaternion: frame.quaternion.clone(),
    };
  }, [game]);

  useFrame((state) => {
    const gate = gateRef.current;
    if (!gate) return;
    const t = state.clock.elapsedTime;
    const pulse = goalUnlocked ? 1 + Math.sin(t * 3) * 0.06 : 1;
    gate.scale.setScalar(pulse);
  });

  return (
    <group position={transform.position} quaternion={transform.quaternion}>
      <mesh ref={gateRef}>
        <torusGeometry args={[6, 0.5, 12, 48]} />
        <meshStandardMaterial
          color={PALETTE.goal}
          emissive={PALETTE.goal}
          emissiveIntensity={goalUnlocked ? 1.6 : 0.15}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ composition */

export function VerdantHollowEnvironment() {
  return (
    <>
      {/* fog attaches to the scene — this component must mount at scene root */}
      <fog attach="fog" args={[PALETTE.fog, 90, 420]} />
      <hemisphereLight args={[PALETTE.skyMid, PALETTE.terrainLow, 0.9]} />
      <directionalLight position={[80, 120, -60]} intensity={1.5} color={PALETTE.sun} />
      {/* fill from the camera side of the course so the flyer never reads black */}
      <directionalLight position={[-70, 50, 80]} intensity={0.55} color={PALETTE.skyHorizon} />
      <ambientLight intensity={0.25} color={PALETTE.skyHorizon} />
      <SkyDome />
      <Terrain />
      <FloatingIslands />
      <CourseGuide />
      <GoalGate />
    </>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
