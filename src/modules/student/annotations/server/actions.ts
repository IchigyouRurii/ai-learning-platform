"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type {
  ActionResult,
  AnnotationCategory,
  ContentAnnotation,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

export async function createAnnotationAction(input: {
  courseId: string;
  courseVersion: number;
  lessonId: string;
  blockId: string;
  quote?: string;
  category: AnnotationCategory;
  message: string;
}): Promise<ActionResult<ContentAnnotation>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.annotations.create(actor, input);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/student/courses/${input.courseId}`);
    revalidatePath("/teacher/students");
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function markAnnotationSeenAction(
  courseId: string,
  annotationId: string,
): Promise<ActionResult<{ seen: boolean }>> {
  try {
    const actor = await getCurrentUser();
    const result = await platformExtensions.annotations.markSeen(actor, {
      annotationId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/student/courses/${courseId}`);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
