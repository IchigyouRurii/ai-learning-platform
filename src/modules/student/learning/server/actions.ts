"use server";

import { revalidatePath } from "next/cache";
import { completeLesson, getCurrentUser } from "@/modules/platform";
import {
  courseLevelSchema,
  type CourseLevel,
  type ActionResult,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

export async function completeLessonAction(
  courseId: string,
  courseVersion: number,
  lessonId: string,
  completed = true,
  difficulty: CourseLevel = "beginner",
): Promise<ActionResult<null>> {
  try {
    await completeLesson(
      await getCurrentUser(),
      courseId,
      courseVersion,
      lessonId,
      completed,
      courseLevelSchema.parse(difficulty),
    );
    revalidatePath(`/student/courses/${courseId}`);
    revalidatePath("/student/progress");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
