import type { PlatformRepository, Repository } from "./repository";
import { getActivities } from "@/shared/contracts";

export function createLocalPlatformRepository(
  store: Repository,
): PlatformRepository {
  return {
    async getWorkspace(actor) {
      const state = await store.read();
      const courses = state.courses.filter((course) =>
        actor.role === "teacher"
          ? course.ownerId === actor.id
          : course.status === "published" && course.visibility === "cohort",
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
    async findCourse(id) {
      return (
        (await store.read()).courses.find((course) => course.id === id) ?? null
      );
    },
    async isEnrolled(courseId, studentId) {
      return (await store.read()).enrollments.some(
        (item) => item.courseId === courseId && item.studentId === studentId,
      );
    },
    async insertCourse(course) {
      return store.mutate((state) => {
        state.courses.unshift(course);
        return course;
      });
    },
    async publishCourse(courseId, ownerId) {
      return store.mutate((state) => {
        const course = state.courses.find(
          (item) => item.id === courseId && item.ownerId === ownerId,
        );
        if (!course) throw new Error("Course not found or access denied.");
        course.status = "published";
        course.updatedAt = new Date().toISOString();
        return course;
      });
    },
    async enroll(courseId, studentId) {
      await store.mutate((state) => {
        if (
          !state.courses.some(
            (course) =>
              course.id === courseId &&
              course.status === "published" &&
              course.visibility === "cohort",
          )
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
        const course = state.courses.find(
          (item) =>
            item.id === submission.courseId && item.status === "published",
        );
        if (
          !course ||
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
  };
}
