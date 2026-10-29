import "server-only";
import type { User } from "@/shared/contracts/platform";
import { annotationFeatures } from "@/shared/contracts/features";
import type { AnnotationRepository } from "@/shared/database/extension-repositories";
import { createAnnotationRepository } from "@/shared/database/annotation-repository";
import { getDatabasePool } from "@/shared/database/pool";
import { FeatureServiceError, featureFailure } from "./errors";
import type { ReservedService } from "./reserved-service";

type AnnotationService = ReservedService<typeof annotationFeatures>;

function requireActor(actor: User | null): User {
  if (!actor) throw new FeatureServiceError("AUTH_REQUIRED", "Please sign in.");
  return actor;
}

function requireRole(actor: User, roles: readonly User["role"][]) {
  if (!roles.includes(actor.role))
    throw new FeatureServiceError(
      "FORBIDDEN",
      "Your role cannot perform this action.",
    );
}

const inaccessible = () =>
  new FeatureServiceError(
    "NOT_FOUND",
    "Annotation or course not found, or you do not have access.",
  );

export function createAnnotationService(
  getRepository: () => AnnotationRepository,
): AnnotationService {
  return {
    async create(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.create.roles);
        const input = annotationFeatures.create.input.parse(raw);
        const annotation = await getRepository().create(actor, input);
        if (!annotation) throw inaccessible();
        return { ok: true, data: annotation };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async listMine(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.listMine.roles);
        const input = annotationFeatures.listMine.input.parse(raw);
        const page = await getRepository().listMine(
          actor,
          { courseId: input.courseId, courseVersion: input.courseVersion },
          { cursor: input.cursor, limit: input.limit },
        );
        if (!page) throw inaccessible();
        return { ok: true, data: page };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async listForTeacher(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.listForTeacher.roles);
        const input = annotationFeatures.listForTeacher.input.parse(raw);
        const page = await getRepository().listForTeacher(actor, input);
        if (!page) throw inaccessible();
        return { ok: true, data: page };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async reply(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.reply.roles);
        const input = annotationFeatures.reply.input.parse(raw);
        const annotation = await getRepository().reply(
          actor,
          input.annotationId,
          input.message,
        );
        if (!annotation) throw inaccessible();
        return { ok: true, data: annotation };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async resolve(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.resolve.roles);
        const input = annotationFeatures.resolve.input.parse(raw);
        const annotation = await getRepository().resolve(
          actor,
          input.annotationId,
        );
        if (!annotation) throw inaccessible();
        return { ok: true, data: annotation };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async markSeen(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, annotationFeatures.markSeen.roles);
        const input = annotationFeatures.markSeen.input.parse(raw);
        const seen = await getRepository().markSeen(actor, input.annotationId);
        if (!seen) throw inaccessible();
        return { ok: true, data: { seen: true } };
      } catch (error) {
        return featureFailure(error);
      }
    },
  };
}

let defaultRepository: AnnotationRepository | undefined;

export const annotations = createAnnotationService(() => {
  defaultRepository ??= createAnnotationRepository(getDatabasePool());
  return defaultRepository;
});
