import type { Course, DemoState, User } from "@/shared/contracts";

export function assertTeacher(actor: User) {
  if (actor.role !== "teacher") throw new Error("此操作需要教师身份。");
}
export function assertStudent(actor: User) {
  if (actor.role !== "student") throw new Error("此操作需要学生身份。");
}
export function assertCourseOwner(actor: User, course: Course) {
  assertTeacher(actor);
  if (course.ownerId !== actor.id)
    throw new Error("你没有管理这门课程的权限。");
}
export function assertCanLearn(actor: User, course: Course, state: DemoState) {
  assertStudent(actor);
  if (course.status !== "published") throw new Error("课程尚未发布。");
  if (
    !state.enrollments.some(
      (item) => item.courseId === course.id && item.studentId === actor.id,
    )
  )
    throw new Error("请先加入这门课程。");
}
