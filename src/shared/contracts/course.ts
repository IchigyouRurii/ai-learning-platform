import { z } from "zod";

export const quizOptionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(2000),
  multiple: z.boolean().default(false),
  options: z.array(quizOptionSchema).min(2).max(8),
  // Authoring-only data. Never send this field to learner pages.
  correctOptionIds: z.array(z.string().min(1)).min(1).max(8),
  explanation: z.string().min(1).max(2000),
});

export const activitySchema = z
  .object({
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
    questions: z.array(quizQuestionSchema).min(1).max(30).optional(),
  })
  .superRefine((activity, context) => {
    if (activity.type !== "quiz") {
      if (activity.questions)
        context.addIssue({
          code: "custom",
          message: "Only quiz activities may contain questions",
        });
      return;
    }
    if (!activity.questions?.length) {
      context.addIssue({
        code: "custom",
        message: "Quiz activities require at least one question",
      });
      return;
    }
    const questionIds = new Set<string>();
    for (const question of activity.questions) {
      if (questionIds.has(question.id))
        context.addIssue({
          code: "custom",
          message: "Question IDs must be unique within an activity",
        });
      questionIds.add(question.id);
      const optionIds = new Set(question.options.map((option) => option.id));
      if (optionIds.size !== question.options.length)
        context.addIssue({
          code: "custom",
          message: "Option IDs must be unique within a question",
        });
      if (
        new Set(question.correctOptionIds).size !==
        question.correctOptionIds.length
      )
        context.addIssue({
          code: "custom",
          message: "Correct option IDs must be unique",
        });
      if (question.correctOptionIds.some((id) => !optionIds.has(id)))
        context.addIssue({
          code: "custom",
          message: "Correct option IDs must reference the question options",
        });
      if (!question.multiple && question.correctOptionIds.length !== 1)
        context.addIssue({
          code: "custom",
          message: "Single-choice questions require exactly one answer",
        });
    }
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

export const COURSE_INTRODUCTION_MAX_LENGTH = 80;
export const courseIntroductionSchema = z
  .string()
  .trim()
  .min(1)
  .max(
    COURSE_INTRODUCTION_MAX_LENGTH,
    `Keep the course introduction within ${COURSE_INTRODUCTION_MAX_LENGTH} characters.`,
  );
/** Existing long descriptions remain readable and can be kept unchanged. */
export function validateCourseIntroduction(
  value: string,
  previous?: string,
): string {
  return previous !== undefined && value === previous
    ? value
    : courseIntroductionSchema.parse(value);
}

export const COURSE_LEVELS = ["beginner", "advanced", "expert"] as const;
export const courseLevelSchema = z.enum(COURSE_LEVELS);
export type CourseLevel = z.infer<typeof courseLevelSchema>;
export const COURSE_SUBJECTS = [
  "Computer Science",
  "Mathematics",
  "English",
  "Literature",
  "Business",
  "Science",
  "Other",
] as const;
export const courseSubjectSchema = z.enum(COURSE_SUBJECTS);
export function courseLevel(value: unknown): CourseLevel {
  const parsed = courseLevelSchema.safeParse(value);
  return parsed.success ? parsed.data : "beginner";
}

export const lessonSchema = z.object({
  // Missing on historical revisions: those lessons belong to Beginner.
  difficulty: courseLevelSchema.optional(),
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
    lessons: z.array(lessonSchema).min(1).max(36),
  })
  .superRefine((course, context) => {
    for (const level of COURSE_LEVELS) {
      if (
        course.lessons.filter(
          (lesson) => courseLevel(lesson.difficulty) === level,
        ).length > 12
      )
        context.addIssue({
          code: "custom",
          message: "Each difficulty supports at most 12 lessons",
        });
    }
    const lessonIds = new Set<string>();
    const activityIds = new Set<string>();
    const questionIds = new Set<string>();
    for (const lesson of course.lessons) {
      if (lessonIds.has(lesson.id))
        context.addIssue({
          code: "custom",
          message: "Lesson IDs must be unique",
        });
      lessonIds.add(lesson.id);
      for (const block of lesson.blocks) {
        if (block.type !== "activity") continue;
        if (activityIds.has(block.activity.id))
          context.addIssue({
            code: "custom",
            message: "Activity IDs must be unique",
          });
        activityIds.add(block.activity.id);
        for (const question of block.activity.questions ?? []) {
          if (questionIds.has(question.id))
            context.addIssue({
              code: "custom",
              message: "Question IDs must be unique",
            });
          questionIds.add(question.id);
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
  subject: courseSubjectSchema.default("Computer Science"),
  description: z
    .string()
    .trim()
    .max(COURSE_INTRODUCTION_MAX_LENGTH)
    .default(""),
  audience: z
    .string()
    .trim()
    .min(2)
    .max(500)
    .default("Learners at the requested difficulty"),
  goals: z.string().trim().min(2).max(2000),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .default("beginner"),
  materials: z.string().trim().max(20000).default(""),
});

export type QuizOption = z.infer<typeof quizOptionSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
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
  moderationStatus?: "active" | "withdrawn";
  withdrawalReason?: string;
  /** Local demo only: draft revision counter used for optimistic locking. */
  draftRevision?: number;
  /** Local demo only: immutable published snapshot while the draft changes. */
  publishedContent?: CourseDraft;
};

// Learner-facing copies never contain answer keys or private explanations.
export type LearnerQuizQuestion = Omit<
  QuizQuestion,
  "correctOptionIds" | "explanation"
>;
export type SafeActivity = Omit<Activity, "questions"> & {
  questions?: LearnerQuizQuestion[];
};
export type LearnerContentBlock =
  | Extract<ContentBlock, { type: "text" | "image" | "video" | "slides" }>
  | { type: "activity"; id: string; activity: SafeActivity };
export type LearnerLesson = {
  difficulty?: CourseLevel;
  id: string;
  title: string;
  blocks: LearnerContentBlock[];
};
export type SafeCourse = Omit<CourseDraft, "lessons"> & {
  lessons: LearnerLesson[];
};
export type QuizAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};
export type QuizQuestionResult = {
  questionId: string;
  correct: boolean;
  correctOptionIds: string[];
  correctAnswerText: string;
  explanation: string;
};
export type QuizResult = {
  score: number;
  maxScore: number;
  feedback: string;
  results: QuizQuestionResult[];
};

export function toSafeActivity(activity: Activity): SafeActivity {
  const { questions, ...rest } = activity;
  if (!questions) return rest;
  return {
    ...rest,
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      multiple: question.multiple,
      options: question.options,
    })),
  };
}

export function toSafeCourse(course: CourseDraft): SafeCourse {
  return {
    ...course,
    lessons: course.lessons.map((lesson) => ({
      ...lesson,
      blocks: lesson.blocks.map((block): LearnerContentBlock =>
        block.type === "activity"
          ? {
              id: block.id,
              type: "activity",
              activity: toSafeActivity(block.activity),
            }
          : block,
      ),
    })),
  };
}

export function getActivities(course: CourseDraft): Activity[] {
  return course.lessons.flatMap((lesson) =>
    lesson.blocks.flatMap((block) =>
      block.type === "activity" ? [block.activity] : [],
    ),
  );
}
