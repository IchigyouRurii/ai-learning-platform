import type { PlatformRepository, Repository } from "./repository";
import {
  getActivities,
  courseLevel,
  lessonsAtLevel,
  toCatalogCourse,
  toPublishedCourse,
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
    async listOwnedCatalog(actor) {
      if (!actor?.id || !["teacher", "student"].includes(actor.role))
        throw new Error("An author account is required.");
      return (await store.read()).courses
        .filter((course) => course.ownerId === actor.id)
        .map((course) => toCatalogCourse(publishedView(course), actor.name));
    },
    async canDeleteOwnedCourse(courseId, ownerId) {
      const state = await store.read();
      return (
        state.courses.some(
          (course) =>
            course.id === courseId &&
            course.ownerId === ownerId &&
            course.visibility === "personal",
        ) &&
        !state.enrollments.some(
          (item) => item.courseId === courseId && item.studentId !== ownerId,
        )
      );
    },
    async listCatalog(actor) {
      if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
        throw new Error("Please sign in first.");
      const state = await store.read();
      return state.courses
        .filter(
          (course) =>
            course.status === "published" &&
            course.visibility === "cohort" &&
            course.moderationStatus !== "withdrawn",
        )
        .map((course) =>
          toCatalogCourse(
            publishedView(course),
            course.ownerId === actor.id ? actor.name : "Course author",
          ),
        );
    },
    async findPublishedCourse(actor, id) {
      if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
        throw new Error("Please sign in first.");
      const course = (await store.read()).courses.find(
        (item) =>
          item.id === id &&
          item.status === "published" &&
          item.visibility === "cohort" &&
          item.moderationStatus !== "withdrawn",
      );
      return course
        ? toPublishedCourse(
            publishedView(course),
            course.ownerId === actor.id ? actor.name : "Course author",
          )
        : null;
    },
    async getStudentCourseContext(actor, courseId) {
      if (!actor?.id || actor.role !== "student")
        throw new Error("Student access required.");
      const state = await store.read();
      const stored = state.courses.find(
        (course) =>
          course.id === courseId &&
          course.status === "published" &&
          course.moderationStatus !== "withdrawn" &&
          (course.visibility === "cohort" ||
            (course.visibility === "personal" && course.ownerId === actor.id)),
      );
      if (!stored) return null;
      const course = publishedView(stored);
      const enrollment = state.enrollments.find(
        (item) => item.courseId === courseId && item.studentId === actor.id,
      );
      const enrolled = Boolean(enrollment);
      const activeLevel = enrollment
        ? courseLevel(enrollment.difficulty)
        : null;
      return {
        course,
        enrolled,
        activeLevel,
        classManaged: false,
        submissions: enrolled
          ? state.submissions.filter(
              (item) =>
                item.courseId === courseId &&
                item.studentId === actor.id &&
                item.courseVersion === course.version &&
                courseLevel(item.difficulty) === activeLevel,
            )
          : [],
        lessonCompletions: enrolled
          ? (state.lessonCompletions ?? []).filter(
              (item) =>
                item.courseId === courseId &&
                item.studentId === actor.id &&
                item.courseVersion === course.version &&
                courseLevel(item.difficulty) === activeLevel,
            )
          : [],
      };
    },
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
        lessonCompletions: (state.lessonCompletions ?? []).filter((item) =>
          actor.role === "teacher"
            ? ids.has(item.courseId)
            : item.studentId === actor.id,
        ),
      };
    },
    async findCourse(id) {
      const course = (await store.read()).courses.find(
        (item) => item.id === id,
      );
      if (!course) return null;
      return course.status === "published" ? publishedView(course) : course;
    },
    async getCourseDocument(id) {
      const course = (await store.read()).courses.find(
        (item) => item.id === id,
      );
      return course ? toDocument(course) : null;
    },
    async isEnrolled(courseId, studentId) {
      return (await store.read()).enrollments.some(
        (item) => item.courseId === courseId && item.studentId === studentId,
      );
    },
    async getActiveCourseLevel(courseId, studentId) {
      const state = await store.read();
      const enrollment = state.enrollments.find(
        (item) => item.courseId === courseId && item.studentId === studentId,
      );
      const course = state.courses.find(
        (item) =>
          item.id === courseId &&
          item.status === "published" &&
          item.moderationStatus !== "withdrawn" &&
          (item.visibility === "cohort" || item.ownerId === studentId),
      );
      return enrollment && course ? courseLevel(enrollment.difficulty) : null;
    },
    async switchCourseLevel(
      courseId,
      studentId,
      expectedLevel,
      nextLevel,
      courseVersion,
    ) {
      await store.mutate((state) => {
        const stored = state.courses.find((item) => item.id === courseId);
        const course = stored ? publishedView(stored) : null;
        const enrollment = state.enrollments.find(
          (item) => item.courseId === courseId && item.studentId === studentId,
        );
        if (
          !course ||
          !enrollment ||
          courseLevel(enrollment.difficulty) !== expectedLevel ||
          course.version !== courseVersion ||
          course.status !== "published" ||
          course.moderationStatus === "withdrawn" ||
          (course.visibility === "personal" && course.ownerId !== studentId) ||
          !lessonsAtLevel(course.lessons, nextLevel).length
        )
          throw new Error(
            "The course or active difficulty has changed. Refresh and try again.",
          );
        enrollment.difficulty = nextLevel;
      });
    },
    async deleteOwnedCourse(courseId, ownerId) {
      await store.mutate((state) => {
        if (
          !state.courses.some(
            (course) =>
              course.id === courseId &&
              course.ownerId === ownerId &&
              course.visibility === "personal",
          )
        )
          throw new Error("You can only delete courses you created.");
        if (
          state.enrollments.some(
            (item) => item.courseId === courseId && item.studentId !== ownerId,
          )
        )
          throw new Error(
            "This course is linked to another learner and cannot be deleted.",
          );
        state.courses = state.courses.filter(
          (course) => course.id !== courseId,
        );
        state.enrollments = state.enrollments.filter(
          (item) => item.courseId !== courseId,
        );
        state.submissions = state.submissions.filter(
          (item) => item.courseId !== courseId,
        );
        state.feedback = state.feedback.filter(
          (item) => item.courseId !== courseId,
        );
        state.lessonCompletions = state.lessonCompletions?.filter(
          (item) => item.courseId !== courseId,
        );
        state.generationRecords = state.generationRecords?.filter(
          (item) => item.courseId !== courseId,
        );
      });
    },
    async leaveCourse(courseId, studentId) {
      await store.mutate((state) => {
        const course = state.courses.find((item) => item.id === courseId);
        if (
          !course ||
          course.visibility !== "cohort" ||
          course.ownerId === studentId
        )
          throw new Error("Unable to leave this course.");
        state.enrollments = state.enrollments.filter(
          (item) =>
            !(item.courseId === courseId && item.studentId === studentId),
        );
      });
    },
    async isCourseManagedByClass() {
      return false;
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
              difficulty: "beginner",
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
    async enroll(courseId, studentId, difficulty = "beginner") {
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
            difficulty,
          });
      });
    },
    async completeLesson(
      courseId,
      courseVersion,
      lessonId,
      studentId,
      completed = true,
      difficulty = "beginner",
    ) {
      await store.mutate((state) => {
        const stored = state.courses.find((item) => item.id === courseId);
        const course = stored ? publishedView(stored) : undefined;
        if (
          !course ||
          course.status !== "published" ||
          course.version !== courseVersion
        )
          throw new Error("Course version changed. Refresh and try again.");
        if (
          !state.enrollments.some(
            (item) =>
              item.courseId === courseId && item.studentId === studentId,
          )
        )
          throw new Error("Enroll in this course first.");
        const active = state.enrollments.find(
          (item) => item.courseId === courseId && item.studentId === studentId,
        );
        if (courseLevel(active?.difficulty) !== difficulty)
          throw new Error("Active difficulty changed. Refresh and try again.");
        if (
          !lessonsAtLevel(course.lessons, difficulty).some(
            (lesson) => lesson.id === lessonId,
          )
        )
          throw new Error("This lesson does not belong to the course.");
        if (!completed) {
          state.lessonCompletions = (state.lessonCompletions ?? []).filter(
            (item) =>
              !(
                item.courseId === courseId &&
                item.courseVersion === courseVersion &&
                item.lessonId === lessonId &&
                item.studentId === studentId &&
                courseLevel(item.difficulty) === difficulty
              ),
          );
          return;
        }
        const completions = state.lessonCompletions ?? [];
        if (
          !completions.some(
            (item) =>
              item.courseId === courseId &&
              item.courseVersion === courseVersion &&
              item.lessonId === lessonId &&
              item.studentId === studentId &&
              courseLevel(item.difficulty) === difficulty,
          )
        ) {
          completions.push({
            courseId,
            courseVersion,
            lessonId,
            studentId,
            difficulty,
            completedAt: new Date().toISOString(),
          });
          state.lessonCompletions = completions;
        }
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
        const active = state.enrollments.find(
          (item) =>
            item.courseId === course.id &&
            item.studentId === submission.studentId,
        );
        if (
          courseLevel(active?.difficulty) !==
            courseLevel(submission.difficulty) ||
          !getActivities({
            ...course,
            lessons: lessonsAtLevel(
              course.lessons,
              courseLevel(submission.difficulty),
            ),
          }).some((item) => item.id === submission.activityId)
        )
          throw new Error("Active difficulty changed. Refresh and try again.");
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
        for (const step of path.steps) {
          const course = state.courses.find(
            (course) =>
              course.id === step.courseId &&
              course.version === step.courseVersion &&
              course.status === "published" &&
              course.visibility === "cohort" &&
              course.moderationStatus !== "withdrawn",
          );
          if (
            !course ||
            !lessonsAtLevel(
              publishedView(course).lessons,
              courseLevel(step.difficulty),
            ).length
          )
            throw new Error(
              "The path or one of its courses is no longer available.",
            );
        }
        state.learningPaths ??= [];
        const existing = state.learningPaths.find(
          (item) => item.id === path.id,
        );
        if (existing && existing.ownerId !== path.ownerId)
          throw new Error("This learning path is not available to edit.");
        if (existing) Object.assign(existing, path);
        else state.learningPaths.unshift(path);
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
