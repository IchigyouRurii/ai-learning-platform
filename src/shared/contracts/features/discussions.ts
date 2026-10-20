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

export const questionSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  lessonId: idSchema.nullable(),
  author: memberViewSchema,
  message: z.string(),
  status: z.enum(["open", "resolved"]),
  createdAt: timestampSchema,
});
export const replySchema = z.object({
  id: idSchema,
  questionId: idSchema,
  author: memberViewSchema,
  message: z.string(),
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
};
export type CourseQuestion = z.infer<typeof questionSchema>;
export type QuestionReply = z.infer<typeof replySchema>;
export type QuestionThread = z.infer<typeof threadSchema>;
