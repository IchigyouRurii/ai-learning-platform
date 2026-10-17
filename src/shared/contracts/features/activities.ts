import { z } from "zod";
import { contentBlockSchema, courseDraftSchema } from "../course";
import {
  feature,
  idSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
  versionSchema,
} from "./common";

const option = z.object({ id: idSchema, text: z.string().min(1).max(2000) });
const quizQuestion = z.object({
  id: idSchema,
  prompt: z.string().min(1).max(6000),
  multiple: z.boolean(),
  options: z.array(option).min(2).max(10),
});
const quizQuestions = z
  .array(quizQuestion)
  .min(1)
  .max(30)
  .superRefine((questions, ctx) => {
    if (new Set(questions.map((q) => q.id)).size !== questions.length)
      ctx.addIssue({ code: "custom", message: "题目 ID 不能重复。" });
    for (const question of questions)
      if (
        new Set(question.options.map((o) => o.id)).size !==
        question.options.length
      )
        ctx.addIssue({ code: "custom", message: "选项 ID 不能重复。" });
  });
// Safe for a learner. Answer keys and evaluation instructions are separate.
export const learnerActivitySchema = z.discriminatedUnion("type", [
  z.object({
    id: idSchema,
    type: z.literal("reflection"),
    title: z.string(),
    prompt: z.string(),
  }),
  z.object({
    id: idSchema,
    type: z.literal("quiz"),
    title: z.string(),
    prompt: z.string(),
    questions: quizQuestions,
  }),
  z.object({
    id: idSchema,
    type: z.literal("roleplay"),
    title: z.string(),
    prompt: z.string(),
    persona: z.string(),
    maxTurns: z.number().int().min(1).max(50),
  }),
  z.object({
    id: idSchema,
    type: z.literal("coding"),
    title: z.string(),
    prompt: z.string(),
    language: z.string(),
    starterCode: z.string(),
  }),
  z.object({
    id: idSchema,
    type: z.literal("simulation"),
    title: z.string(),
    prompt: z.string(),
    scenario: z.string(),
    choices: z.array(option).min(1),
  }),
  z.object({
    id: idSchema,
    type: z.literal("game"),
    title: z.string(),
    prompt: z.string(),
    rules: z.string(),
    choices: z.array(option).min(1),
  }),
]);
const [textBlock, imageBlock, videoBlock, slidesBlock] =
  contentBlockSchema.options;
const { title, description, subject, audience, goals } =
  courseDraftSchema.shape;
export const learnerCourseSchema = z.object({
  id: idSchema,
  version: versionSchema,
  title,
  description,
  subject,
  audience,
  goals,
  lessons: z
    .array(
      z.object({
        id: idSchema,
        title: z.string(),
        blocks: z.array(
          z.discriminatedUnion("type", [
            textBlock,
            imageBlock,
            videoBlock,
            slidesBlock,
            z.object({
              id: idSchema,
              type: z.literal("activity"),
              activity: learnerActivitySchema,
            }),
          ]),
        ),
      }),
    )
    .min(1)
    .max(12),
});
export const authoringActivitySchema = z
  .object({
    learner: learnerActivitySchema,
    evaluation: z.object({
      rubric: z.string().min(1).max(6000),
      answerKey: z
        .array(
          z.object({
            questionId: idSchema,
            correctOptionIds: z.array(idSchema).min(1),
            explanation: z.string().min(1),
            points: z.number().positive().max(100),
          }),
        )
        .optional(),
      privateInstructions: z.string().max(6000).optional(),
    }),
  })
  .superRefine((value, ctx) => {
    const { learner, evaluation } = value;
    if (learner.type !== "quiz") {
      if (evaluation.answerKey)
        ctx.addIssue({
          code: "custom",
          message: "非测验活动不能设置测验答案。",
        });
      return;
    }
    const keys = evaluation.answerKey ?? [];
    if (
      keys.length !== learner.questions.length ||
      new Set(keys.map((k) => k.questionId)).size !== keys.length
    )
      ctx.addIssue({ code: "custom", message: "每道题必须有且只有一份答案。" });
    for (const key of keys) {
      const question = learner.questions.find((q) => q.id === key.questionId);
      if (
        !question ||
        (!question.multiple && key.correctOptionIds.length !== 1) ||
        new Set(key.correctOptionIds).size !== key.correctOptionIds.length ||
        key.correctOptionIds.some(
          (id) => !question.options.some((o) => o.id === id),
        )
      )
        ctx.addIssue({ code: "custom", message: "测验答案与题目选项不匹配。" });
    }
  });

// Complete activity definitions accompany the existing course JSON. Legacy
// reflection activities can omit a definition and keep their existing rubric.
export const authoringDraftSchema = z
  .object({
    course: courseDraftSchema,
    activities: z.array(authoringActivitySchema).max(100).default([]),
  })
  .superRefine(({ course, activities }, ctx) => {
    const embedded = course.lessons.flatMap((l) =>
      l.blocks.flatMap((b) => (b.type === "activity" ? [b.activity] : [])),
    );
    if (new Set(activities.map((a) => a.learner.id)).size !== activities.length)
      ctx.addIssue({ code: "custom", message: "活动配置 ID 不能重复。" });
    for (const definition of activities)
      if (
        !embedded.some(
          (a) =>
            a.id === definition.learner.id &&
            a.type === definition.learner.type,
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "活动配置必须对应课程中的同类型活动。",
        });
    for (const activity of embedded)
      if (
        activity.type !== "reflection" &&
        !activities.some((a) => a.learner.id === activity.id)
      )
        ctx.addIssue({
          code: "custom",
          message: "非开放回答活动必须提供完整配置。",
        });
  });

export const activityResponseSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("reflection"),
      text: z.string().trim().min(1).max(6000),
    }),
    z.strictObject({
      type: z.literal("quiz"),
      answers: z
        .array(
          z.strictObject({
            questionId: idSchema,
            selectedOptionIds: z.array(idSchema).min(1).max(10),
          }),
        )
        .min(1)
        .max(30),
    }),
    z.strictObject({
      type: z.literal("coding"),
      code: z.string().min(1).max(30000),
    }),
    z.strictObject({
      type: z.literal("simulation"),
      choiceIds: z.array(idSchema).min(1).max(100),
    }),
    z.strictObject({
      type: z.literal("game"),
      choiceIds: z.array(idSchema).min(1).max(100),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.type !== "quiz") return;
    if (
      new Set(value.answers.map((a) => a.questionId)).size !==
        value.answers.length ||
      value.answers.some(
        (a) => new Set(a.selectedOptionIds).size !== a.selectedOptionIds.length,
      )
    )
      ctx.addIssue({ code: "custom", message: "提交的题目或选项不能重复。" });
  });
const learningContext = {
  courseId: idSchema,
  courseVersion: versionSchema,
  activityId: idSchema,
};
function refineScore(
  value: { score: number | null; maxScore: number | null },
  ctx: z.RefinementCtx,
) {
  if (
    (value.score === null) !== (value.maxScore === null) ||
    (value.score !== null &&
      value.maxScore !== null &&
      value.score > value.maxScore)
  )
    ctx.addIssue({
      code: "custom",
      message: "分数必须与满分同时存在，且不能超过满分。",
    });
}
export const attemptSchema = z
  .object({
    id: idSchema,
    ...learningContext,
    studentId: idSchema,
    response: activityResponseSchema,
    feedback: z.string(),
    score: z.number().nonnegative().nullable(),
    maxScore: z.number().positive().nullable(),
    createdAt: timestampSchema,
  })
  .superRefine(refineScore);
export const lessonCompletionSchema = z.object({
  courseId: idSchema,
  courseVersion: versionSchema,
  lessonId: idSchema,
  studentId: idSchema,
  completedAt: timestampSchema,
});
export const progressViewSchema = z
  .object({
    courseId: idSchema,
    courseVersion: versionSchema,
    studentId: idSchema,
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    submittedActivities: z.number().int().nonnegative(),
    totalActivities: z.number().int().nonnegative(),
    score: z.number().nonnegative().nullable(),
    maxScore: z.number().positive().nullable(),
  })
  .superRefine(refineScore);
export const roleplaySessionSchema = z.object({
  id: idSchema,
  ...learningContext,
  studentId: idSchema,
  status: z.enum(["active", "completed"]),
  messages: z.array(
    z.object({
      id: idSchema,
      role: z.enum(["student", "assistant"]),
      content: z.string(),
      createdAt: timestampSchema,
    }),
  ),
  feedback: z.string().nullable(),
});
const learnerPolicy =
  "仅当前学生；验证课程版本、活动归属和课程加入/班级分配/个人所有权，拒绝下架课程。";
export const learningFeatures = {
  getCourse: feature(
    z.strictObject({ courseId: idSchema, courseVersion: versionSchema }),
    learnerCourseSchema,
    ["student"],
    learnerPolicy + "读取指定发布版本的安全正文，不能调用作者快照接口代替。",
  ),
  getActivity: feature(
    z.strictObject(learningContext),
    learnerActivitySchema,
    ["student"],
    learnerPolicy + "不返回答案、私有提示词或作者配置。",
  ),
  completeLesson: feature(
    z.strictObject({
      courseId: idSchema,
      courseVersion: versionSchema,
      lessonId: idSchema,
    }),
    lessonCompletionSchema,
    ["student"],
    learnerPolicy + "章节必须属于指定版本；幂等写入。",
  ),
  submitAttempt: feature(
    z.strictObject({
      ...learningContext,
      idempotencyKey: z.uuid(),
      response: activityResponseSchema,
    }),
    attemptSchema,
    ["student"],
    learnerPolicy +
      "由服务端判分；客户端不能提交分数、反馈或学生身份；重复 key 不重复计分。",
  ),
  listAttempts: feature(
    z.strictObject({
      courseId: idSchema,
      courseVersion: versionSchema,
      activityId: idSchema.optional(),
      ...pageInputSchema.shape,
    }),
    pageSchema(attemptSchema),
    ["student"],
    learnerPolicy,
  ),
  listStudentAttempts: feature(
    z.strictObject({
      classId: idSchema,
      studentId: idSchema,
      courseId: idSchema,
      courseVersion: versionSchema,
      activityId: idSchema.optional(),
      ...pageInputSchema.shape,
    }),
    pageSchema(attemptSchema),
    ["teacher"],
    "拥有班级，学生为成员，课程已分配到该班级；仅返回该学生对应版本的尝试。",
  ),
  getMyProgress: feature(
    z.strictObject({ courseId: idSchema, courseVersion: versionSchema }),
    progressViewSchema,
    ["student"],
    learnerPolicy,
  ),
  getStudentProgress: feature(
    z.strictObject({
      classId: idSchema,
      studentId: idSchema,
      courseId: idSchema,
      courseVersion: versionSchema,
    }),
    progressViewSchema,
    ["teacher"],
    "拥有班级，学生是成员，课程已分配到该班级；拒绝访问其他班级学生。",
  ),
  getClassProgress: feature(
    z.strictObject({
      classId: idSchema,
      assignmentId: idSchema,
      ...pageInputSchema.shape,
    }),
    pageSchema(progressViewSchema),
    ["teacher"],
    "拥有班级，分配记录属于该班级。",
  ),
  startRoleplay: feature(
    z.strictObject(learningContext),
    roleplaySessionSchema,
    ["student"],
    learnerPolicy + "活动必须是 roleplay。",
  ),
  sendRoleplayMessage: feature(
    z.strictObject({
      sessionId: idSchema,
      message: z.string().trim().min(1).max(6000),
      idempotencyKey: z.uuid(),
    }),
    roleplaySessionSchema,
    ["student"],
    "会话属于当前学生、未结束且未超轮次；历史与 AI 消息从服务器取得。",
  ),
  finishRoleplay: feature(
    z.strictObject({ sessionId: idSchema }),
    roleplaySessionSchema,
    ["student"],
    "会话属于当前学生；结束与反馈生成幂等。",
  ),
};
export type AuthoringDraft = z.infer<typeof authoringDraftSchema>;
export type AuthoringActivity = z.infer<typeof authoringActivitySchema>;
export type LearnerActivity = z.infer<typeof learnerActivitySchema>;
export type LearnerCourse = z.infer<typeof learnerCourseSchema>;
export type ActivityAttempt = z.infer<typeof attemptSchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type LessonCompletion = z.infer<typeof lessonCompletionSchema>;
export type LearningProgress = z.infer<typeof progressViewSchema>;
export type RoleplaySession = z.infer<typeof roleplaySessionSchema>;

export function toLearnerActivity(
  definition: AuthoringActivity,
): LearnerActivity {
  return learnerActivitySchema.parse(definition.learner);
}
