import "server-only";
import { learningFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const learning = createReservedService("learning", learningFeatures);
