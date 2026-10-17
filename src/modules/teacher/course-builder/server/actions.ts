"use server";

import { revalidatePath } from "next/cache";
import {
  createCourse,
  getCurrentUser,
  publishCourse,
} from "@/modules/platform";
import {
  courseDraftSchema,
  type ActionResult,
  type CourseDraft,
  type GenerationInput,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";
import { generateCourse } from "@/modules/course-generation";

export async function generateDraftAction(
  input: GenerationInput,
): Promise<ActionResult<CourseDraft>> {
  try {
    const actor = await getCurrentUser();
    if (actor.role !== "teacher") throw new Error("需要教师身份。");
    return { ok: true, data: await generateCourse(input) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function saveDraftAction(
  input: CourseDraft,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await getCurrentUser();
    const course = await createCourse(actor, courseDraftSchema.parse(input));
    revalidatePath("/teacher");
    return { ok: true, data: { id: course.id } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function publishCourseAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await publishCourse(await getCurrentUser(), id);
    revalidatePath("/teacher");
    revalidatePath("/student");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
