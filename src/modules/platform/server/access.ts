import type { Course, DemoState, User } from "@/shared/contracts";

export function assertTeacher(actor: User) {
  if (actor.role !== "teacher")
    throw new Error("This action requires a teacher account.");
}
export function assertStudent(actor: User) {
  if (actor.role !== "student")
    throw new Error("This action requires a student account.");
}
export function assertCourseOwner(actor: User, course: Course) {
  assertTeacher(actor);
  if (course.ownerId !== actor.id)
    throw new Error("You do not have permission to manage this course.");
}
export function assertCanLearn(actor: User, course: Course, state: DemoState) {
  assertStudent(actor);
  if (course.status !== "published")
    throw new Error("This course has not been published.");
  if (
    !state.enrollments.some(
      (item) => item.courseId === course.id && item.studentId === actor.id,
    )
  )
    throw new Error("Please enroll in this course first.");
}
