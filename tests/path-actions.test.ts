import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  catalog: vi.fn(),
  context: vi.fn(),
  enroll: vi.fn(),
  save: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/platform", () => ({
  getCurrentUser: mocks.user,
  getCourseCatalog: mocks.catalog,
  getStudentCourseContext: mocks.context,
  enrollCourse: mocks.enroll,
  saveLearningPath: mocks.save,
  getWorkspace: vi.fn(),
  recordGeneration: vi.fn(),
}));
import {
  enrollPathCoursesAction,
  savePathAction,
} from "@/modules/student/path/server/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "student",
    role: "student",
    name: "Student",
  });
  mocks.catalog.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
  mocks.context.mockResolvedValue({ enrolled: false });
  mocks.enroll.mockResolvedValue(undefined);
});
it("enrolls each chosen level and never silently switches an existing enrollment", async () => {
  mocks.context.mockImplementation(async (_actor, id) => ({
    enrolled: id === "b",
    activeLevel: id === "b" ? "beginner" : null,
  }));
  const result = await enrollPathCoursesAction([
    { courseId: "a", difficulty: "expert" },
    { courseId: "b", difficulty: "advanced" },
  ]);
  expect(result.ok).toBe(true);
  expect(mocks.enroll).toHaveBeenCalledTimes(1);
  expect(mocks.enroll).toHaveBeenCalledWith(
    expect.objectContaining({ id: "student" }),
    "a",
    "expert",
  );
  if (result.ok)
    expect(result.data.outcomes[1]).toMatchObject({
      status: "existing",
      difficulty: "beginner",
    });
});
it("reports partial failures and rejects non-Marketplace courses without granting access", async () => {
  mocks.enroll.mockImplementation(async (_actor, id) => {
    if (id === "a") throw new Error("Class-managed course.");
  });
  const result = await enrollPathCoursesAction([
    { courseId: "a", difficulty: "beginner" },
    { courseId: "b", difficulty: "expert" },
    { courseId: "private", difficulty: "advanced" },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(result.data.outcomes.map((item) => item.status)).toEqual([
      "failed",
      "enrolled",
      "failed",
    ]);
  expect(mocks.enroll).toHaveBeenCalledTimes(2);
});
it("rejects duplicate courses, invalid difficulty and non-student actors", async () => {
  expect(
    (
      await enrollPathCoursesAction([
        { courseId: "a", difficulty: "beginner" },
        { courseId: "a", difficulty: "expert" },
      ])
    ).ok,
  ).toBe(false);
  expect(
    (
      await enrollPathCoursesAction([
        { courseId: "a", difficulty: "intermediate" },
      ])
    ).ok,
  ).toBe(false);
  mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
  expect(
    (await enrollPathCoursesAction([{ courseId: "a", difficulty: "expert" }]))
      .ok,
  ).toBe(false);
  expect(mocks.enroll).not.toHaveBeenCalled();
});
it("validates edited routes and keeps ownership server-derived", async () => {
  const raw = {
    id: "path-a",
    title: "My route",
    ownerId: "someone-else",
    steps: [
      {
        courseId: "a",
        courseVersion: 1,
        order: 0,
        difficulty: "advanced",
        targetMinutes: 60,
        reason: "Study this first.",
      },
    ],
  };
  mocks.save.mockResolvedValue(raw);
  expect((await savePathAction(raw)).ok).toBe(true);
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ id: "student" }),
    expect.not.objectContaining({ ownerId: "someone-else" }),
  );
  expect(
    (await savePathAction({ ...raw, steps: [raw.steps[0], raw.steps[0]] })).ok,
  ).toBe(false);
});
