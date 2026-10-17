import { z } from "zod";
import {
  feature,
  idSchema,
  emptyInputSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
  versionSchema,
} from "./common";

export const learningProfileInputSchema = z.strictObject({
  background: z.string().trim().max(2000),
  goals: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  availableMinutesPerWeek: z.number().int().min(15).max(10080),
});
export const learningProfileSchema = learningProfileInputSchema.extend({
  userId: idSchema,
  updatedAt: timestampSchema,
});
const steps = z
  .array(
    z.object({
      courseId: idSchema,
      courseVersion: versionSchema,
      order: z.number().int().nonnegative(),
      targetMinutes: z.number().int().positive(),
      reason: z.string().min(1),
    }),
  )
  .min(1)
  .max(100)
  .superRefine((items, ctx) => {
    if (new Set(items.map((i) => i.order)).size !== items.length)
      ctx.addIssue({ code: "custom", message: "路径步骤顺序不能重复。" });
    if (new Set(items.map((i) => i.courseId)).size !== items.length)
      ctx.addIssue({
        code: "custom",
        message: "学习路径不能重复包含同一课程。",
      });
  });
export const learningPathDraftSchema = z.object({
  title: z.string().min(1).max(160),
  steps,
});
export const learningPathSchema = learningPathDraftSchema.extend({
  id: idSchema,
  ownerId: idSchema,
  createdAt: timestampSchema,
});
export const profileFeatures = {
  getMine: feature(
    emptyInputSchema,
    learningProfileSchema.nullable(),
    ["student"],
    "仅当前学生的学习档案。",
  ),
  updateMine: feature(
    learningProfileInputSchema,
    learningProfileSchema,
    ["student"],
    "用户身份从会话取得；档案不授予课程访问权。",
  ),
};
export const learningPathFeatures = {
  generate: feature(
    learningProfileInputSchema,
    learningPathDraftSchema,
    ["student"],
    "只推荐当前可访问、已发布且未下架的课程，版本必须存在；根据时间及难度排序；不授予访问权、不自动保存。",
  ),
  save: feature(
    z.strictObject({ path: learningPathDraftSchema }),
    learningPathSchema,
    ["student"],
    "所有者从会话取得；逐项验证课程版本和访问范围，不能直接信任 AI 或客户端给出的 ID。",
  ),
  listMine: feature(
    pageInputSchema,
    pageSchema(learningPathSchema),
    ["student"],
    "仅当前学生的路径。",
  ),
  getMine: feature(
    z.strictObject({ pathId: idSchema }),
    learningPathSchema,
    ["student"],
    "路径属于当前学生；读取时重新核对各项课程权限。",
  ),
};
export type LearningProfile = z.infer<typeof learningProfileSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
export type LearningPathDraft = z.infer<typeof learningPathDraftSchema>;
