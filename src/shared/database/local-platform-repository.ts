import type { PlatformRepository, Repository } from "./repository";
import {
  getActivities,
  type Course,
  type CourseDocument,
  type CourseDraft,
  type GenerationKind,
  type GenerationRecord,
  type LearningPathRecord,
} from "@/shared/contracts";

function draftOf(course: Course): CourseDraft {
  return {
    title: course.title,
    description: course.description,
    subject: course.subject,
    audience: course.audience,
    goals: course.goals,
    lessons: course.lessons,
  };
}

function publishedView(course: Course): Course {
  if (!course.publishedContent) return course;
  return { ...course, ...structuredClone(course.publishedContent) };
}

function toDocument(course: Course): CourseDocument {
  return {
    id: course.id,
    ownerId: course.ownerId,
    status: course.status,
    visibility: course.visibility,
    version: course.version,
    publishedVersion: course.status === "published" ? course.version : null,
    draftRevision: course.draftRevision ?? 1,
    content: draftOf(course),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

export function createLocalPlatformRepository(
  store: Repository,
): PlatformRepository {
  return {
    async getWorkspace(actor) {
      const state = await store.read();
      const courses = state.courses
        .filter((course) =>
          actor.role === "teacher"
            ? course.ownerId === actor.id
            : (course.status === "published" &&
                course.visibility === "cohort") ||
              (course.ownerId === actor.id && course.visibility === "personal"),
        )
        .map((course) =>
          actor.role === "teacher" ? course : publishedView(course),
        );
      const ids = new Set(courses.map((course) => course.id));
      const enrollments = state.enrollments.filter((item) =>
        actor.role === "teacher"
          ? ids.has(item.courseId)
          : item.studentId === actor.id,
      );
      const members = [
        ...new Set(enrollments.map((item) => item.studentId)),
      ].map((id) => ({
        id,
        role: "student" as const,
        name: id === "demo-student" ? "Alex Lin" : "Student",
      }));
      return {
        ...state,
        courses,
        enrollments,
        members,
        submissions: state.submissions.filter((item) =>
          actor.role === "teacher"
            ? ids.has(item.courseId)
            : item.studentId === actor.id,
        ),
        feedback: state.feedback.filter((item) =>
          actor.role === "teacher"
            ? ids.has(item.courseId)
            : item.studentId === actor.id,
        ),
      };
    },
    async findCourse(id, version) {
      const course = (await store.read()).courses.find(
        (item) => item.id === id,
      );
      if (!course || (version !== undefined && course.version !== version))
        return null;
      return course.status === "published" ? publishedView(course) : course;
    },
    async getCourseDocument(id) {
      const course = (await store.read()).courses.find(
        (item) => item.id === id,
      );
      return course ? toDocument(course) : null;
    },
    async isEnrolled(courseId, studentId, version) {
      const state = await store.read();
      if (
        version !== undefined &&
        !state.courses.some(
          (course) => course.id === courseId && course.version === version,
        )
      )
        return false;
      return state.enrollments.some(
        (item) => item.courseId === courseId && item.studentId === studentId,
      );
    },
    async insertCourse(course) {
      return store.mutate((state) => {
        const stored: Course = {
          ...course,
          draftRevision: course.draftRevision ?? 1,
        };
        state.courses.unshift(stored);
        if (stored.visibility === "personal" && stored.status === "published") {
          if (
            !state.enrollments.some(
              (item) =>
                item.courseId === stored.id &&
                item.studentId === stored.ownerId,
            )
          )
            state.enrollments.push({
              courseId: stored.id,
              studentId: stored.ownerId,
              joinedAt: new Date().toISOString(),
            });
        }
        return stored;
      });
    },
    async updateCourseDraft(courseId, ownerId, expectedDraftRevision, content) {
      return store.mutate((state) => {
        const course = state.courses.find(
          (item) => item.id === courseId && item.ownerId === ownerId,
        );
        if (!course) throw new Error("Course not found or access denied.");
        if ((course.draftRevision ?? 1) !== expectedDraftRevision)
          throw new Error(
            "This course changed in another tab. Reload and try again.",
          );
        Object.assign(course, content);
        course.draftRevision = expectedDraftRevision + 1;
        course.updatedAt = new Date().toISOString();
        return toDocument(course);
      });
    },
    async publishCourse(courseId, ownerId) {
      return store.mutate((state) => {
        const course = state.courses.find(
          (item) => item.id === courseId && item.ownerId === ownerId,
        );
        if (!course) throw new Error("Course not found or access denied.");
        const content = structuredClone(draftOf(course));
        const unchanged =
          course.status === "published" &&
          JSON.stringify(content) === JSON.stringify(course.publishedContent);
        if (!unchanged) {
          course.version =
            course.status === "published" ? course.version + 1 : 1;
          course.publishedContent = content;
          course.status = "published";
        }
        course.updatedAt = new Date().toISOString();
        return publishedView(course);
      });
    },
    async enroll(courseId, studentId) {
      await store.mutate((state) => {
        const course = state.courses.find((item) => item.id === courseId);
        if (
          !course ||
          course.status !== "published" ||
          (course.visibility !== "cohort" &&
            !(course.visibility === "personal" && course.ownerId === studentId))
        )
          throw new Error("This course is not open for enrollment.");
        if (
          !state.enrollments.some(
            (item) =>
              item.courseId === courseId && item.studentId === studentId,
          )
        )
          state.enrollments.push({
            courseId,
            studentId,
            joinedAt: new Date().toISOString(),
          });
      });
    },
    async insertSubmission(submission) {
      return store.mutate((state) => {
        const stored = state.courses.find(
          (item) => item.id === submission.courseId,
        );
        const course = stored ? publishedView(stored) : undefined;
        if (
          !course ||
          course.status !== "published" ||
          course.version !== submission.courseVersion ||
          !getActivities(course).some(
            (item) => item.id === submission.activityId,
          )
        )
          throw new Error(
            "The course version or activity has changed. Refresh and try again.",
          );
        if (
          !state.enrollments.some(
            (item) =>
              item.courseId === course.id &&
              item.studentId === submission.studentId,
          )
        )
          throw new Error("Please enroll in this course first.");
        state.submissions.push(submission);
        return submission;
      });
    },
    async insertFeedback(feedback) {
      await store.mutate((state) => {
        if (
          !state.courses.some(
            (course) =>
              course.id === feedback.courseId &&
              course.ownerId === feedback.teacherId,
          )
        )
          throw new Error("Access denied.");
        if (
          !state.enrollments.some(
            (item) =>
              item.courseId === feedback.courseId &&
              item.studentId === feedback.studentId,
          )
        )
          throw new Error("The student is not enrolled in this course.");
        state.feedback.push(feedback);
      });
    },
    async getLearningPath(ownerId) {
      const paths = ((await store.read()).learningPaths ?? [])
        .filter((item) => item.ownerId === ownerId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return paths[0] ?? null;
    },
    async listLearningPaths(ownerId) {
      return ((await store.read()).learningPaths ?? [])
        .filter((item) => item.ownerId === ownerId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async saveLearningPath(path: LearningPathRecord) {
      return store.mutate((state) => {
        state.learningPaths ??= [];
        state.learningPaths.unshift(path);
        return path;
      });
    },
    async insertGenerationRecord(record: GenerationRecord) {
      return store.mutate((state) => {
        state.generationRecords ??= [];
        state.generationRecords.unshift(record);
        return record;
      });
    },
    async listGenerationRecords(
      ownerId,
      options: {
        kind?: GenerationKind;
        courseId?: string;
        limit?: number;
      } = {},
    ) {
      return ((await store.read()).generationRecords ?? [])
        .filter(
          (item) =>
            item.ownerId === ownerId &&
            (!options.kind || item.kind === options.kind) &&
            (!options.courseId || item.courseId === options.courseId),
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit ?? 20);
    },
  };
}
