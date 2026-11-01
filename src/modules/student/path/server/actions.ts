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
  getCourseCatalog,
  recordGeneration,
  saveLearningPath,
  enrollCourse,
  getStudentCourseContext,
} from "@/modules/platform";
import {
  courseLevelSchema,
  type ActionResult,
  type LearningPathRecord,
  type LearningPathStep,
} from "@/shared/contracts";
import { learningPathDraftSchema } from "@/shared/contracts/features/plans";
import { actionError } from "@/shared/contracts/errors";

export async function generatePathAction(
  raw: unknown,
): Promise<ActionResult<{ title: string; steps: LearningPathStep[] }>> {
  try {
    const profile = pathProfileSchema.parse(raw);
    const actor = await getCurrentUser();
    if (actor.role !== "student")
      throw new Error("A student account is required.");
    const [workspace, publicCourses] = await Promise.all([
      getWorkspace(actor),
      getCourseCatalog(actor),
    ]);
    const ids = new Set(publicCourses.map((course) => course.id));
    const catalog = workspace.courses
      .filter((course) => ids.has(course.id))
      .map(catalogItem);
    const generated = await generateLearningPath(profile, catalog);
    await recordGeneration(actor, {
      kind: "path",
      input: profile,
      result: generated,
    });
    return { ok: true, data: generated };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function savePathAction(
  raw: unknown,
): Promise<ActionResult<LearningPathRecord>> {
  try {
    const input = learningPathDraftSchema
      .extend({ id: z.string().min(1).max(200).optional() })
      .parse(raw);
    const path = await saveLearningPath(await getCurrentUser(), input);
    revalidatePath("/student/path");
    revalidatePath("/student/progress");
    return { ok: true, data: path };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

/** Each enrollment is independently authorized; already active levels never switch implicitly. */
export async function enrollPathCoursesAction(raw: unknown): Promise<
  ActionResult<{
    outcomes: {
      courseId: string;
      difficulty: string;
      status: "enrolled" | "existing" | "failed";
      message: string;
    }[];
  }>
> {
  try {
    const input = z
      .array(
        z.object({
          courseId: z.string().min(1).max(200),
          difficulty: courseLevelSchema,
        }),
      )
      .min(1)
      .refine(
        (items) =>
          new Set(items.map((item) => item.courseId)).size === items.length,
        "A course can only appear once.",
      )
      .parse(raw);
    const actor = await getCurrentUser();
    if (actor.role !== "student")
      throw new Error("A student account is required.");
    const catalog = new Set(
      (await getCourseCatalog(actor)).map((course) => course.id),
    );
    const outcomes = [];
    for (const step of input) {
      try {
        if (!catalog.has(step.courseId))
          throw new Error("This course is no longer available in Marketplace.");
        const context = await getStudentCourseContext(actor, step.courseId);
        if (context?.enrolled) {
          const active = context.activeLevel ?? "beginner";
          outcomes.push({
            courseId: step.courseId,
            difficulty: active,
            status: "existing" as const,
            message:
              active === step.difficulty
                ? "Already enrolled"
                : `Already learning ${active}. Open the course to switch difficulty.`,
          });
        } else {
          await enrollCourse(actor, step.courseId, step.difficulty);
          outcomes.push({
            ...step,
            status: "enrolled" as const,
            message: "Enrolled successfully",
          });
        }
      } catch (error) {
        outcomes.push({
          ...step,
          status: "failed" as const,
          message: actionError(error),
        });
      }
    }
    revalidatePath("/student", "layout");
    return { ok: true, data: { outcomes } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
