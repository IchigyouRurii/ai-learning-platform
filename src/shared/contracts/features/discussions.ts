import { z } from "zod";
import {
  feature,
  idSchema,
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
  studentId: idSchema,
  message: z.string(),
  status: z.enum(["open", "resolved"]),
  createdAt: timestampSchema,
});
export const replySchema = z.object({
  id: idSchema,
  questionId: idSchema,
  teacherId: idSchema,
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
    "只能就已获授权的教师课程提问；身份从会话取得；章节属于指定版本。个人自学课程没有自动指定的教师。",
  ),
  listThreads: feature(
    z.strictObject({
      courseId: idSchema,
      studentId: idSchema.optional(),
      ...pageInputSchema.shape,
    }),
    pageSchema(questionSchema),
    ["teacher", "student"],
    "学生只看自己的问题，studentId 只能为自己；教师仅看自己课程成员的问题。",
  ),
  getThread: feature(
    z.strictObject({ questionId: idSchema }),
    threadSchema,
    ["teacher", "student"],
    "学生为提问者或教师为课程所有者；不向全班默认公开。",
  ),
  reply: feature(
    z.strictObject({
      questionId: idSchema,
      message: z.string().trim().min(1).max(6000),
    }),
    replySchema,
    ["teacher"],
    "教师拥有问题关联课程；回复者从会话取得。",
  ),
  resolve: feature(
    z.strictObject({ questionId: idSchema }),
    questionSchema,
    ["teacher", "student"],
    "仅提问者或所属课程教师可以标记解决。",
  ),
};
export type CourseQuestion = z.infer<typeof questionSchema>;
export type QuestionReply = z.infer<typeof replySchema>;
export type QuestionThread = z.infer<typeof threadSchema>;
