import "server-only";
import { randomUUID } from "node:crypto";
import {
  courseDraftSchema,
  getActivities,
  type CourseDraft,
  type Course,
  type CourseDocument,
  type GenerationKind,
  type LearningPathRecord,
  type User,
  type Submission,
} from "@/shared/contracts";
import { getRepository } from "@/shared/database";
import { assertStudent, assertTeacher } from "./access";

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
  if (course.moderationStatus === "withdrawn")
    throw new Error(
      "This course has been withdrawn and is no longer available for learning.",
    );
  if (course.status !== "published")
    throw new Error("This course has not been published.");
  if (!(await getRepository().isEnrolled(course.id, actor.id)))
    throw new Error("Please enroll in this course first.");
}

function assertCanAuthor(
  actor: User,
  document: CourseDocument,
): asserts actor is User {
  if (document.ownerId !== actor.id)
    throw new Error("You do not have permission to manage this course.");
  if (actor.role === "teacher" && document.visibility !== "cohort")
    throw new Error("Teachers can only manage classroom courses.");
  if (actor.role === "student" && document.visibility !== "personal")
    throw new Error("Students can only manage their own personal courses.");
  if (actor.role !== "teacher" && actor.role !== "student")
    throw new Error("This account cannot author courses.");
}

export async function createCourse(
  actor: User,
  input: CourseDraft,
  options: { visibility?: Course["visibility"]; publish?: boolean } = {},
): Promise<Course> {
  const parsed = courseDraftSchema.parse(input);
  let visibility: Course["visibility"];
  let published: boolean;
  if (actor.role === "teacher") {
    visibility = "cohort";
    published = false;
  } else if (actor.role === "student") {
    if (options.visibility && options.visibility !== "personal")
      throw new Error("Students can only create personal courses.");
    visibility = "personal";
    published = true;
  } else {
    throw new Error("This account cannot create courses.");
  }
  const now = new Date().toISOString();
  return getRepository().insertCourse({
    ...parsed,
    id: randomUUID(),
    ownerId: actor.id,
    status: published ? "published" : "draft",
    visibility,
    version: 1,
    createdAt: now,
    updatedAt: now,
    draftRevision: 1,
    ...(published ? { publishedContent: structuredClone(parsed) } : {}),
  });
}

export async function getCourseDocumentForAuthor(
  actor: User,
  id: string,
): Promise<CourseDocument> {
  const document = await getRepository().getCourseDocument(id);
  if (!document) throw new Error("Course not found.");
  assertCanAuthor(actor, document);
  return document;
}

export async function updateCourseDraft(
  actor: User,
  id: string,
  expectedDraftRevision: number,
  content: CourseDraft,
): Promise<CourseDocument> {
  await getCourseDocumentForAuthor(actor, id);
  return getRepository().updateCourseDraft(
    id,
    actor.id,
    expectedDraftRevision,
    courseDraftSchema.parse(content),
  );
}

export async function publishCourse(actor: User, id: string) {
  const document = await getRepository().getCourseDocument(id);
  if (!document) throw new Error("Course not found.");
  assertCanAuthor(actor, document);
  courseDraftSchema.parse(document.content);
  return getRepository().publishCourse(id, actor.id);
}

export async function enrollCourse(actor: User, id: string) {
  assertStudent(actor);
  const course = await requireCourse(id);
  const personalOwner =
    course.visibility === "personal" && course.ownerId === actor.id;
  if (
    course.moderationStatus === "withdrawn" ||
    course.status !== "published" ||
    (course.visibility !== "cohort" && !personalOwner)
  )
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
  assertTeacher(actor);
  const course = await requireCourse(courseId);
  if (course.ownerId !== actor.id)
    throw new Error("You do not have permission to manage this course.");
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

export async function getLearningPath(actor: User) {
  assertStudent(actor);
  return getRepository().getLearningPath(actor.id);
}

export async function listLearningPaths(actor: User) {
  assertStudent(actor);
  return getRepository().listLearningPaths(actor.id);
}

export async function listGenerationRecords(
  actor: User,
  options: { kind?: GenerationKind; courseId?: string; limit?: number } = {},
) {
  if (actor.role !== "teacher" && actor.role !== "student")
    throw new Error("This account cannot read AI history.");
  return getRepository().listGenerationRecords(actor.id, options);
}

export async function recordGeneration(
  actor: User,
  input: {
    kind: GenerationKind;
    courseId?: string | null;
    input: unknown;
    result: unknown;
  },
) {
  if (actor.role !== "teacher" && actor.role !== "student")
    throw new Error("This account cannot record AI history.");
  if (input.courseId) {
    const document = await getRepository().getCourseDocument(input.courseId);
    if (!document || document.ownerId !== actor.id)
      throw new Error("You do not have permission to record this course.");
  }
  return getRepository().insertGenerationRecord({
    id: randomUUID(),
    ownerId: actor.id,
    kind: input.kind,
    courseId: input.courseId ?? null,
    input: input.input,
    result: input.result,
    createdAt: new Date().toISOString(),
  });
}

export async function saveLearningPath(
  actor: User,
  input: Omit<LearningPathRecord, "id" | "ownerId" | "createdAt" | "updatedAt">,
) {
  assertStudent(actor);
  const now = new Date().toISOString();
  return getRepository().saveLearningPath({
    ...input,
    id: randomUUID(),
    ownerId: actor.id,
    createdAt: now,
    updatedAt: now,
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
