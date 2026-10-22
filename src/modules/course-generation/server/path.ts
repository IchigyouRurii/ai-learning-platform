import "server-only";
import { z } from "zod";
import type { Course, LearningPathStep } from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import { PATH_SYSTEM_PROMPT, pathUserMessage } from "../prompts/path";

export const pathProfileSchema = z.object({
  background: z.string().trim().min(2).max(2000),
  goals: z.string().trim().min(2).max(2000),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  availableMinutesPerWeek: z.number().int().min(15).max(10080),
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
        order: z.number().int().nonnegative(),
        targetMinutes: z.number().int().positive().max(10000),
        reason: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(8),
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
  };
}

export async function generateLearningPath(
  rawProfile: PathProfile,
  catalog: PathCatalogItem[],
): Promise<GeneratedPath> {
  const profile = pathProfileSchema.parse(rawProfile);
  if (!catalog.length)
    throw new Error("No published courses are available yet. Ask a teacher to publish a course first.");

  if (getAIProvider() === "mock") {
    const steps = catalog.slice(0, 6).map((course, index) => ({
      courseId: course.id,
      courseVersion: course.version,
      order: index,
      targetMinutes: Math.max(30, Math.round(profile.availableMinutesPerWeek / 2)),
      reason: `Mock plan: this course builds toward "${profile.goals}". A live model can personalise the order and reasons.`,
    }));
    return { title: `A starter plan for ${profile.goals}`, steps };
  }

  const text = await complete(
    [
      { role: "system", content: PATH_SYSTEM_PROMPT },
      { role: "user", content: pathUserMessage({ profile, catalog }) },
    ],
    true,
    { maxTokens: 2500, temperature: 0.3 },
  );
  const parsed = parsePath(text);
  return validateAgainstCatalog(parsed, catalog);
}

function parsePath(raw: string): z.infer<typeof rawPathSchema> {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidates = [fenced?.[1]?.trim() ?? trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
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
        throw new Error("The generated plan repeats a course. Please regenerate.");
      seen.add(step.courseId);
      return {
        courseId: course.id,
        courseVersion: course.version,
        order: index,
        targetMinutes: step.targetMinutes,
        reason: step.reason,
      };
    });
  return { title: raw.title, steps };
}
