import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import {
  classroomFeatures,
  type FeatureDefinition,
  type FeatureResult,
  type User,
} from "@/shared/contracts";
import type { ClassroomRepository } from "@/shared/database/extension-repositories";
import { ClassroomError } from "@/shared/database/classroom-repository";
import { featureFailure } from "./extensions/errors";
import { createReservedService } from "./extensions/reserved-service";
export const hashJoinCode = (code: string) =>
  createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
export function createClassroomService(
  getRepository: () => ClassroomRepository,
) {
  function bind<I extends z.ZodType, O extends z.ZodType>(
    definition: { input: I; output: O; roles: FeatureDefinition["roles"] },
    operation: (
      repo: ClassroomRepository,
      actor: User,
      input: z.output<I>,
    ) => Promise<z.input<O>>,
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
          error: "Your account cannot perform this classroom action.",
        };
      try {
        const parsed = definition.input.parse(input);
        const result = await operation(getRepository(), actor, parsed);
        return { ok: true, data: definition.output.parse(result) };
      } catch (error) {
        if (error instanceof ClassroomError)
          return { ok: false, code: error.code, error: error.message };
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error.code === "42P01" || error.code === "42703")
        )
          return {
            ok: false,
            code: "DEPENDENCY_UNAVAILABLE",
            error:
              "Classroom database setup is incomplete. Ask the project owner to apply the latest migrations.",
          };
        return featureFailure(error);
      }
    };
  }
  const reserved = createReservedService("classrooms", {
    inviteStudents: classroomFeatures.inviteStudents,
    acceptInvitation: classroomFeatures.acceptInvitation,
  });
  return Object.freeze({
    ...reserved,
    create: bind(classroomFeatures.create, (repo, actor, input) =>
      repo.create(actor, input),
    ),
    update: bind(classroomFeatures.update, (repo, actor, input) =>
      repo.update(actor, input),
    ),
    get: bind(classroomFeatures.get, async (repo, actor, input) => {
      const classroom = await repo.findForActor(actor, input.classId);
      if (!classroom)
        throw new ClassroomError(
          "NOT_FOUND",
          "Classroom not found or access denied.",
        );
      return classroom;
    }),
    listMine: bind(classroomFeatures.listMine, (repo, actor, input) =>
      repo.listMine(actor, input),
    ),
    listMembers: bind(classroomFeatures.listMembers, (repo, actor, input) =>
      repo.listMembers(actor, input.classId),
    ),
    importStudents: bind(
      classroomFeatures.importStudents,
      (repo, actor, input) =>
        repo.importExistingStudents(actor, input.classId, input.emails),
    ),
    createJoinCode: bind(
      classroomFeatures.createJoinCode,
      async (repo, actor, input) => {
        const code = randomBytes(10).toString("hex").toUpperCase();
        const expiresAt = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        await repo.saveJoinCode(
          actor,
          input.classId,
          hashJoinCode(code),
          expiresAt,
        );
        return { code, expiresAt };
      },
    ),
    joinByCode: bind(classroomFeatures.joinByCode, (repo, actor, input) =>
      repo.joinByCodeHash(actor, hashJoinCode(input.code)),
    ),
    removeMember: bind(
      classroomFeatures.removeMember,
      async (repo, actor, input) => ({
        removed: await repo.removeMember(actor, input.classId, input.studentId),
      }),
    ),
    listAssignableCourses: bind(
      classroomFeatures.listAssignableCourses,
      (repo, actor, input) => repo.listAssignableCourses(actor, input.classId),
    ),
    assignCourse: bind(classroomFeatures.assignCourse, (repo, actor, input) =>
      repo.assignCourse(actor, input),
    ),
    removeAssignment: bind(
      classroomFeatures.removeAssignment,
      async (repo, actor, input) => ({
        removed: await repo.removeAssignment(
          actor,
          input.classId,
          input.assignmentId,
        ),
      }),
    ),
    listAssignments: bind(
      classroomFeatures.listAssignments,
      (repo, actor, input) => repo.listAssignments(actor, input),
    ),
  });
}
