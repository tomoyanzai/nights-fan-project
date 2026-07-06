import type { StageDefinition } from "../stageTypes";
import { verdantHollowCourse } from "./course";
import { compileLayout } from "./layout";
import { VerdantHollowEnvironment } from "./environment";
import { MARE } from "@/game/core/constants";

export const springValley: StageDefinition = {
  id: "spring-valley",
  name: "Verdant Hollow",
  course: verdantHollowCourse,
  layout: compileLayout(),
  Environment: VerdantHollowEnvironment,
  timeLimit: MARE.timeLimit,
  chipsRequired: MARE.chipsRequired,
};
