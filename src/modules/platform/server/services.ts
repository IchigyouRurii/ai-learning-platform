import "server-only";
import { randomUUID } from "node:crypto";
import {
  courseDraftSchema,
  getActivities,
  type CourseDraft,
  type Course,
  type User,
  type Submission,
} from "@/shared/contracts";
import { getRepository } from "@/shared/database";
import { assertCourseOwner, assertStudent, assertTeacher } from "./access";

export async function getWorkspace(actor: User) {
  if (actor.role === "teacher") assertTeacher(actor);
  else assertStudent(actor);
  return getRepository().getWorkspace(actor);
}

async function requireCourse(id: string) {
  const course = await getRepository().findCourse(id);
  if (!course) throw new Error("Course not found.");
  return course;
}

async function requireLearningAccess(actor: User, course: Course) {
  assertStudent(actor);
  if (course.status !== "published")
    throw new Error("This course has not been published.");
  if (!(await getRepository().isEnrolled(course.id, actor.id)))
    throw new Error("Please enroll in this course first.");
}

export async function createCourse(
  actor: User,
  input: CourseDraft,
): Promise<Course> {
  assertTeacher(actor);
  const parsed = courseDraftSchema.parse(input);
  const now = new Date().toISOString();
  return getRepository().insertCourse({
    ...parsed,
    id: randomUUID(),
    ownerId: actor.id,
    status: "draft",
    visibility: "cohort",
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export async function publishCourse(actor: User, id: string) {
  const course = await requireCourse(id);
  assertCourseOwner(actor, course);
  courseDraftSchema.parse(course);
  return getRepository().publishCourse(id, actor.id);
}

export async function enrollCourse(actor: User, id: string) {
  assertStudent(actor);
  const course = await requireCourse(id);
  if (course.status !== "published" || course.visibility !== "cohort")
    throw new Error("This course is not open for enrollment.");
  await getRepository().enroll(id, actor.id);
}

export async function getLearningContext(
  actor: User,
  courseId: string,
  activityId: string,
) {
  const course = await requireCourse(courseId);
  await requireLearningAccess(actor, course);
  const activity = getActivities(course).find((item) => item.id === activityId);
  if (!activity)
    throw new Error("This activity does not belong to the course.");
  return { course, activity };
}

export async function recordSubmission(
  actor: User,
  input: Omit<Submission, "id" | "studentId" | "createdAt">,
) {
  const course = await requireCourse(input.courseId);
  await requireLearningAccess(actor, course);
  if (
    course.version !== input.courseVersion ||
    !getActivities(course).some((item) => item.id === input.activityId)
  )
    throw new Error(
      "The course version or activity has changed. Refresh and try again.",
    );
  return getRepository().insertSubmission({
    ...input,
    id: randomUUID(),
    studentId: actor.id,
    createdAt: new Date().toISOString(),
  });
}

export async function addTeacherFeedback(
  actor: User,
  courseId: string,
  studentId: string,
  message: string,
) {
  assertCourseOwner(actor, await requireCourse(courseId));
  if (!(await getRepository().isEnrolled(courseId, studentId)))
    throw new Error("The student is not enrolled in this course.");
  await getRepository().insertFeedback({
    id: randomUUID(),
    courseId,
    studentId,
    teacherId: actor.id,
    message,
    createdAt: new Date().toISOString(),
  });
}

export function calculateProgress(
  course: Course,
  submissions: Submission[],
  studentId: string,
) {
  const activities = getActivities(course);
  const completed = new Set(
    submissions
      .filter(
        (item) =>
          item.courseId === course.id &&
          item.courseVersion === course.version &&
          item.studentId === studentId,
      )
      .map((item) => item.activityId),
  );
  const done = activities.filter((activity) =>
    completed.has(activity.id),
  ).length;
  return {
    done,
    total: activities.length,
    percent: activities.length
      ? Math.round((done / activities.length) * 100)
      : 0,
  };
}
