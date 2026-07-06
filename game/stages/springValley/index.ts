import type { StageDefinition } from "../stageTypes";
import { verdantHollowCourse } from "./course";
import { MARE } from "@/game/core/constants";

export const springValley: StageDefinition = {
  id: "spring-valley",
  name: "Verdant Hollow",
  course: verdantHollowCourse,
  timeLimit: MARE.timeLimit,
  chipsRequired: MARE.chipsRequired,
};
