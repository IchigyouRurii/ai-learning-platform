import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import {
  courseDraftSchema,
  courseLevel,
  courseLevelSchema,
  lessonsAtLevel,
  type CourseLevel,
  validateCourseIntroduction,
  catalogCourseSchema,
  getActivities,
  type CourseDraft,
  type Course,
  type CourseDocument,
  type CourseMaterial,
  type GenerationKind,
  type LearningPathRecord,
  type User,
  type Submission,
} from "@/shared/contracts";
import { learningPathDraftSchema } from "@/shared/contracts/features/plans";
import { z } from "zod";
import { getRepository } from "@/shared/database";
import { assertStudent, assertTeacher } from "./access";

export const getWorkspace = cache(async (actor: User) => {
  if (actor.role === "teacher") assertTeacher(actor);
  else assertStudent(actor);
  return getRepository().getWorkspace(actor);
});

export async function getStudentCourseContext(actor: User, courseId: string) {
  assertStudent(actor);
  const id = catalogCourseSchema.shape.id.max(200).safeParse(courseId);
  if (!id.success) return null;
  return getRepository().getStudentCourseContext(actor, id.data);
}

export async function getOwnedCourseCatalog(actor: User) {
  if (!actor?.id || !["teacher", "student"].includes(actor.role))
    throw new Error("An author account is required.");
  return getRepository().listOwnedCatalog(actor);
}

export async function canDeleteOwnedCourse(actor: User, courseId: string) {
  if (!actor?.id || actor.role !== "student") return false;
  return getRepository().canDeleteOwnedCourse(
    catalogCourseSchema.shape.id.max(200).parse(courseId),
    actor.id,
  );
}

export async function getCourseCatalog(actor: User) {
  if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
    throw new Error("Please sign in first.");
  return getRepository().listCatalog(actor);
}

export async function getPublishedCourse(actor: User, id: string) {
  if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
    throw new Error("Please sign in first.");
  const parsed = catalogCourseSchema.shape.id.max(200).safeParse(id);
  if (!parsed.success) return null;
  return getRepository().findPublishedCourse(actor, parsed.data);
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
  const activeLevel = await getRepository().getActiveCourseLevel(
    course.id,
    actor.id,
  );
  if (!activeLevel) throw new Error("Please enroll in this course first.");
  return activeLevel;
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
  parsed.description = validateCourseIntroduction(parsed.description);
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
  const document = await getCourseDocumentForAuthor(actor, id);
  const parsed = courseDraftSchema.parse(content);
  parsed.description = validateCourseIntroduction(
    parsed.description,
    document.content.description,
  );
  return getRepository().updateCourseDraft(
    id,
    actor.id,
    expectedDraftRevision,
    parsed,
  );
}

export async function publishCourse(actor: User, id: string) {
  const document = await getRepository().getCourseDocument(id);
  if (!document) throw new Error("Course not found.");
  assertCanAuthor(actor, document);
  courseDraftSchema.parse(document.content);
  return getRepository().publishCourse(id, actor.id);
}

export async function isCourseManagedByClass(courseId: string) {
  return getRepository().isCourseManagedByClass(courseId);
}

export async function enrollCourse(
  actor: User,
  id: string,
  difficulty: CourseLevel = "beginner",
) {
  assertStudent(actor);
  const course = await requireCourse(id);
  if (await getRepository().isCourseManagedByClass(id))
    throw new Error(
      "This course is managed by a class. Ask your teacher to add you.",
    );
  const personalOwner =
    course.visibility === "personal" && course.ownerId === actor.id;
  if (
    course.moderationStatus === "withdrawn" ||
    course.status !== "published" ||
    (course.visibility !== "cohort" && !personalOwner)
  )
    throw new Error("This course is not open for enrollment.");
  const selected = courseLevelSchema.parse(difficulty);
  if (!lessonsAtLevel(course.lessons, selected).length)
    throw new Error("This difficulty has no published materials yet.");
  const active = await getRepository().getActiveCourseLevel(id, actor.id);
  if (active && active !== selected)
    throw new Error("Already enrolled. Use Switch difficulty instead.");
  await getRepository().enroll(id, actor.id, selected);
}

export async function deleteOwnedCourse(actor: User, courseId: string) {
  if (!actor?.id || actor.role !== "student")
    throw new Error(
      "Only students can delete their own personal courses. Teacher courses can only be withdrawn by an administrator.",
    );
  await getRepository().deleteOwnedCourse(
    catalogCourseSchema.shape.id.max(200).parse(courseId),
    actor.id,
  );
}

export async function leaveCourse(actor: User, courseId: string) {
  assertStudent(actor);
  const id = catalogCourseSchema.shape.id.max(200).parse(courseId);
  if (await getRepository().isCourseManagedByClass(id))
    throw new Error(
      "Class courses cannot be left. Please contact your teacher.",
    );
  await getRepository().leaveCourse(id, actor.id);
}

export async function switchCourseLevel(
  actor: User,
  id: string,
  expectedLevel: CourseLevel,
  nextLevel: CourseLevel,
  version: number,
) {
  assertStudent(actor);
  await getRepository().switchCourseLevel(
    catalogCourseSchema.shape.id.max(200).parse(id),
    actor.id,
    courseLevelSchema.parse(expectedLevel),
    courseLevelSchema.parse(nextLevel),
    catalogCourseSchema.shape.version.parse(version),
  );
}

export async function completeLesson(
  actor: User,
  courseId: string,
  courseVersion: number,
  lessonId: string,
  completed = true,
  expectedLevel?: CourseLevel,
) {
  assertStudent(actor);
  const course = await requireCourse(courseId);
  if (course.status !== "published" || course.version !== courseVersion)
    throw new Error("课程版本已变化，请刷新后重试。");
  const activeLevel = await requireLearningAccess(actor, course);
  if (expectedLevel && expectedLevel !== activeLevel)
    throw new Error("Active difficulty changed. Refresh and try again.");
  if (
    !lessonsAtLevel(course.lessons, activeLevel).some(
      (lesson) => lesson.id === lessonId,
    )
  )
    throw new Error("章节不属于这门课程。");
  await getRepository().completeLesson(
    courseId,
    courseVersion,
    lessonId,
    actor.id,
    completed,
    activeLevel,
  );
}

export async function getLearningContext(
  actor: User,
  courseId: string,
  activityId: string,
  expectedLevel?: CourseLevel,
) {
  const course = await requireCourse(courseId);
  const activeLevel = await requireLearningAccess(actor, course);
  if (expectedLevel && expectedLevel !== activeLevel)
    throw new Error("Active difficulty changed. Refresh and try again.");
  const activity = getActivities({
    ...course,
    lessons: lessonsAtLevel(course.lessons, activeLevel),
  }).find((item) => item.id === activityId);
  if (!activity)
    throw new Error("This activity does not belong to the course.");
  return { course, activity, difficulty: activeLevel };
}

export async function recordSubmission(
  actor: User,
  input: Omit<Submission, "id" | "studentId" | "createdAt">,
) {
  const course = await requireCourse(input.courseId);
  const activeLevel = await requireLearningAccess(actor, course);
  if (input.difficulty && input.difficulty !== activeLevel)
    throw new Error("Active difficulty changed. Refresh and try again.");
  if (
    course.version !== input.courseVersion ||
    !getActivities({
      ...course,
      lessons: lessonsAtLevel(course.lessons, activeLevel),
    }).some((item) => item.id === input.activityId)
  )
    throw new Error(
      "The course version or activity has changed. Refresh and try again.",
    );
  return getRepository().insertSubmission({
    ...input,
    difficulty: activeLevel,
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

export async function createMaterial(
  actor: User,
  input: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    content: Uint8Array;
    extractedText: string;
  },
) {
  if (actor.role !== "teacher" && actor.role !== "student")
    throw new Error("This account cannot upload course materials.");
  const material: CourseMaterial = {
    id: randomUUID(),
    ownerId: actor.id,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    extractedText: input.extractedText,
    createdAt: new Date().toISOString(),
  };
  return getRepository().insertMaterial(material, input.content);
}

export async function getMaterialForDownload(actor: User, id: string) {
  if (
    actor.role !== "teacher" &&
    actor.role !== "student" &&
    actor.role !== "admin"
  )
    throw new Error("This account cannot download materials.");
  const found = await getRepository().findMaterial(id);
  if (!found) throw new Error("Material not found.");
  if (
    found.material.ownerId !== actor.id &&
    actor.role !== "admin" &&
    !(await getRepository().isMaterialPublished(id))
  )
    throw new Error("You do not have permission to download this material.");
  return found;
}

export async function getMaterialsForGeneration(
  actor: User,
  ids: string[],
) {
  if (actor.role !== "teacher" && actor.role !== "student")
    throw new Error("This account cannot use course materials.");
  return getRepository().findMaterialsForOwner(actor.id, [...new Set(ids)]);
}

export async function saveLearningPath(
  actor: User,
  input: Omit<
    LearningPathRecord,
    "id" | "ownerId" | "createdAt" | "updatedAt"
  > & { id?: string },
) {
  assertStudent(actor);
  const parsed = learningPathDraftSchema
    .extend({ id: z.string().min(1).max(200).optional() })
    .parse(input);
  const repository = getRepository();
  const catalog = new Map(
    (await repository.listCatalog(actor)).map((course) => [course.id, course]),
  );
  const steps = await Promise.all(
    parsed.steps.map(async (step, order) => {
      const item = catalog.get(step.courseId);
      if (!item || item.version !== step.courseVersion)
        throw new Error(
          "A course has changed or is no longer available. Reopen the planner and review your courses.",
        );
      const context = await repository.getStudentCourseContext(
        actor,
        step.courseId,
      );
      if (
        !context ||
        !lessonsAtLevel(context.course.lessons, step.difficulty).length
      )
        throw new Error(
          "The selected difficulty is not available for this course.",
        );
      return { ...step, order };
    }),
  );
  const existing = parsed.id
    ? (await repository.listLearningPaths(actor.id)).find(
        (path) => path.id === parsed.id,
      )
    : null;
  if (parsed.id && !existing)
    throw new Error("This learning path is not available to edit.");
  const now = new Date().toISOString();
  return repository.saveLearningPath({
    title: parsed.title,
    steps,
    id: existing?.id ?? randomUUID(),
    ownerId: actor.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function calculateProgress(
  course: Course,
  submissions: Submission[],
  studentId: string,
  difficulty?: CourseLevel,
) {
  const activities = getActivities(
    difficulty
      ? { ...course, lessons: lessonsAtLevel(course.lessons, difficulty) }
      : course,
  );
  const completed = new Set(
    submissions
      .filter(
        (item) =>
          item.courseId === course.id &&
          item.courseVersion === course.version &&
          item.studentId === studentId &&
          (!difficulty || courseLevel(item.difficulty) === difficulty),
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
