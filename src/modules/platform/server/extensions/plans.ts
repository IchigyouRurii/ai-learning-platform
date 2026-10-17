import "server-only";
import {
  profileFeatures,
  learningPathFeatures,
} from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const learningProfiles = createReservedService(
  "learningProfiles",
  profileFeatures,
);
export const learningPaths = createReservedService(
  "learningPaths",
  learningPathFeatures,
);
