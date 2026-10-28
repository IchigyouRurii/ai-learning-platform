import "server-only";
import { classroomFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const classrooms = createReservedService(
  "classrooms",
  classroomFeatures,
);
