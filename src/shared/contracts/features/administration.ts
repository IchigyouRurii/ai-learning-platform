import { z } from "zod";
import {
  feature,
  idSchema,
  pageInputSchema,
  pageSchema,
  roleSchema,
  timestampSchema,
  emptyInputSchema,
} from "./common";
import { courseSummarySchema } from "./courses";
import {
  classroomSchema,
  classroomMemberSchema,
  assignmentSchema,
} from "./classrooms";

export const userDirectoryEntrySchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  emailVerified: z.boolean(),
  createdAt: timestampSchema,
});
export const moderationRecordSchema = z.object({
  courseId: idSchema,
  status: z.enum(["active", "withdrawn"]),
  reason: z.string(),
  adminId: idSchema,
  updatedAt: timestampSchema,
});
export const adminOverviewSchema = z.object({
  users: z.number().int().nonnegative(),
  students: z.number().int().nonnegative(),
  teachers: z.number().int().nonnegative(),
  admins: z.number().int().nonnegative(),
  courses: z.number().int().nonnegative(),
  publishedCourses: z.number().int().nonnegative(),
  withdrawnCourses: z.number().int().nonnegative(),
  classrooms: z.number().int().nonnegative(),
  archivedClassrooms: z.number().int().nonnegative(),
});
export const adminCourseEntrySchema = courseSummarySchema.extend({
  ownerName: z.string(),
  status: z.enum(["draft", "published"]),
  moderationReason: z.string(),
  createdAt: timestampSchema,
});
export const adminClassroomEntrySchema = classroomSchema.extend({
  archivedAt: timestampSchema.nullable(),
  archivedByName: z.string().nullable(),
});
export const adminClassroomDetailSchema = z.object({
  classroom: adminClassroomEntrySchema,
  members: z.array(classroomMemberSchema),
  assignments: z.array(assignmentSchema),
});
export const administrationFeatures = {
  listClassrooms: feature(
    z.strictObject({
      ...pageInputSchema.shape,
      search: z.string().max(200).optional(),
      status: z.enum(["active", "archived"]).optional(),
    }),
    pageSchema(adminClassroomEntrySchema),
    ["admin"],
    "全平台班级元数据，不包含邀请码、私人课程或学生答题。",
    "implemented",
  ),
  getClassroom: feature(
    z.strictObject({ classId: idSchema }),
    adminClassroomDetailSchema,
    ["admin"],
    "管理员查看班级、当前成员与未撤销分配的元数据；不返回学习答案或私有正文。",
    "implemented",
  ),
  setClassroomStatus: feature(
    z.strictObject({
      classId: idSchema,
      expectedStatus: z.enum(["active", "archived"]),
      status: z.enum(["active", "archived"]),
      reason: z.string().trim().min(1).max(2000),
    }),
    adminClassroomEntrySchema,
    ["admin"],
    "事务校验旧状态并归档/恢复，记录原因与审计；归档撤销邀请码并暂停班级授权，保留历史。",
    "implemented",
  ),
  removeClassroomMember: feature(
    z.strictObject({
      classId: idSchema,
      studentId: idSchema,
      reason: z.string().trim().min(1).max(2000),
    }),
    z.object({ removed: z.boolean() }),
    ["admin"],
    "跨班级移除成员，撤销旧邀请码防止凭原码重新加入；保留历史，记审计。",
    "implemented",
  ),
  removeClassroomAssignment: feature(
    z.strictObject({
      classId: idSchema,
      assignmentId: idSchema,
      reason: z.string().trim().min(1).max(2000),
    }),
    z.object({ removed: z.boolean() }),
    ["admin"],
    "校验分配属于指定班级，软撤销并记审计，保留历史。",
    "implemented",
  ),
  getOverview: feature(
    emptyInputSchema,
    adminOverviewSchema,
    ["admin"],
    "管理员专用；只返回用户角色与教学课程汇总数量。",
    "implemented",
  ),
  listUsers: feature(
    z.strictObject({
      ...pageInputSchema.shape,
      search: z.string().max(200).optional(),
      role: roleSchema.optional(),
    }),
    pageSchema(userDirectoryEntrySchema),
    ["admin"],
    "管理员专用；不返回密码哈希、账号凭据或会话令牌。",
    "implemented",
  ),
  changeRole: feature(
    z.strictObject({
      userId: idSchema,
      expectedRole: roleSchema,
      role: roleSchema,
    }),
    userDirectoryEntrySchema,
    ["admin"],
    "事务检查旧角色、防止移除最后一个管理员；撤销目标用户全部会话并记审计；不得隐式转移课程/班级所有权。",
    "implemented",
  ),
  listCourses: feature(
    z.strictObject({
      ...pageInputSchema.shape,
      search: z.string().max(200).optional(),
      moderationStatus: z.enum(["active", "withdrawn"]).optional(),
    }),
    pageSchema(adminCourseEntrySchema),
    ["admin"],
    "默认查询平台教学课程元数据，不暴露学生个人课程正文或私有材料。",
    "implemented",
  ),
  withdrawCourse: feature(
    z.strictObject({
      courseId: idSchema,
      reason: z.string().trim().min(1).max(2000),
    }),
    moderationRecordSchema,
    ["admin"],
    "幂等下架；记录审计，阻止新加入及后续学习访问；保留历史版本与提交。",
    "implemented",
  ),
};
export const accountProfileFeatures = {
  getMine: feature(
    emptyInputSchema,
    z.object({
      id: idSchema,
      name: z.string(),
      email: z.email(),
      role: roleSchema,
      emailVerified: z.boolean(),
    }),
    ["teacher", "student", "admin"],
    "仅自己；不包含会话或密码。",
  ),
  updateMine: feature(
    z.strictObject({ name: z.string().trim().min(1).max(80) }),
    z.object({ id: idSchema, name: z.string() }),
    ["teacher", "student", "admin"],
    "仅允许修改自己的称呼，禁止通过个人资料写入 role。",
  ),
};
export type UserDirectoryEntry = z.infer<typeof userDirectoryEntrySchema>;
export type ModerationRecord = z.infer<typeof moderationRecordSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AdminCourseEntry = z.infer<typeof adminCourseEntrySchema>;
export type AdminClassroomEntry = z.infer<typeof adminClassroomEntrySchema>;
export type AdminClassroomDetail = z.infer<typeof adminClassroomDetailSchema>;
