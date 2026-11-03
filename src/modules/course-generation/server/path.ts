import "server-only";
import { z } from "zod";
import type { Course, LearningPathStep } from "@/shared/contracts";
import {
  courseLevelSchema,
  lessonsAtLevel,
  COURSE_LEVELS,
} from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import { PATH_SYSTEM_PROMPT, pathUserMessage } from "../prompts/path";

export const pathProfileSchema = z.object({
  background: z.string().trim().min(2).max(2000),
  goals: z.string().trim().min(2).max(2000),
  difficulty: courseLevelSchema.default("beginner"),
  availableMinutesPerWeek: z.number().int().min(15).max(10080),
  courseIds: z.array(z.string().min(1).max(200)).min(1).optional(),
});
export type PathProfile = z.infer<typeof pathProfileSchema>;

export type PathCatalogItem = {
  id: string;
  version: number;
  title: string;
  description: string;
  subject: string;
  audience: string;
  goals: string[];
  lessonCount: number;
  levels?: import("@/shared/contracts").CourseLevel[];
};

export type GeneratedPath = {
  title: string;
  steps: LearningPathStep[];
};

const rawPathSchema = z.object({
  title: z.string().trim().min(1).max(160),
  steps: z
    .array(
      z.object({
        courseId: z.string().min(1),
        difficulty: courseLevelSchema.optional(),
        order: z.number().int().nonnegative(),
        targetMinutes: z.number().int().positive().max(10000),
        reason: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1),
});

export function catalogItem(course: Course): PathCatalogItem {
  return {
    id: course.id,
    version: course.version,
    title: course.title,
    description: course.description,
    subject: course.subject,
    audience: course.audience,
    goals: course.goals,
    lessonCount: course.lessons.length,
    levels: COURSE_LEVELS.filter(
      (level) => lessonsAtLevel(course.lessons, level).length > 0,
    ),
  };
}

export async function generateLearningPath(
  rawProfile: PathProfile,
  catalog: PathCatalogItem[],
): Promise<GeneratedPath> {
  const profile = pathProfileSchema.parse(rawProfile);
  if (catalog.length < 1)
    throw new Error(
      "Select at least one Marketplace course before generating a learning path.",
    );

  if (getAIProvider() === "mock") {
    const steps = catalog.map((course, index) => ({
      courseId: course.id,
      courseVersion: course.version,
      difficulty: course.levels?.includes(profile.difficulty)
        ? profile.difficulty
        : (course.levels?.[0] ?? "beginner"),
      order: index,
      targetMinutes: Math.max(
        30,
        Math.round(profile.availableMinutesPerWeek / 2),
      ),
      reason: `Mock plan: this course builds toward "${profile.goals}". A live model can personalise the order and reasons.`,
    }));
    return { title: `A starter plan for ${profile.goals}`, steps };
  }

  const text = await complete(
    [
      { role: "system", content: PATH_SYSTEM_PROMPT },
      {
        role: "user",
        content: pathUserMessage({
          profile: {
            background: profile.background,
            goals: profile.goals,
            availableMinutesPerWeek: profile.availableMinutesPerWeek,
            courseIds: profile.courseIds,
          },
          catalog,
        }),
      },
    ],
    true,
    { maxTokens: 2500, temperature: 0.3 },
  );
  const parsed = parsePath(text);
  return validateAgainstCatalog(
    parsed,
    catalog,
    profile.difficulty,
    profile.courseIds,
  );
}

function parsePath(raw: string): z.infer<typeof rawPathSchema> {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidates = [fenced?.[1]?.trim() ?? trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first)
    candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      const result = rawPathSchema.safeParse(value);
      if (result.success) return result.data;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    "The learning path is not valid JSON with the expected structure. Please regenerate.",
  );
}

export function validateAgainstCatalog(
  raw: z.infer<typeof rawPathSchema>,
  catalog: PathCatalogItem[],
  preferred: import("@/shared/contracts").CourseLevel = "beginner",
  requiredCourseIds?: string[],
): GeneratedPath {
  const byId = new Map(catalog.map((course) => [course.id, course]));
  const seen = new Set<string>();
  const steps = raw.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step, index) => {
      const course = byId.get(step.courseId);
      if (!course)
        throw new Error(
          "The generated plan references a course that is not in the catalog. Please regenerate.",
        );
      if (seen.has(step.courseId))
        throw new Error(
          "The generated plan repeats a course. Please regenerate.",
        );
      seen.add(step.courseId);
      const difficulty = step.difficulty ?? preferred;
      if (course.levels && !course.levels.includes(difficulty))
        throw new Error(
          "The selected course difficulty is not available. Please regenerate.",
        );
      return {
        courseId: course.id,
        courseVersion: course.version,
        difficulty,
        order: index,
        targetMinutes: step.targetMinutes,
        reason: step.reason,
      };
    });
  if (steps.length < 1)
    throw new Error(
      "A generated learning path must contain at least one course. Please regenerate.",
    );
  if (requiredCourseIds?.length) {
    const wanted = new Set(requiredCourseIds);
    const got = new Set(steps.map((step) => step.courseId));
    if (
      wanted.size !== got.size ||
      [...wanted].some((courseId) => !got.has(courseId))
    )
      throw new Error(
        "The generated plan did not use exactly the selected courses. Please regenerate.",
      );
  }
  return { title: raw.title, steps };
}
