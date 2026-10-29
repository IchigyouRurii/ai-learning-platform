import { z } from "zod";
import {
  feature,
  idSchema,
  memberViewSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
  versionSchema,
} from "./common";

export const reactionKindSchema = z.enum([
  "like",
  "smile",
  "confused",
  "doubt",
]);
export const reactionSummarySchema = z.object({
  reaction: reactionKindSchema,
  count: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
});
export const questionSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  lessonId: idSchema.nullable(),
  author: memberViewSchema,
  message: z.string(),
  status: z.enum(["open", "resolved"]),
  deletedAt: timestampSchema.nullable(),
  reactions: z.array(reactionSummarySchema),
  createdAt: timestampSchema,
});
export const replySchema = z.object({
  id: idSchema,
  questionId: idSchema,
  author: memberViewSchema,
  message: z.string(),
  deletedAt: timestampSchema.nullable(),
  reactions: z.array(reactionSummarySchema),
  createdAt: timestampSchema,
});
export const threadSchema = z.object({
  question: questionSchema,
  replies: z.array(replySchema),
});
export const discussionFeatures = {
  ask: feature(
    z.strictObject({
      courseId: idSchema,
      courseVersion: versionSchema,
      lessonId: idSchema.optional(),
      message: z.string().trim().min(1).max(6000),
    }),
    questionSchema,
    ["student"],
    "只能对自己已加入的课程提问；身份从会话取得；章节属于指定发布版本。",
    "implemented",
  ),
  listThreads: feature(
    z.strictObject({
      courseId: idSchema,
      studentId: idSchema.optional(),
      ...pageInputSchema.shape,
    }),
    pageSchema(questionSchema),
    ["teacher", "student"],
    "已加入课程的学生可查看该课程全部问题；教师仅可查看自己课程；非课程成员不可见。studentId 过滤只对教师生效。",
    "implemented",
  ),
  getThread: feature(
    z.strictObject({ questionId: idSchema }),
    threadSchema,
    ["teacher", "student"],
    "学生必须是课程成员；教师必须是课程所有者；不向课程外成员公开。",
    "implemented",
  ),
  reply: feature(
    z.strictObject({
      questionId: idSchema,
      message: z.string().trim().min(1).max(6000),
    }),
    replySchema,
    ["teacher", "student"],
    "学生必须是课程成员；教师必须是课程所有者；作者从会话取得。",
    "implemented",
  ),
  resolve: feature(
    z.strictObject({ questionId: idSchema }),
    questionSchema,
    ["teacher", "student"],
    "仅提问者本人或所属课程教师可以标记解决；其他学生可以回答但不能代为解决。",
    "implemented",
  ),
  deleteQuestion: feature(
    z.strictObject({ questionId: idSchema }),
    z.object({ deleted: z.boolean() }),
    ["teacher", "student"],
    "仅提问者本人可以软删除自己的问题；教师不能删除学生的问题，其他学生也不能代为删除。",
    "implemented",
  ),
  deleteReply: feature(
    z.strictObject({ replyId: idSchema }),
    z.object({ deleted: z.boolean() }),
    ["teacher", "student"],
    "仅回复作者本人可以软删除自己的回复；其他学生和课程教师不能代为删除。",
    "implemented",
  ),
  toggleReaction: feature(
    z
      .strictObject({
        questionId: idSchema.optional(),
        replyId: idSchema.optional(),
        reaction: reactionKindSchema,
      })
      .refine(
        (value) => (value.questionId ? 1 : 0) + (value.replyId ? 1 : 0) === 1,
        { message: "Choose exactly one reaction target." },
      ),
    z.object({ reactions: z.array(reactionSummarySchema) }),
    ["teacher", "student"],
    "只有课程成员或课程教师可以表态；每个用户对一条消息最多一个表情，同表情取消、不同表情切换；已删除消息不能再表态。",
    "implemented",
  ),
};
export type ReactionKind = z.infer<typeof reactionKindSchema>;
export type ReactionSummary = z.infer<typeof reactionSummarySchema>;
export type CourseQuestion = z.infer<typeof questionSchema>;
export type QuestionReply = z.infer<typeof replySchema>;
export type QuestionThread = z.infer<typeof threadSchema>;
