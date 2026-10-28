"use server";

import { revalidatePath } from "next/cache";
import { completeLesson, getCurrentUser } from "@/modules/platform";
import type { ActionResult } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

export async function completeLessonAction(
  courseId: string,
  courseVersion: number,
  lessonId: string,
): Promise<ActionResult<null>> {
  try {
    await completeLesson(
      await getCurrentUser(),
      courseId,
      courseVersion,
      lessonId,
    );
    revalidatePath(`/student/courses/${courseId}`);
    revalidatePath("/student/progress");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
