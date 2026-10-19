import { z } from "zod";

export const activitySchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "reflection",
    "quiz",
    "roleplay",
    "coding",
    "simulation",
    "game",
  ]),
  title: z.string().min(1).max(160),
  prompt: z.string().min(1).max(6000),
  rubric: z.string().min(1).max(3000),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    id: z.string(),
    body: z.string().min(1).max(16000),
  }),
  z.object({
    type: z.literal("image"),
    id: z.string(),
    url: z.url(),
    alt: z.string(),
  }),
  z.object({
    type: z.literal("video"),
    id: z.string(),
    url: z.url(),
    caption: z.string(),
  }),
  z.object({
    type: z.literal("slides"),
    id: z.string(),
    url: z.url(),
    caption: z.string(),
  }),
  z.object({
    type: z.literal("activity"),
    id: z.string(),
    activity: activitySchema,
  }),
]);

export const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  blocks: z.array(contentBlockSchema).min(1).max(30),
});

export const courseDraftSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().min(1).max(2000),
    subject: z.string().min(1).max(100),
    audience: z.string().min(1).max(500),
    goals: z.array(z.string().min(1).max(500)).min(1).max(8),
    lessons: z.array(lessonSchema).min(1).max(12),
  })
  .superRefine((course, context) => {
    const lessonIds = new Set<string>();
    const activityIds = new Set<string>();
    for (const lesson of course.lessons) {
      if (lessonIds.has(lesson.id))
        context.addIssue({
          code: "custom",
          message: "Lesson IDs must be unique",
        });
      lessonIds.add(lesson.id);
      for (const block of lesson.blocks) {
        if (block.type === "activity") {
          if (activityIds.has(block.activity.id))
            context.addIssue({
              code: "custom",
              message: "Activity IDs must be unique",
            });
          activityIds.add(block.activity.id);
        }
      }
    }
  });

export const generationInputSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(2, "Enter a topic with at least two characters")
    .max(200),
  audience: z.string().trim().min(2).max(500),
  goals: z.string().trim().min(2).max(2000),
  materials: z.string().trim().max(20000).default(""),
});

export type Activity = z.infer<typeof activitySchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type CourseDraft = z.infer<typeof courseDraftSchema>;
export type GenerationInput = z.infer<typeof generationInputSchema>;

export type Course = CourseDraft & {
  id: string;
  ownerId: string;
  status: "draft" | "published";
  visibility: "cohort" | "personal";
  version: number;
  createdAt: string;
  updatedAt: string;
};

export function getActivities(course: CourseDraft): Activity[] {
  return course.lessons.flatMap((lesson) =>
    lesson.blocks.flatMap((block) =>
      block.type === "activity" ? [block.activity] : [],
    ),
  );
}
