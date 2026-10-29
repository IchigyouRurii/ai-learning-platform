"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type { ActionResult, ContentAnnotation } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

function revalidateAnnotations(courseId: string) {
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/student/courses/${courseId}`);
}

export async function replyAnnotationAction(
  courseId: string,
  annotationId: string,
  message: string,
): Promise<ActionResult<ContentAnnotation>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.annotations.reply(actor, {
      annotationId,
      message,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateAnnotations(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function resolveAnnotationAction(
  courseId: string,
  annotationId: string,
): Promise<ActionResult<ContentAnnotation>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.annotations.resolve(actor, {
      annotationId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateAnnotations(courseId);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
