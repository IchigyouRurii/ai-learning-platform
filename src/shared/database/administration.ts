import "server-only";
import { getAppMode } from "@/shared/config";
import {
  AdministrationError,
  createAdministrationRepository,
} from "./administration-repository";
import type { AdministrationRepository } from "./extension-repositories";
import { getDatabasePool } from "./pool";

const runtime = globalThis as typeof globalThis & {
  minicourseAdministration?: AdministrationRepository;
};
export function getAdministrationRepository(): AdministrationRepository {
  if (getAppMode() !== "neon")
    throw new AdministrationError(
      "DEPENDENCY_UNAVAILABLE",
      "Administrator tools require the Neon database. Local demo mode does not provide administrator access.",
    );
  runtime.minicourseAdministration ??=
    createAdministrationRepository(getDatabasePool());
  return runtime.minicourseAdministration;
}
