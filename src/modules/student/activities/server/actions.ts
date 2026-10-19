"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  enrollCourse,
  getCurrentUser,
  getLearningContext,
  recordSubmission,
} from "@/modules/platform";
import type { ActionResult } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";
import { evaluateAnswer } from "./feedback";

const answerSchema = z.object({
  courseId: z.string().min(1),
  activityId: z.string().min(1),
  answer: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters to explain your thoughts.")
    .max(6000),
  background: z.string().min(1).max(200),
  goal: z.string().max(500),
});

export async function submitAnswerAction(
  raw: z.infer<typeof answerSchema>,
): Promise<ActionResult<{ feedback: string }>> {
  try {
    const input = answerSchema.parse(raw);
    const actor = await getCurrentUser();
    const { course, activity } = await getLearningContext(
      actor,
      input.courseId,
      input.activityId,
    );
    const feedback = await evaluateAnswer(
      course,
      activity,
      input.answer,
      input.background,
      input.goal,
    );
    await recordSubmission(actor, {
      courseId: course.id,
      courseVersion: course.version,
      activityId: activity.id,
      answer: input.answer,
      aiFeedback: feedback,
    });
    revalidatePath("/student");
    revalidatePath("/teacher");
    return { ok: true, data: { feedback } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function enrollAction(
  courseId: string,
): Promise<ActionResult<null>> {
  try {
    await enrollCourse(await getCurrentUser(), courseId);
    revalidatePath("/student");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
