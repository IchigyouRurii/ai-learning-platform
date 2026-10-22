"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  catalogItem,
  generateLearningPath,
  pathProfileSchema,
} from "@/modules/course-generation";
import {
  getCurrentUser,
  getWorkspace,
  saveLearningPath,
} from "@/modules/platform";
import type {
  ActionResult,
  LearningPathRecord,
  LearningPathStep,
} from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

const generatedPathSchema = z.object({
  title: z.string().trim().min(1).max(160),
  steps: z
    .array(
      z.object({
        courseId: z.string().min(1),
        courseVersion: z.number().int().positive(),
        order: z.number().int().nonnegative(),
        targetMinutes: z.number().int().positive().max(10000),
        reason: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(8),
});

export async function generatePathAction(
  raw: unknown,
): Promise<ActionResult<{ title: string; steps: LearningPathStep[] }>> {
  try {
    const profile = pathProfileSchema.parse(raw);
    const actor = await getCurrentUser();
    if (actor.role !== "student")
      throw new Error("A student account is required.");
    const workspace = await getWorkspace(actor);
    const catalog = workspace.courses
      .filter(
        (course) =>
          course.status === "published" && course.visibility === "cohort",
      )
      .map(catalogItem);
    return { ok: true, data: await generateLearningPath(profile, catalog) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function savePathAction(
  raw: unknown,
): Promise<ActionResult<LearningPathRecord>> {
  try {
    const input = generatedPathSchema.parse(raw);
    const actor = await getCurrentUser();
    if (actor.role !== "student")
      throw new Error("A student account is required.");
    const workspace = await getWorkspace(actor);
    const published = new Map(
      workspace.courses
        .filter(
          (course) =>
            course.status === "published" && course.visibility === "cohort",
        )
        .map((course) => [course.id, course]),
    );
    const steps = input.steps.map((step, index) => {
      const course = published.get(step.courseId);
      if (!course || course.version !== step.courseVersion)
        throw new Error(
          "A course in this plan is no longer available. Generate the plan again.",
        );
      return { ...step, order: index };
    });
    const path = await saveLearningPath(actor, {
      title: input.title,
      steps,
    });
    revalidatePath("/student/path");
    revalidatePath("/student");
    return { ok: true, data: path };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
