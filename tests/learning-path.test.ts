import { describe, expect, it } from "vitest";
import { createSeedState } from "@/shared/database/seed";
import {
  catalogItem,
  validateAgainstCatalog,
} from "@/modules/course-generation/server/path";

const catalog = createSeedState().courses.map(catalogItem);

describe("learning path validation", () => {
  it("accepts a valid ordered plan and fills the published version", () => {
    const result = validateAgainstCatalog(
      {
        title: "Foundations first",
        steps: [
          { courseId: "software-basics", order: 0, targetMinutes: 90, reason: "Start here." },
          { courseId: "ai-coding", order: 1, targetMinutes: 60, reason: "Apply it." },
        ],
      },
      catalog,
    );
    expect(result.steps.map((step) => step.courseId)).toEqual([
      "software-basics",
      "ai-coding",
    ]);
    expect(result.steps.every((step) => step.courseVersion === 1)).toBe(true);
    expect(result.steps.map((step) => step.order)).toEqual([0, 1]);
  });

  it("rejects invented course IDs instead of trusting model output", () => {
    expect(() =>
      validateAgainstCatalog(
        {
          title: "Bad plan",
          steps: [
            { courseId: "invented-course", order: 0, targetMinutes: 30, reason: "No." },
          ],
        },
        catalog,
      ),
    ).toThrow("not in the catalog");
  });

  it("rejects repeated courses and reorders by the model's order field", () => {
    expect(() =>
      validateAgainstCatalog(
        {
          title: "Repeated",
          steps: [
            { courseId: "ai-coding", order: 0, targetMinutes: 30, reason: "A." },
            { courseId: "ai-coding", order: 1, targetMinutes: 30, reason: "B." },
          ],
        },
        catalog,
      ),
    ).toThrow("repeats a course");

    const result = validateAgainstCatalog(
      {
        title: "Out of order",
        steps: [
          { courseId: "ai-coding", order: 2, targetMinutes: 30, reason: "Later." },
          { courseId: "software-basics", order: 1, targetMinutes: 30, reason: "First." },
        ],
      },
      catalog,
    );
    expect(result.steps[0].courseId).toBe("software-basics");
  });
});
