import type { StageDefinition } from "../stageTypes";
import { verdantHollowCourse } from "./course";
import { compileLayout } from "./layout";
import { MARE } from "@/game/core/constants";

export const springValley: StageDefinition = {
  id: "spring-valley",
  name: "Verdant Hollow",
  course: verdantHollowCourse,
  layout: compileLayout(),
  timeLimit: MARE.timeLimit,
  chipsRequired: MARE.chipsRequired,
};
