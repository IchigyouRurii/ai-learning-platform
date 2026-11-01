import "server-only";
import { join } from "node:path";
import { getAppMode } from "@/shared/config";
import { createDemoRepository } from "./demo-repository";
import { createLocalPlatformRepository } from "./local-platform-repository";
import { createNeonRepository } from "./neon-repository";
import { createNeonClassroomRepository } from "./classroom-repository";
import { getDatabasePool } from "./pool";
import type { ClassroomRosterRepository } from "./extension-repositories";
import type { PlatformRepository, Repository } from "./repository";
export { getAdministrationRepository } from "./administration";

const runtime = globalThis as typeof globalThis & {
  minicourseLocalPlatform?: PlatformRepository;
  minicourseNeonPlatform?: PlatformRepository;
  minicourseNeonPlatformPool?: ReturnType<typeof getDatabasePool>;
  minicourseNeonClassroomPool?: ReturnType<typeof getDatabasePool>;
  minicourseNeonClassroom?: ClassroomRosterRepository;
  minicourseLocalPlatformFactory?: typeof createLocalPlatformRepository;
  minicourseNeonPlatformFactory?: typeof createNeonRepository;
  minicourseDemoStore?: Repository;
};
/** Cache connections/storage, but refresh adapter methods after a development hot update. */
export function getRepository(): PlatformRepository {
  if (getAppMode() === "neon") {
    const pool = getDatabasePool();
    if (
      !runtime.minicourseNeonPlatform ||
      runtime.minicourseNeonPlatformFactory !== createNeonRepository ||
      runtime.minicourseNeonPlatformPool !== pool
    ) {
      runtime.minicourseNeonPlatform = createNeonRepository(pool);
      runtime.minicourseNeonPlatformFactory = createNeonRepository;
      runtime.minicourseNeonPlatformPool = pool;
    }
    return runtime.minicourseNeonPlatform;
  }
  if (
    !runtime.minicourseLocalPlatform ||
    runtime.minicourseLocalPlatformFactory !== createLocalPlatformRepository
  ) {
    // Preserve the store's serialization queue when only the adapter hot-reloads.
    runtime.minicourseDemoStore ??= createDemoRepository(
      join(process.cwd(), ".local", "demo.json"),
    );
    runtime.minicourseLocalPlatform = createLocalPlatformRepository(
      runtime.minicourseDemoStore,
    );
    runtime.minicourseLocalPlatformFactory = createLocalPlatformRepository;
  }
  return runtime.minicourseLocalPlatform;
}

export function getClassroomRepository(): ClassroomRosterRepository | null {
  if (getAppMode() !== "neon") return null;
  const pool = getDatabasePool();
  if (
    !runtime.minicourseNeonClassroom ||
    runtime.minicourseNeonClassroomPool !== pool
  ) {
    runtime.minicourseNeonClassroom = createNeonClassroomRepository(pool);
    runtime.minicourseNeonClassroomPool = pool;
  }
  return runtime.minicourseNeonClassroom;
}
