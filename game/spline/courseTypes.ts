export interface CoursePoint {
  pos: [number, number, number];
  /**
   * Playable vertical band around the course line, as offsets along the
   * frame's up vector: [yMin, yMax]. Interpolated between control points.
   */
  corridor?: [number, number];
}

export interface CourseDefinition {
  name: string;
  /** control points of a closed centripetal Catmull-Rom loop */
  points: CoursePoint[];
  /** curve samples per control-point segment (default 32) */
  samplesPerSegment?: number;
}

export const DEFAULT_CORRIDOR: [number, number] = [-8, 16];
