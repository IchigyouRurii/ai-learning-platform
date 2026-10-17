import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoState, User } from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";
import { createLocalPlatformRepository } from "@/shared/database/local-platform-repository";

let state: DemoState;
vi.mock("@/shared/database", () => ({
  getRepository: () =>
    createLocalPlatformRepository({
      read: async () => structuredClone(state),
      mutate: async <T>(operation: (draft: DemoState) => T) => {
        const draft = structuredClone(state);
        const value = operation(draft);
        state = draft;
        return value;
      },
    }),
}));

import {
  addTeacherFeedback,
  calculateProgress,
  createCourse,
  enrollCourse,
  getLearningContext,
  getWorkspace,
  publishCourse,
  recordSubmission,
} from "@/modules/platform/server/services";

const teacher: User = { id: "demo-teacher", role: "teacher", name: "Teacher" };
const student: User = { id: "demo-student", role: "student", name: "Student" };
beforeEach(() => {
  state = createSeedState();
});

describe("platform permissions and learning lifecycle", () => {
  it("does not expose a teacher draft to a learner", async () => {
    const draft = await createCourse(teacher, state.courses[0]);
    expect(
      (await getWorkspace(student)).courses.some(
        (course) => course.id === draft.id,
      ),
    ).toBe(false);
    await expect(enrollCourse(student, draft.id)).rejects.toThrow("不可加入");
    await publishCourse(teacher, draft.id);
    await enrollCourse(student, draft.id);
    expect(
      (await getWorkspace(student)).courses.some(
        (course) => course.id === draft.id,
      ),
    ).toBe(true);
  });
  it("prevents students from creating or publishing teacher courses", async () => {
    await expect(createCourse(student, state.courses[0])).rejects.toThrow(
      "教师",
    );
    await expect(publishCourse(student, "ai-coding")).rejects.toThrow("教师");
  });
  it("prevents one teacher from publishing another teacher's course", async () => {
    await expect(
      publishCourse({ ...teacher, id: "other-teacher" }, "ai-coding"),
    ).rejects.toThrow("权限");
  });
  it("requires enrollment and validates that the activity belongs to the course", async () => {
    await expect(
      getLearningContext(
        student,
        "product-skills",
        "product-skills-activity-1",
      ),
    ).rejects.toThrow("加入");
    await expect(
      getLearningContext(student, "ai-coding", "product-skills-activity-1"),
    ).rejects.toThrow("不属于");
  });
  it("joining twice does not duplicate the course membership", async () => {
    await Promise.all([
      enrollCourse(student, "ai-coding"),
      enrollCourse(student, "ai-coding"),
    ]);
    expect(
      state.enrollments.filter((item) => item.courseId === "ai-coding"),
    ).toHaveLength(1);
  });
  it("counts repeated attempts only once and ignores other versions and learners", async () => {
    const input = {
      courseId: "ai-coding",
      courseVersion: 1,
      activityId: "ai-coding-activity-1",
      answer: "A concrete response",
      aiFeedback: "Try another example",
    };
    await recordSubmission(student, input);
    await recordSubmission(student, input);
    const progress = calculateProgress(
      state.courses[0],
      state.submissions,
      student.id,
    );
    expect(progress).toEqual({ done: 1, total: 1, percent: 100 });
    expect(
      calculateProgress(
        { ...state.courses[0], version: 2 },
        state.submissions,
        student.id,
      ).done,
    ).toBe(0);
    expect(
      calculateProgress(state.courses[0], state.submissions, "other-student")
        .done,
    ).toBe(0);
  });
  it("rejects stale versions and forged activity identifiers on write", async () => {
    const input = {
      courseId: "ai-coding",
      courseVersion: 2,
      activityId: "ai-coding-activity-1",
      answer: "A concrete response",
      aiFeedback: "Feedback",
    };
    await expect(recordSubmission(student, input)).rejects.toThrow("版本");
    await expect(
      recordSubmission(student, {
        ...input,
        courseVersion: 1,
        activityId: "fake",
      }),
    ).rejects.toThrow("版本");
    expect(state.submissions).toHaveLength(0);
  });
  it("teacher feedback is restricted to their own course and actual members", async () => {
    await expect(
      addTeacherFeedback(
        { ...teacher, id: "other-teacher" },
        "ai-coding",
        student.id,
        "Hello",
      ),
    ).rejects.toThrow("权限");
    await expect(
      addTeacherFeedback(teacher, "ai-coding", "unknown-student", "Hello"),
    ).rejects.toThrow("不在课程");
    await addTeacherFeedback(
      teacher,
      "ai-coding",
      student.id,
      "请补充一个具体验收条件。",
    );
    expect((await getWorkspace(student)).feedback).toHaveLength(1);
    expect(
      (await getWorkspace({ ...student, id: "other-student" })).feedback,
    ).toHaveLength(0);
  });
});
