"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type {
  ActionResult,
  CourseQuestion,
  QuestionReply,
  ReactionKind,
  ReactionSummary,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

function revalidateDiscussion(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher/creations");
}

export async function replyQuestionAction(
  courseId: string,
  questionId: string,
  message: string,
): Promise<ActionResult<QuestionReply>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.discussions.reply(actor, {
      questionId,
      message,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateDiscussion(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function resolveQuestionAction(
  courseId: string,
  questionId: string,
): Promise<ActionResult<CourseQuestion>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.discussions.resolve(actor, {
      questionId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateDiscussion(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function deleteQuestionAction(
  courseId: string,
  questionId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.discussions.deleteQuestion(actor, {
      questionId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateDiscussion(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function deleteReplyAction(
  courseId: string,
  replyId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.discussions.deleteReply(actor, {
      replyId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateDiscussion(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function toggleReactionAction(
  courseId: string,
  target: { questionId?: string; replyId?: string },
  reaction: ReactionKind,
): Promise<ActionResult<{ reactions: ReactionSummary[] }>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.discussions.toggleReaction(actor, {
      ...target,
      reaction,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateDiscussion(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
