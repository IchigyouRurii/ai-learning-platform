"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCourse,
  getCourseDocumentForAuthor,
  getCurrentUser,
  getMaterialsForGeneration,
  publishCourse,
  recordGeneration,
  updateCourseDraft,
} from "@/modules/platform";
import type {
  ActionResult,
  CourseDocument,
  CourseDraft,
  GenerationInput,
  Lesson,
} from "@/shared/contracts";
import { courseLevelSchema } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";
import { generateCourse } from "./generate";
import { generateLesson } from "./lesson";
import { rewriteText } from "./rewrite";

export async function generateCourseAction(
  input: GenerationInput,
): Promise<ActionResult<CourseDraft>> {
  try {
    const actor = await getCurrentUser();
    if (actor.role !== "teacher" && actor.role !== "student")
      throw new Error("This account cannot generate courses.");
    const materialIds = input.materialIds ?? [];
    const materials = await getMaterialsForGeneration(actor, materialIds);
    if (materials.length !== new Set(materialIds).size)
      throw new Error(
        "Some attachments are unavailable. Upload them again before generating.",
      );
    const combinedMaterials = [
      input.materials,
      ...materials.map(
        (material) => `### ${material.filename}\n${material.extractedText}`,
      ),
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20000);
    const generated = await generateCourse({
      ...input,
      materials: combinedMaterials,
    });
    const attachments = materials.map((material) => ({
      materialId: material.id,
      filename: material.filename,
      mimeType: material.mimeType,
      sizeBytes: material.sizeBytes,
    }));
    const course = { ...generated, attachments };
    await recordGeneration(actor, {
      kind: "course",
      input: { ...input, materials: combinedMaterials },
      result: course,
    });
    return { ok: true, data: course };
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
    revalidatePath(`/teacher/marketplace/${courseId}`);
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
    revalidatePath(`/teacher/marketplace/${courseId}`);
    revalidatePath(`/student/courses/${courseId}`);
    return { ok: true, data: { version: course.version } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

const addLessonSchema = z.object({
  courseId: z.string().min(1),
  expectedDraftRevision: z.number().int().positive(),
  level: courseLevelSchema,
  instruction: z
    .string()
    .trim()
    .min(3, "Describe what the new lesson should cover.")
    .max(2000),
});

export async function addLessonAction(
  raw: z.infer<typeof addLessonSchema>,
): Promise<ActionResult<{ document: CourseDocument; lesson: Lesson }>> {
  try {
    const input = addLessonSchema.parse(raw);
    const actor = await getCurrentUser();
    const document = await getCourseDocumentForAuthor(
      actor,
      input.courseId,
    );
    const materialIds = (document.content.attachments ?? []).map(
      (attachment) => attachment.materialId,
    );
    const materials = await getMaterialsForGeneration(actor, materialIds);
    const lesson = await generateLesson({
      courseTitle: document.content.title,
      difficulty: input.level,
      existingLessons: document.content.lessons
        .filter((item) => (item.difficulty ?? "beginner") === input.level)
        .map((item) => item.title),
      instruction: input.instruction,
      materials: materials
        .map(
          (material) =>
            `### ${material.filename}\n${material.extractedText}`,
        )
        .join("\n\n")
        .slice(0, 20000),
    });
    const updated = await updateCourseDraft(
      actor,
      input.courseId,
      input.expectedDraftRevision,
      {
        ...document.content,
        lessons: [...document.content.lessons, lesson],
      },
    );
    await recordGeneration(actor, {
      kind: "lesson",
      courseId: input.courseId,
      input,
      result: lesson,
    });
    revalidatePath(`/teacher/courses/${input.courseId}`);
    revalidatePath(`/student/courses/${input.courseId}`);
    return { ok: true, data: { document: updated, lesson } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

const rewriteSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1).max(200),
  blockId: z.string().min(1).max(200),
  kind: z.enum(["text", "activity"]),
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
    const text = await rewriteText(input);
    await recordGeneration(actor, {
      kind: "rewrite",
      courseId: input.courseId,
      input,
      result: { text },
    });
    return { ok: true, data: { text } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
