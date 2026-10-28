import "server-only";
import { accountProfileFeatures } from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";
import { createAdministrationService } from "../administration-service";
import { getAdministrationRepository } from "@/shared/database/administration";

export const administration = createAdministrationService(
  getAdministrationRepository,
);
export const accountProfiles = createReservedService(
  "accountProfiles",
  accountProfileFeatures,
);
