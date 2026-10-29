import { z } from "zod";
import {
  feature,
  idSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
  versionSchema,
  memberViewSchema,
} from "./common";

export const classroomSchema = z.object({
  id: idSchema,
  teacherId: idSchema,
  courseId: idSchema,
  courseTitle: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  memberCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});
export const classroomMemberSchema = z.object({
  classId: idSchema,
  student: memberViewSchema.extend({ email: z.email() }),
  joinedAt: timestampSchema,
});
export const studentDirectoryEntrySchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
});
const studentDirectoryInputSchema = z.strictObject({
  search: z.string().trim().max(100).default(""),
  limit: z.number().int().min(1).max(200).default(100),
  cursor: z.string().min(1).max(500).optional(),
});
export const assignmentSchema = z.object({
  id: idSchema,
  classId: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  title: z.string(),
  dueAt: timestampSchema.nullable(),
  assignedAt: timestampSchema,
});
export const invitationSchema = z.object({
  id: idSchema,
  classId: idSchema,
  email: z.email(),
  expiresAt: timestampSchema,
  status: z.enum(["pending", "accepted", "expired"]),
});
const classId = z.strictObject({ classId: idSchema });
const ownerPolicy = "教师必须拥有班级；仓储写入再次检查 teacher_id。";
export const classroomFeatures = {
  create: feature(
    z.strictObject({
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(2000).default(""),
      courseId: idSchema,
      studentIds: z.array(idSchema).max(500).default([]),
    }),
    classroomSchema,
    ["teacher"],
    "教师 ID 从会话取得；courseId 必须是教师自己已发布、visibility=cohort 的课程；所选学生自动加入班级并写入 enrollments。",
    "implemented",
  ),
  get: feature(
    classId,
    classroomSchema,
    ["teacher", "student"],
    "教师仅能读取自己拥有的班级，学生仅能读取自己加入的班级。",
    "implemented",
  ),
  deleteClass: feature(
    classId,
    z.object({ deleted: z.boolean() }),
    ["teacher"],
    ownerPolicy +
      "只删除班级和成员关系；已写入的公开课程报名和学习记录保留。",
    "implemented",
  ),
  listMine: feature(
    pageInputSchema,
    pageSchema(classroomSchema),
    ["teacher", "student"],
    "仅自己拥有或加入的班级。",
    "implemented",
  ),
  listMembers: feature(
    classId,
    z.array(classroomMemberSchema),
    ["teacher"],
    ownerPolicy,
    "implemented",
  ),
  listStudents: feature(
    studentDirectoryInputSchema,
    pageSchema(studentDirectoryEntrySchema),
    ["teacher"],
    "教师可查看已注册学生名单以便选人入班；只返回 id、name、email，不返回密码或会话。",
    "implemented",
  ),
  inviteStudents: feature(
    z.strictObject({
      classId: idSchema,
      emails: z.array(z.email()).min(1).max(200),
    }),
    z.object({ invitations: z.array(invitationSchema) }),
    ["teacher"],
    ownerPolicy +
      "邀请令牌仅受邀者可用，不返回学生密码；邮件未接入时不得宣称发送成功。",
  ),
  importStudents: feature(
    z.strictObject({
      classId: idSchema,
      emails: z.array(z.email()).min(1).max(500),
    }),
    z.object({ added: z.array(idSchema), missingEmails: z.array(z.email()) }),
    ["teacher"],
    ownerPolicy +
      "仅导入现有学生账号；未知邮箱返回缺失项，不生成默认密码；匹配到的学生同时写入班级所绑定课程的 enrollments。",
    "implemented",
  ),
  acceptInvitation: feature(
    z.strictObject({ token: z.string().min(20).max(500) }),
    classroomSchema,
    ["student"],
    "令牌有效且未过期，服务端已验证的账号邮箱匹配受邀邮箱；一次性消费。",
  ),
  joinByCode: feature(
    z.strictObject({ code: z.string().trim().min(6).max(100) }),
    classroomSchema,
    ["student"],
    "验证有效班级邀请码，幂等加入；邀请码只保存哈希并限制尝试次数。",
  ),
  createJoinCode: feature(
    classId,
    z.object({ code: z.string(), expiresAt: timestampSchema }),
    ["teacher"],
    ownerPolicy,
  ),
  removeMember: feature(
    z.strictObject({ classId: idSchema, studentId: idSchema }),
    z.object({ removed: z.boolean() }),
    ["teacher"],
    ownerPolicy +
      "只删除班级成员关系；已写入的公开课程报名和学习记录保留。",
    "implemented",
  ),
  assignCourse: feature(
    z.strictObject({
      classId: idSchema,
      courseId: idSchema,
      courseVersion: versionSchema,
      dueAt: timestampSchema.optional(),
    }),
    assignmentSchema,
    ["teacher"],
    ownerPolicy + "同时拥有教学课程；只分配已发布且未下架的指定版本。",
  ),
  listAssignments: feature(
    z.strictObject({ classId: idSchema.optional(), ...pageInputSchema.shape }),
    pageSchema(assignmentSchema),
    ["teacher", "student"],
    "教师仅自己班级，学生仅当前加入班级；每项保留指定发布版本。",
  ),
};
export type Classroom = z.infer<typeof classroomSchema>;
export type ClassroomMember = z.infer<typeof classroomMemberSchema>;
export type StudentDirectoryEntry = z.infer<typeof studentDirectoryEntrySchema>;
export type CourseAssignment = z.infer<typeof assignmentSchema>;
export type ClassroomInvitation = z.infer<typeof invitationSchema>;
