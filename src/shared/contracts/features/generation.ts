import { z } from "zod";
import { feature, idSchema, timestampSchema, versionSchema } from "./common";
import { authoringDraftSchema, authoringActivitySchema } from "./activities";

export const generationRequestSchema = z.strictObject({
  topic: z.string().trim().min(2).max(200),
  audience: z.string().trim().min(2).max(500),
  goals: z.string().trim().min(2).max(2000),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .default("beginner"),
  materials: z.string().trim().max(20000).default(""),
  materialIds: z.array(idSchema).max(20).default([]),
});
export const generationJobSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  kind: z.literal("course"),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  createdAt: timestampSchema,
  result: authoringDraftSchema.nullable(),
  error: z.string().nullable(),
});
export const rewriteTargetSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("lesson"), lessonId: idSchema }),
  z.strictObject({
    type: z.literal("text"),
    lessonId: idSchema,
    blockId: idSchema,
  }),
  z.strictObject({ type: z.literal("activity"), activityId: idSchema }),
]);
export const rewriteSuggestionSchema = z
  .object({
    courseId: idSchema,
    baseDraftRevision: versionSchema,
    target: rewriteTargetSchema,
    replacement: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("lesson"),
        lesson: authoringDraftSchema.shape.course.shape.lessons.element,
        activities: z.array(authoringActivitySchema),
      }),
      z.object({ type: z.literal("text"), body: z.string().min(1).max(16000) }),
      z.object({
        type: z.literal("activity"),
        activity: authoringActivitySchema,
      }),
    ]),
  })
  .superRefine((value, ctx) => {
    if (value.target.type !== value.replacement.type)
      ctx.addIssue({ code: "custom", message: "改写结果必须匹配目标类型。" });
    if (
      value.target.type === "lesson" &&
      value.replacement.type === "lesson" &&
      value.target.lessonId !== value.replacement.lesson.id
    )
      ctx.addIssue({
        code: "custom",
        message: "改写章节必须保留目标章节 ID。",
      });
    if (
      value.target.type === "activity" &&
      value.replacement.type === "activity" &&
      value.target.activityId !== value.replacement.activity.learner.id
    )
      ctx.addIssue({
        code: "custom",
        message: "改写活动必须保留目标活动 ID。",
      });
  });
const ownerPolicy =
  "材料及编辑课程属于当前用户；教师处理教学课程，学生仅处理个人课程。";
export const generationFeatures = {
  generateDraft: feature(
    generationRequestSchema,
    authoringDraftSchema,
    ["teacher", "student"],
    ownerPolicy + "输出只作草稿，不自动保存、发布或授权。",
  ),
  rewritePart: feature(
    z.strictObject({
      courseId: idSchema,
      expectedDraftRevision: versionSchema,
      target: rewriteTargetSchema,
      instruction: z.string().trim().min(1).max(2000),
    }),
    rewriteSuggestionSchema,
    ["teacher", "student"],
    ownerPolicy +
      "返回建议，用户确认后通过 updateDraft 保存；不能覆盖无关章节。",
  ),
  startCourseJob: feature(
    generationRequestSchema,
    generationJobSchema,
    ["teacher", "student"],
    ownerPolicy + "需要真实任务执行器；无 worker 时不得返回 queued 假任务。",
  ),
  getJob: feature(
    z.strictObject({ jobId: idSchema }),
    generationJobSchema,
    ["teacher", "student"],
    "仅任务所有者。",
  ),
};
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationJob = z.infer<typeof generationJobSchema>;
export type RewriteSuggestion = z.infer<typeof rewriteSuggestionSchema>;
