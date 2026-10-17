import { z } from "zod";
import {
  feature,
  idSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
  versionSchema,
} from "./common";
import { authoringDraftSchema } from "./activities";

export const courseSummarySchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  goals: z.array(z.string()),
  chapters: z.array(z.object({ id: idSchema, title: z.string() })),
  visibility: z.enum(["cohort", "personal"]),
  publishedVersion: versionSchema.nullable(),
  moderationStatus: z.enum(["active", "withdrawn"]),
});
export const courseEditorSchema = z.object({
  courseId: idSchema,
  ownerId: idSchema,
  visibility: z.enum(["cohort", "personal"]),
  draftRevision: versionSchema,
  publishedVersion: versionSchema.nullable(),
  content: authoringDraftSchema,
});
export const publishedRevisionSchema = z.object({
  courseId: idSchema,
  version: versionSchema,
  content: authoringDraftSchema,
  publishedAt: timestampSchema,
});
const ownerPolicy =
  "教师仅自己教学课程；学生仅自己 personal 课程；管理员使用独立管理接口。";
export const courseManagementFeatures = {
  listCatalog: feature(
    z.strictObject({
      ...pageInputSchema.shape,
      search: z.string().trim().max(200).optional(),
      subject: z.string().max(100).optional(),
    }),
    pageSchema(courseSummarySchema),
    ["teacher", "student", "admin"],
    "仅已发布、未下架的教学课程；不含个人课程、草稿或活动答案。",
  ),
  listMine: feature(
    pageInputSchema,
    pageSchema(courseSummarySchema),
    ["teacher", "student"],
    ownerPolicy,
  ),
  getEditor: feature(
    z.strictObject({ courseId: idSchema }),
    courseEditorSchema,
    ["teacher", "student"],
    ownerPolicy + "作者专用响应包含答案，不可用于学生阅读页。",
  ),
  createPersonal: feature(
    z.strictObject({ content: authoringDraftSchema }),
    courseEditorSchema,
    ["student"],
    "服务端将 ownerId 设为当前学生、visibility=personal；不进入公共目录。",
  ),
  updateDraft: feature(
    z.strictObject({
      courseId: idSchema,
      expectedDraftRevision: versionSchema,
      content: authoringDraftSchema,
    }),
    courseEditorSchema,
    ["teacher", "student"],
    ownerPolicy + "乐观锁冲突返回 CONFLICT；只更新草稿，既有发布快照不变。",
  ),
  publishRevision: feature(
    z.strictObject({
      courseId: idSchema,
      expectedDraftRevision: versionSchema,
    }),
    z.object({ courseId: idSchema, version: versionSchema }),
    ["teacher", "student"],
    ownerPolicy +
      "事务创建不可变内容和活动配置快照；学生仅激活个人课程，不公开发布。",
  ),
  listRevisions: feature(
    z.strictObject({ courseId: idSchema, ...pageInputSchema.shape }),
    pageSchema(
      z.object({
        courseId: idSchema,
        version: versionSchema,
        publishedAt: timestampSchema,
      }),
    ),
    ["teacher", "student"],
    ownerPolicy,
  ),
  getRevisionForAuthor: feature(
    z.strictObject({ courseId: idSchema, version: versionSchema }),
    publishedRevisionSchema,
    ["teacher", "student"],
    ownerPolicy + "仅作者可读取含评价配置的完整快照；学习端使用安全投影。",
  ),
};
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type CourseEditor = z.infer<typeof courseEditorSchema>;
export type PublishedRevision = z.infer<typeof publishedRevisionSchema>;
