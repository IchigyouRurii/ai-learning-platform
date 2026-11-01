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
  minicourseAdministrationPool?: ReturnType<typeof getDatabasePool>;
};
export function getAdministrationRepository(): AdministrationRepository {
  if (getAppMode() !== "neon")
    throw new AdministrationError(
      "DEPENDENCY_UNAVAILABLE",
      "Administrator tools require the Neon database. Local demo mode does not provide administrator access.",
    );
  const pool = getDatabasePool();
  if (
    !runtime.minicourseAdministration ||
    runtime.minicourseAdministrationPool !== pool
  ) {
    runtime.minicourseAdministration = createAdministrationRepository(pool);
    runtime.minicourseAdministrationPool = pool;
  }
  return runtime.minicourseAdministration;
}
