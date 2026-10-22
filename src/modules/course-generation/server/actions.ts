"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCourse,
  getCurrentUser,
  publishCourse,
  updateCourseDraft,
} from "@/modules/platform";
import type {
  ActionResult,
  CourseDocument,
  CourseDraft,
  GenerationInput,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";
import { generateCourse } from "./generate";
import { rewriteText } from "./rewrite";

export async function generateCourseAction(
  input: GenerationInput,
): Promise<ActionResult<CourseDraft>> {
  try {
    const actor = await getCurrentUser();
    if (actor.role !== "teacher" && actor.role !== "student")
      throw new Error("This account cannot generate courses.");
    return { ok: true, data: await generateCourse(input) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function saveCourseAction(
  input: CourseDraft,
): Promise<ActionResult<{ id: string; published: boolean }>> {
  try {
    const actor = await getCurrentUser();
    const course = await createCourse(actor, input);
    revalidatePath("/teacher");
    revalidatePath("/teacher/creations");
    revalidatePath("/student");
    return {
      ok: true,
      data: { id: course.id, published: course.status === "published" },
    };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function updateCourseAction(
  courseId: string,
  expectedDraftRevision: number,
  content: CourseDraft,
): Promise<ActionResult<CourseDocument>> {
  try {
    const actor = await getCurrentUser();
    const document = await updateCourseDraft(
      actor,
      courseId,
      expectedDraftRevision,
      content,
    );
    revalidatePath(`/teacher/courses/${courseId}`);
    revalidatePath(`/student/courses/${courseId}`);
    return { ok: true, data: document };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function publishCourseRevisionAction(
  courseId: string,
): Promise<ActionResult<{ version: number }>> {
  try {
    const actor = await getCurrentUser();
    const course = await publishCourse(actor, courseId);
    revalidatePath("/teacher");
    revalidatePath("/teacher/creations");
    revalidatePath("/student");
    revalidatePath(`/teacher/courses/${courseId}`);
    revalidatePath(`/student/courses/${courseId}`);
    return { ok: true, data: { version: course.version } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

const rewriteSchema = z.object({
  courseTitle: z.string().trim().min(1).max(160),
  lessonTitle: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(16000),
  instruction: z
    .string()
    .trim()
    .min(3, "Describe how the AI should change this section.")
    .max(2000),
});

export async function rewriteTextAction(
  raw: z.infer<typeof rewriteSchema>,
): Promise<ActionResult<{ text: string }>> {
  try {
    const input = rewriteSchema.parse(raw);
    const actor = await getCurrentUser();
    if (actor.role !== "teacher" && actor.role !== "student")
      throw new Error("This account cannot edit courses.");
    return { ok: true, data: { text: await rewriteText(input) } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
