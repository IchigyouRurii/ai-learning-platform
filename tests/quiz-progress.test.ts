import { describe, expect, it } from "vitest";
import { createSeedState } from "@/shared/database/seed";
import { calculateQuizProgress } from "@/shared/contracts";
import type { Submission } from "@/shared/contracts";

const course = createSeedState().courses[0];
const studentId = "student-1";

function quizActivityIds() {
  return course.lessons.flatMap((lesson) =>
    lesson.blocks.flatMap((block) =>
      block.type === "activity" && block.activity.type === "quiz"
        ? [block.activity.id]
        : [],
    ),
  );
}

function attempt(activityId: string, score: number, maxScore = 5): Submission {
  return {
    id: `${activityId}-${score}`,
    courseId: course.id,
    courseVersion: course.version,
    activityId,
    studentId,
    answer: "[]",
    aiFeedback: "",
    score,
    maxScore,
    createdAt: "2026-10-29T00:00:00.000Z",
  };
}

describe("quiz progress", () => {
  it("uses the best attempt and requires 60% to pass", () => {
    const quizId = quizActivityIds()[0];
    expect(quizId).toBeTruthy();
    expect(calculateQuizProgress(course, [], studentId).completed).toBe(false);
    expect(
      calculateQuizProgress(course, [attempt(quizId, 2)], studentId)
        .passedQuizzes,
    ).toBe(0);
    expect(
      calculateQuizProgress(
        course,
        [attempt(quizId, 2), attempt(quizId, 3)],
        studentId,
      ).passedQuizzes,
    ).toBe(1);
    expect(
      calculateQuizProgress(course, [attempt(quizId, 5)], studentId).completed,
    ).toBe(true);
  });

  it("marks a lesson passed only when every quiz in that lesson passes", () => {
    const quizzes = quizActivityIds();
    const progress = calculateQuizProgress(
      course,
      quizzes.map((id) => attempt(id, 5)),
      studentId,
    );
    expect(progress.completed).toBe(true);
    expect(progress.passedLessons).toBe(progress.lessonsWithQuizzes);
    expect(progress.passedQuizzes).toBe(progress.totalQuizzes);
  });

  it("ignores unscored reflection submissions and other students", () => {
    const quizId = quizActivityIds()[0];
    const progress = calculateQuizProgress(
      course,
      [
        attempt(quizId, 5),
        {
          ...attempt(quizId, 0),
          studentId: "other-student",
        },
        {
          ...attempt("reflection", 0),
          score: null,
          maxScore: null,
        },
      ],
      studentId,
    );
    expect(progress.passedQuizzes).toBe(1);
  });
});
