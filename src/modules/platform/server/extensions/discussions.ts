import "server-only";
import type { User } from "@/shared/contracts/platform";
import { discussionFeatures } from "@/shared/contracts/features";
import type { DiscussionRepository } from "@/shared/database/extension-repositories";
import { createDiscussionRepository } from "@/shared/database/discussion-repository";
import { getDatabasePool } from "@/shared/database/pool";
import { FeatureServiceError, featureFailure } from "./errors";
import type { ReservedService } from "./reserved-service";

type DiscussionService = ReservedService<typeof discussionFeatures>;

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
    "Question or course not found, or you do not have access.",
  );

export function createDiscussionService(
  getRepository: () => DiscussionRepository,
): DiscussionService {
  return {
    async ask(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, discussionFeatures.ask.roles);
        const input = discussionFeatures.ask.input.parse(raw);
        const question = await getRepository().insertQuestion(actor, input);
        if (!question)
          throw new FeatureServiceError(
            "NOT_FOUND",
            "Course not found, not published, or you are not enrolled.",
          );
        return { ok: true, data: question };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async listThreads(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, discussionFeatures.listThreads.roles);
        const input = discussionFeatures.listThreads.input.parse(raw);
        const page = await getRepository().listThreads(
          actor,
          input.courseId,
          { cursor: input.cursor, limit: input.limit },
          input.studentId,
        );
        if (!page) throw inaccessible();
        return { ok: true, data: page };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async getThread(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, discussionFeatures.getThread.roles);
        const input = discussionFeatures.getThread.input.parse(raw);
        const thread = await getRepository().getThread(actor, input.questionId);
        if (!thread) throw inaccessible();
        return { ok: true, data: thread };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async reply(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, discussionFeatures.reply.roles);
        const input = discussionFeatures.reply.input.parse(raw);
        const reply = await getRepository().insertReply(
          actor,
          input.questionId,
          input.message,
        );
        if (!reply) throw inaccessible();
        return { ok: true, data: reply };
      } catch (error) {
        return featureFailure(error);
      }
    },

    async resolve(actorInput, raw) {
      try {
        const actor = requireActor(actorInput);
        requireRole(actor, discussionFeatures.resolve.roles);
        const input = discussionFeatures.resolve.input.parse(raw);
        const question = await getRepository().resolve(actor, input.questionId);
        if (!question) throw inaccessible();
        return { ok: true, data: question };
      } catch (error) {
        return featureFailure(error);
      }
    },
  };
}

let defaultRepository: DiscussionRepository | undefined;

export const discussions = createDiscussionService(() => {
  defaultRepository ??= createDiscussionRepository(getDatabasePool());
  return defaultRepository;
});
