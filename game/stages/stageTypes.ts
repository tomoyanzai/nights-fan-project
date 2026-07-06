import type { ComponentType } from "react";
import type { CourseDefinition } from "@/game/spline/courseTypes";
import type { TrackPoint } from "@/game/gameplay/collectibleField";

/**
 * A stage is pure data plus a static environment component and a collectible
 * layout. Adding a stage must never require engine changes.
 */
export interface StageDefinition {
  id: string;
  /** in-game display name */
  name: string;
  course: CourseDefinition;
  layout: {
    rings: TrackPoint[];
    chips: TrackPoint[];
  };
  /** static scenery; must be mounted at scene root (it attaches the fog) */
  Environment: ComponentType;
  timeLimit: number;
  chipsRequired: number;
}
