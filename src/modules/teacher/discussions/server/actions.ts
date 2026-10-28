"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type {
  ActionResult,
  CourseQuestion,
  QuestionReply,
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
