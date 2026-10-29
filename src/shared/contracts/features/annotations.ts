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

export const annotationCategorySchema = z.enum([
  "question",
  "unclear",
  "possible_error",
  "outdated",
]);
export const annotationStatusSchema = z.enum(["open", "replied", "resolved"]);

export const contentAnnotationSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  lessonId: idSchema,
  blockId: idSchema,
  student: memberViewSchema,
  quote: z.string(),
  category: annotationCategorySchema,
  message: z.string(),
  status: annotationStatusSchema,
  teacherReply: z.string().nullable(),
  repliedAt: timestampSchema.nullable(),
  studentSeenAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

const courseVersion = z.strictObject({
  courseId: idSchema,
  courseVersion: versionSchema,
});

export const annotationFeatures = {
  create: feature(
    z.strictObject({
      courseId: idSchema,
      courseVersion: versionSchema,
      lessonId: idSchema,
      blockId: idSchema,
      quote: z.string().trim().max(1000).optional(),
      category: annotationCategorySchema,
      message: z.string().trim().min(1).max(3000),
    }),
    contentAnnotationSchema,
    ["student"],
    "学生必须已加入课程；lessonId 和 blockId 必须属于指定发布版本；作者从会话取得。",
    "implemented",
  ),
  listMine: feature(
    z.strictObject({
      ...courseVersion.shape,
      ...pageInputSchema.shape,
    }),
    pageSchema(contentAnnotationSchema),
    ["student"],
    "学生只能读取自己在指定课程版本中的批注。",
    "implemented",
  ),
  listForTeacher: feature(
    z.strictObject({
      courseId: idSchema.optional(),
      studentId: idSchema.optional(),
      ...pageInputSchema.shape,
    }),
    pageSchema(contentAnnotationSchema),
    ["teacher"],
    "教师只能读取自己课程中的批注；可按课程或学生过滤。",
    "implemented",
  ),
  reply: feature(
    z.strictObject({
      annotationId: idSchema,
      message: z.string().trim().min(1).max(3000),
    }),
    contentAnnotationSchema,
    ["teacher"],
    "教师必须拥有批注所属课程；回复后学生端出现未读提醒。",
    "implemented",
  ),
  resolve: feature(
    z.strictObject({ annotationId: idSchema }),
    contentAnnotationSchema,
    ["teacher"],
    "教师必须拥有批注所属课程；可以只解决不回复，解决后学生端出现未读提醒。",
    "implemented",
  ),
  markSeen: feature(
    z.strictObject({ annotationId: idSchema }),
    z.object({ seen: z.boolean() }),
    ["student"],
    "只有批注作者本人可以标记已读；只对教师已回复/解决的批注生效。",
    "implemented",
  ),
};

export type AnnotationCategory = z.infer<typeof annotationCategorySchema>;
export type AnnotationStatus = z.infer<typeof annotationStatusSchema>;
export type ContentAnnotation = z.infer<typeof contentAnnotationSchema>;
