import "server-only";
import {
  administrationFeatures,
  accountProfileFeatures,
} from "@/shared/contracts/features";
import { createReservedService } from "./reserved-service";

export const administration = createReservedService(
  "administration",
  administrationFeatures,
);
export const accountProfiles = createReservedService(
  "accountProfiles",
  accountProfileFeatures,
);
