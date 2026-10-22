import { describe, expect, it } from "vitest";
import {
  activitySchema,
  courseDraftSchema,
  toSafeActivity,
  type Activity,
} from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";
import { gradeQuiz } from "@/modules/student/activities/server/quiz";

function quizActivity(): Activity {
  const course = createSeedState().courses.find(
    (item) => item.id === "ai-coding",
  )!;
  const block = course.lessons
    .flatMap((lesson) => lesson.blocks)
    .find(
      (item) => item.type === "activity" && item.activity.type === "quiz",
    );
  if (!block || block.type !== "activity")
    throw new Error("Seed course is missing the quiz");
  return block.activity;
}

describe("quiz contract and grading", () => {
  it("requires quiz activities to carry valid questions", () => {
    expect(
      activitySchema.safeParse({
        id: "quiz",
        type: "quiz",
        title: "Quiz",
        prompt: "Answer",
        rubric: "One point",
      }).success,
    ).toBe(false);
    const activity = quizActivity();
    expect(activitySchema.safeParse(activity).success).toBe(true);
  });

  it("rejects answer keys that reference unknown options or multiple answers on a single-choice question", () => {
    const activity = structuredClone(quizActivity());
    activity.questions![0].correctOptionIds = ["missing"];
    expect(activitySchema.safeParse(activity).success).toBe(false);

    const multiple = structuredClone(quizActivity());
    multiple.questions![0].correctOptionIds = multiple.questions![0].options
      .slice(0, 2)
      .map((option) => option.id);
    expect(activitySchema.safeParse(multiple).success).toBe(false);
  });

  it("grades on the server and explains every answer", () => {
    const activity = quizActivity();
    const answers = activity.questions!.map((question) => ({
      questionId: question.id,
      selectedOptionIds: question.correctOptionIds,
    }));
    const result = gradeQuiz(activity, answers);
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.results.every((item) => item.correct)).toBe(true);
    expect(result.feedback).toContain("5 out of 5");
    expect(result.feedback).toContain("Correct.");
  });

  it("scores wrong options and refuses incomplete submissions", () => {
    const activity = quizActivity();
    const wrong = activity.questions!.map((question) => ({
      questionId: question.id,
      selectedOptionIds: [
        question.options.find(
          (option) => !question.correctOptionIds.includes(option.id),
        )!.id,
      ],
    }));
    const result = gradeQuiz(activity, wrong);
    expect(result.score).toBe(0);
    expect(result.feedback).toContain("Correct answer:");
    expect(() => gradeQuiz(activity, wrong.slice(1))).toThrow(
      "answer every question",
    );
  });

  it("strips answer keys and explanations from learner activities", () => {
    const safe = toSafeActivity(quizActivity());
    expect(safe.questions?.length).toBe(5);
    for (const question of safe.questions ?? []) {
      expect(question).not.toHaveProperty("correctOptionIds");
      expect(question).not.toHaveProperty("explanation");
      expect(question.options.length).toBe(4);
    }
  });

  it("keeps all seed courses structurally valid", () => {
    for (const course of createSeedState().courses)
      expect(courseDraftSchema.safeParse(course).success).toBe(true);
  });
});
