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
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  createdAt: timestampSchema,
  teacherName: z.string(),
  memberCount: z.number().int().nonnegative(),
  assignmentCount: z.number().int().nonnegative(),
  status: z.enum(["active", "archived"]),
  archiveReason: z.string(),
});
export const classroomMemberSchema = z.object({
  classId: idSchema,
  student: memberViewSchema,
  joinedAt: timestampSchema,
});
export const assignmentSchema = z.object({
  id: idSchema,
  classId: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  title: z.string(),
  dueAt: timestampSchema.nullable(),
  assignedAt: timestampSchema,
  className: z.string(),
  available: z.boolean(),
  classArchived: z.boolean(),
});
export const invitationSchema = z.object({
  id: idSchema,
  classId: idSchema,
  email: z.email(),
  expiresAt: timestampSchema,
  status: z.enum(["pending", "accepted", "expired"]),
});
export const assignableCourseSchema = z.object({
  id: idSchema,
  title: z.string(),
  versions: z.array(versionSchema),
  publishedVersion: versionSchema,
});
const classId = z.strictObject({ classId: idSchema });
const ownerPolicy = "教师必须拥有班级；仓储写入再次检查 teacher_id。";
export const classroomFeatures = {
  create: feature(
    z.strictObject({
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(2000).default(""),
    }),
    classroomSchema,
    ["teacher"],
    "教师 ID 从会话取得。",
    "implemented",
  ),
  get: feature(
    classId,
    classroomSchema,
    ["teacher", "student"],
    "仅班级所有者或当前成员。",
    "implemented",
  ),
  update: feature(
    z.strictObject({
      classId: idSchema,
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(2000).default(""),
    }),
    classroomSchema,
    ["teacher"],
    ownerPolicy,
    "implemented",
  ),
  listAssignableCourses: feature(
    classId,
    z.array(assignableCourseSchema),
    ["teacher"],
    ownerPolicy + "仅自己已发布、未下架的教学课程及其发布版本。",
    "implemented",
  ),
  removeAssignment: feature(
    z.strictObject({ classId: idSchema, assignmentId: idSchema }),
    z.object({ removed: z.boolean() }),
    ["teacher"],
    ownerPolicy + "撤销班级授权，保留学习记录。",
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
    ownerPolicy + "仅导入现有学生账号；未知邮箱返回缺失项，不生成默认密码。",
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
    "implemented",
  ),
  createJoinCode: feature(
    classId,
    z.object({ code: z.string(), expiresAt: timestampSchema }),
    ["teacher"],
    ownerPolicy,
    "implemented",
  ),
  removeMember: feature(
    z.strictObject({ classId: idSchema, studentId: idSchema }),
    z.object({ removed: z.boolean() }),
    ["teacher"],
    ownerPolicy + "移除后的学习访问按现存授权关系计算，保留历史记录。",
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
    "implemented",
  ),
  listAssignments: feature(
    z.strictObject({ classId: idSchema.optional(), ...pageInputSchema.shape }),
    pageSchema(assignmentSchema),
    ["teacher", "student"],
    "教师仅自己班级，学生仅当前加入班级；每项保留指定发布版本。",
    "implemented",
  ),
};
export type Classroom = z.infer<typeof classroomSchema>;
export type ClassroomMember = z.infer<typeof classroomMemberSchema>;
export type CourseAssignment = z.infer<typeof assignmentSchema>;
export type ClassroomInvitation = z.infer<typeof invitationSchema>;

export type AssignableCourse = z.infer<typeof assignableCourseSchema>;
