import type { CourseDefinition } from "@/game/spline/courseTypes";

/**
 * A stage is pure data plus (later) a static environment component and a
 * collectible layout. Adding a stage must never require engine changes.
 */
export interface StageDefinition {
  id: string;
  /** in-game display name */
  name: string;
  course: CourseDefinition;
  timeLimit: number;
  chipsRequired: number;
}
