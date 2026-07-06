"use client";

import { useEffect, useMemo, useState } from "react";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { TrackFrame } from "@/game/spline/splineTrack";
import { useGame } from "@/game/renderer/GameContext";

const TRIAD_SPACING = 5; // metres between frame triads
const TRIAD_LENGTH = 2;

/**
 * Draws the course centreline, corridor bounds, and frame triads
 * (red = side, green = up, blue = tangent). Equal triad spacing visually
 * verifies arc-length parameterization; smooth triads through the vertical
 * loop verify the rotation-minimizing frames. Toggle with backquote (`).
 */
export function SplineVisualizer() {
  const game = useGame();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Backquote") setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { centerGeo, corridorGeo, triadGeo } = useMemo(() => {
    const track = game.track;
    const frame = new TrackFrame();
    const pos = new Vector3();

    // centreline straight from the sample table
    const center: number[] = [];
    for (const sample of track.samples) {
      center.push(sample.position.x, sample.position.y, sample.position.z);
    }
    const centerGeo = new BufferGeometry();
    centerGeo.setAttribute("position", new Float32BufferAttribute(center, 3));

    // corridor bounds as line segments between consecutive stations
    const corridor: number[] = [];
    const STEP = 2;
    const prevMin = new Vector3();
    const prevMax = new Vector3();
    for (let s = 0, first = true; s <= track.totalLength; s += STEP) {
      const [yMin, yMax] = track.corridorAt(s);
      track.frameAt(s, frame);
      const curMin = pos.copy(frame.position).addScaledVector(frame.up, yMin).clone();
      const curMax = pos.copy(frame.position).addScaledVector(frame.up, yMax).clone();
      if (!first) {
        corridor.push(prevMin.x, prevMin.y, prevMin.z, curMin.x, curMin.y, curMin.z);
        corridor.push(prevMax.x, prevMax.y, prevMax.z, curMax.x, curMax.y, curMax.z);
      }
      prevMin.copy(curMin);
      prevMax.copy(curMax);
      first = false;
    }
    const corridorGeo = new BufferGeometry();
    corridorGeo.setAttribute("position", new Float32BufferAttribute(corridor, 3));

    // frame triads with vertex colors
    const triadPos: number[] = [];
    const triadCol: number[] = [];
    const pushSegment = (origin: Vector3, dir: Vector3, r: number, g: number, b: number) => {
      triadPos.push(origin.x, origin.y, origin.z);
      triadPos.push(
        origin.x + dir.x * TRIAD_LENGTH,
        origin.y + dir.y * TRIAD_LENGTH,
        origin.z + dir.z * TRIAD_LENGTH,
      );
      triadCol.push(r, g, b, r, g, b);
    };
    for (let s = 0; s < track.totalLength; s += TRIAD_SPACING) {
      track.frameAt(s, frame);
      pushSegment(frame.position, frame.side, 1, 0.25, 0.25);
      pushSegment(frame.position, frame.up, 0.25, 1, 0.25);
      pushSegment(frame.position, frame.tangent, 0.35, 0.55, 1);
    }
    const triadGeo = new BufferGeometry();
    triadGeo.setAttribute("position", new Float32BufferAttribute(triadPos, 3));
    triadGeo.setAttribute("color", new Float32BufferAttribute(triadCol, 3));

    return { centerGeo, corridorGeo, triadGeo };
  }, [game]);

  useEffect(() => {
    return () => {
      centerGeo.dispose();
      corridorGeo.dispose();
      triadGeo.dispose();
    };
  }, [centerGeo, corridorGeo, triadGeo]);

  if (!visible) return null;
  return (
    <group>
      <lineLoop geometry={centerGeo}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </lineLoop>
      <lineSegments geometry={corridorGeo}>
        <lineBasicMaterial color="#ffd76a" transparent opacity={0.35} />
      </lineSegments>
      <lineSegments geometry={triadGeo}>
        <lineBasicMaterial vertexColors />
      </lineSegments>
    </group>
  );
}
