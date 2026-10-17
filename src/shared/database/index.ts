import "server-only";
import { join } from "node:path";
import { getAppMode } from "@/shared/config";
import { createDemoRepository } from "./demo-repository";
import { createLocalPlatformRepository } from "./local-platform-repository";
import { createNeonRepository } from "./neon-repository";
import { getDatabasePool } from "./pool";
import type { PlatformRepository } from "./repository";

const runtime = globalThis as typeof globalThis & {
  minicourseLocalPlatform?: PlatformRepository;
  minicourseNeonPlatform?: PlatformRepository;
};
export function getRepository(): PlatformRepository {
  if (getAppMode() === "neon") {
    runtime.minicourseNeonPlatform ??= createNeonRepository(getDatabasePool());
    return runtime.minicourseNeonPlatform;
  }
  runtime.minicourseLocalPlatform ??= createLocalPlatformRepository(
    createDemoRepository(join(process.cwd(), ".local", "demo.json")),
  );
  return runtime.minicourseLocalPlatform;
}
