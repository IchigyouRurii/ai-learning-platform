import { expect, it } from "vitest";
import {
  COURSE_INTRODUCTION_MAX_LENGTH,
  courseDraftSchema,
  generationInputSchema,
  validateCourseIntroduction,
} from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";

it("accepts the introduction boundary and rejects oversized new or changed introductions", () => {
  const boundary = "a".repeat(COURSE_INTRODUCTION_MAX_LENGTH);
  expect(validateCourseIntroduction(boundary)).toBe(boundary);
  expect(() => validateCourseIntroduction(boundary + "a")).toThrow();
  const input = {
    topic: "Algebra",
    goals: "Solve equations",
    description: boundary,
  };
  expect(generationInputSchema.safeParse(input).success).toBe(true);
  expect(
    generationInputSchema.safeParse({ ...input, description: boundary + "a" })
      .success,
  ).toBe(false);
});
it("preserves readable legacy descriptions and allows unrelated edits without truncating them", () => {
  const previous = "a".repeat(500);
  expect(
    courseDraftSchema.safeParse({
      ...createSeedState().courses[0],
      description: previous,
    }).success,
  ).toBe(true);
  expect(validateCourseIntroduction(previous, previous)).toBe(previous);
  expect(() => validateCourseIntroduction(previous + "b", previous)).toThrow();
  expect(
    validateCourseIntroduction("A concise new introduction", previous),
  ).toBe("A concise new introduction");
});
