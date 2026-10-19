"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addTeacherFeedback, getCurrentUser } from "@/modules/platform";
import type { ActionResult } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

export async function sendFeedbackAction(
  courseId: string,
  studentId: string,
  message: string,
): Promise<ActionResult<null>> {
  try {
    const text = z
      .string()
      .trim()
      .min(2, "Please enter your feedback.")
      .max(2000)
      .parse(message);
    await addTeacherFeedback(await getCurrentUser(), courseId, studentId, text);
    revalidatePath("/teacher/students");
    revalidatePath("/student/progress");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
