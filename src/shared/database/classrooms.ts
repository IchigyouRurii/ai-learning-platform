import "server-only";
import { getAppMode } from "@/shared/config";
import {
  ClassroomError,
  createClassroomRepository,
} from "./classroom-repository";
import type { ClassroomRepository } from "./extension-repositories";
import { getDatabasePool } from "./pool";
const runtime = globalThis as typeof globalThis & {
  minicourseClassrooms?: ClassroomRepository;
};
export function getClassroomRepository(): ClassroomRepository {
  if (getAppMode() !== "neon")
    throw new ClassroomError(
      "DEPENDENCY_UNAVAILABLE",
      "Classroom management requires the Neon database. It is not available in local demo mode.",
    );
  runtime.minicourseClassrooms ??= createClassroomRepository(getDatabasePool());
  return runtime.minicourseClassrooms;
}
