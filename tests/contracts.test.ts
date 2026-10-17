import { describe, expect, it } from "vitest";
import { courseDraftSchema, generationInputSchema } from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";

describe("course contract", () => {
  it("rejects ambiguous duplicate activity identifiers", () => {
    const course = structuredClone(createSeedState().courses[0]);
    course.lessons.push({
      ...structuredClone(course.lessons[0]),
      id: "another-lesson",
    });
    expect(courseDraftSchema.safeParse(course).success).toBe(false);
  });
  it("rejects empty course content", () => {
    const course = { ...createSeedState().courses[0], lessons: [] };
    expect(courseDraftSchema.safeParse(course).success).toBe(false);
  });
  it("rejects oversized materials before model invocation", () => {
    expect(
      generationInputSchema.safeParse({
        topic: "软件工程",
        audience: "初学者",
        goals: "学习需求分析",
        materials: "x".repeat(20001),
      }).success,
    ).toBe(false);
  });
});
