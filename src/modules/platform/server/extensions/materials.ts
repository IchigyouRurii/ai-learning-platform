import "server-only";
import { materialFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const materials = createReservedService("materials", materialFeatures);
