import "server-only";
import { discussionFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const discussions = createReservedService(
  "discussions",
  discussionFeatures,
);
