import "server-only";
import { courseManagementFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const courseManagement = createReservedService(
  "courseManagement",
  courseManagementFeatures,
);
