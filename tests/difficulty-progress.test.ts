import { expect, it } from "vitest";
import { calculateProgress } from "@/modules/platform/server/services";
import { createSeedState } from "@/shared/database/seed";
import { getActivities, type Submission } from "@/shared/contracts";
it("counts only records from the requested difficulty even when legacy activity IDs are identical", () => {
  const course = createSeedState().courses[0];
  const activity = getActivities(course)[0];
  const record: Submission = {
    id: "a",
    studentId: "s",
    courseId: course.id,
    courseVersion: course.version,
    activityId: activity.id,
    answer: "Answer",
    aiFeedback: "Feedback",
    createdAt: new Date().toISOString(),
  };
  expect(calculateProgress(course, [record], "s", "beginner").done).toBe(1);
  expect(calculateProgress(course, [record], "s", "advanced").done).toBe(0);
  expect(
    calculateProgress(
      course,
      [{ ...record, difficulty: "advanced" }],
      "s",
      "advanced",
    ).done,
  ).toBe(1);
  expect(
    calculateProgress(
      course,
      [{ ...record, difficulty: "advanced" }],
      "s",
      "beginner",
    ).done,
  ).toBe(0);
});
