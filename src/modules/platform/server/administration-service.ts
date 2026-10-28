import "server-only";
import type { z } from "zod";
import {
  administrationFeatures,
  type FeatureResult,
  type User,
} from "@/shared/contracts";
import type { AdministrationRepository } from "@/shared/database/extension-repositories";
import { AdministrationError } from "@/shared/database/administration-repository";
import { featureFailure } from "./extensions/errors";

export function createAdministrationService(
  getRepository: () => AdministrationRepository,
) {
  function bind<I extends z.ZodType, O extends z.ZodType>(
    definition: { input: I; output: O },
    operation: (
      repo: AdministrationRepository,
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
      if (actor.role !== "admin")
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Administrator access is required.",
        };
      try {
        const parsed = definition.input.parse(input);
        const result = await operation(getRepository(), actor, parsed);
        return { ok: true, data: definition.output.parse(result) };
      } catch (error) {
        if (error instanceof AdministrationError)
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
              "Administrator database setup is incomplete. Ask the project owner to apply the latest database migrations.",
          };
        return featureFailure(error);
      }
    };
  }
  return Object.freeze({
    getOverview: bind(administrationFeatures.getOverview, (repo, actor) =>
      repo.getOverview(actor),
    ),
    listUsers: bind(administrationFeatures.listUsers, (repo, actor, input) =>
      repo.listUsers(actor, input),
    ),
    changeRole: bind(administrationFeatures.changeRole, (repo, actor, input) =>
      repo.changeRoleAndRevokeSessions(
        actor,
        input.userId,
        input.expectedRole,
        input.role,
      ),
    ),
    listCourses: bind(
      administrationFeatures.listCourses,
      (repo, actor, input) => repo.listCourses(actor, input),
    ),
    withdrawCourse: bind(
      administrationFeatures.withdrawCourse,
      (repo, actor, input) =>
        repo.withdrawCourseAndAudit(actor, input.courseId, input.reason),
    ),
  });
}
