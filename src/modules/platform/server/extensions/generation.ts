import "server-only";
import { generationFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const generation = createReservedService(
  "generation",
  generationFeatures,
);
