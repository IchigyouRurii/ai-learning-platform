import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  materials: vi.fn(),
  record: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/modules/platform", () => ({
  getCurrentUser: mocks.actor,
  getMaterialsForGeneration: mocks.materials,
  recordGeneration: mocks.record,
  createCourse: vi.fn(),
  getCourseDocumentForAuthor: vi.fn(),
  publishCourse: vi.fn(),
  updateCourseDraft: vi.fn(),
}));
vi.mock("@/modules/course-generation/server/generate", () => ({
  generateCourse: mocks.generate,
}));
import { generateCourseLevelsAction } from "@/modules/course-generation/server/actions";
const input = {
  topic: "Software",
  audience: "Learners",
  goals: "Learn software",
  difficulty: "beginner" as const,
  materials: "",
  subject: "Computer Science" as const,
  description: "",
  materialIds: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ id: "author", role: "teacher" });
  mocks.record.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
it("shares authorization and attachment preparation across three levels, retaining successes", async () => {
  mocks.generate.mockImplementation(async (request) => {
    if (request.difficulty === "advanced") throw new Error("Model rate limit");
    return { title: request.difficulty, lessons: [] };
  });
  const result = await generateCourseLevelsAction(input, [
    "beginner",
    "advanced",
    "expert",
  ]);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(result.data.map((item) => item.result.ok)).toEqual([
    true,
    false,
    true,
  ]);
  expect(mocks.actor).toHaveBeenCalledTimes(1);
  expect(mocks.materials).not.toHaveBeenCalled();
  expect(mocks.record).toHaveBeenCalledTimes(2);
  expect(new Set(mocks.generate.mock.calls.map((call) => call[1])).size).toBe(
    1,
  );
});
it("rejects foreign attachments before starting any model request", async () => {
  mocks.materials.mockResolvedValue([]);
  const result = await generateCourseLevelsAction(
    { ...input, materialIds: ["missing"] },
    ["beginner", "expert"],
  );
  expect(result.ok).toBe(false);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("rejects unsupported roles and duplicate levels without generating", async () => {
  mocks.actor.mockResolvedValue({ id: "admin", role: "admin" });
  expect((await generateCourseLevelsAction(input, ["beginner"])).ok).toBe(
    false,
  );
  expect(
    (await generateCourseLevelsAction(input, ["beginner", "beginner"])).ok,
  ).toBe(false);
  expect(mocks.generate).not.toHaveBeenCalled();
});
