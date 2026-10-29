import "server-only";
import type { z } from "zod";
import type { User } from "@/shared/contracts";
import {
  classroomFeatures,
  type FeatureDefinition,
  type FeatureResult,
} from "@/shared/contracts/features";
import { getClassroomRepository } from "@/shared/database";
import type { ClassroomRosterRepository } from "@/shared/database/extension-repositories";
import { FeatureServiceError, featureFailure } from "./errors";
import { createReservedService } from "./reserved-service";

type RepositoryGetter = () => ClassroomRosterRepository | null;

function requireRepository(getRepository: RepositoryGetter) {
  const repository = getRepository();
  if (!repository)
    throw new FeatureServiceError(
      "DEPENDENCY_UNAVAILABLE",
      "Class management requires the live database. Set APP_MODE=neon and apply the classroom migrations.",
    );
  return repository;
}

function assertCursor(cursor: string | undefined) {
  if (cursor && !/^\d+$/.test(cursor))
    throw new FeatureServiceError("INVALID_INPUT", "Invalid page cursor.");
}

function bind<I extends z.ZodType, O extends z.ZodType>(
  definition: FeatureDefinition & { input: I; output: O },
  getRepository: RepositoryGetter,
  handler: (actor: User, input: z.output<I>) => Promise<z.output<O>>,
) {
  return async (
    actor: User | null,
    input: z.input<I>,
  ): Promise<FeatureResult<z.output<O>>> => {
    if (!actor)
      return {
        ok: false,
        code: "AUTH_REQUIRED",
        error: "Please sign in first.",
      };
    if (!definition.roles.includes(actor.role))
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "Your role cannot perform this action.",
      };
    const parsed = definition.input.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: parsed.error.issues[0]?.message ?? "Invalid input format.",
      };
    try {
      return { ok: true, data: await handler(actor, parsed.data) };
    } catch (error) {
      return featureFailure(error);
    }
  };
}

export function createClassroomService(getRepository: RepositoryGetter) {
  async function requireOwnedClass(
    repository: ClassroomRosterRepository,
    actor: User,
    classId: string,
  ) {
    const classroom = await repository.findForActor(actor, classId);
    if (!classroom)
      throw new FeatureServiceError(
        "NOT_FOUND",
        "Class not found or you do not have permission to manage it.",
      );
    return classroom;
  }

  return Object.freeze({
    ...createReservedService("classrooms", classroomFeatures),
    create: bind(
      classroomFeatures.create,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        const classroom = await repository.create(actor, input);
        if (!classroom)
          throw new FeatureServiceError(
            "INVALID_INPUT",
            "Choose one of your published cohort courses and valid students.",
          );
        return classroom;
      },
    ),
    get: bind(
      classroomFeatures.get,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        const classroom = await repository.findForActor(actor, input.classId);
        if (!classroom)
          throw new FeatureServiceError("NOT_FOUND", "Class not found.");
        return classroom;
      },
    ),
    deleteClass: bind(
      classroomFeatures.deleteClass,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        await requireOwnedClass(repository, actor, input.classId);
        return { deleted: await repository.deleteClass(actor, input.classId) };
      },
    ),
    listMine: bind(
      classroomFeatures.listMine,
      getRepository,
      async (actor, input) => {
        assertCursor(input.cursor);
        return requireRepository(getRepository).listMine(actor, input);
      },
    ),
    listMembers: bind(
      classroomFeatures.listMembers,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        await requireOwnedClass(repository, actor, input.classId);
        return repository.listMembers(actor, input.classId);
      },
    ),
    listStudents: bind(
      classroomFeatures.listStudents,
      getRepository,
      async (actor, input) => {
        assertCursor(input.cursor);
        return requireRepository(getRepository).listStudents(actor, input);
      },
    ),
    importStudents: bind(
      classroomFeatures.importStudents,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        await requireOwnedClass(repository, actor, input.classId);
        const emails = [
          ...new Set(input.emails.map((email) => email.trim().toLowerCase())),
        ];
        return repository.importExistingStudents(actor, input.classId, emails);
      },
    ),
    removeMember: bind(
      classroomFeatures.removeMember,
      getRepository,
      async (actor, input) => {
        const repository = requireRepository(getRepository);
        await requireOwnedClass(repository, actor, input.classId);
        return {
          removed: await repository.removeMember(
            actor,
            input.classId,
            input.studentId,
          ),
        };
      },
    ),
  });
}

export const classrooms = createClassroomService(getClassroomRepository);
