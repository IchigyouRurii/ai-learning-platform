import { describe, expect, it } from "vitest";
import { createSeedState } from "@/shared/database/seed";
import {
  calculateQuizProgress,
  editableCourseLevels,
  type Course,
} from "@/shared/contracts";
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
    const best = calculateQuizProgress(
      course,
      [attempt(quizId, 2), attempt(quizId, 3)],
      studentId,
    );
    expect(best.passedQuizzes).toBe(1);
    expect(best.bestScorePercent).toBe(60);
    expect(best.averageScorePercent).toBe(60);
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

  it("counts only the requested difficulty for teacher Advanced progress", () => {
    const leveled = {
      ...course,
      lessons: editableCourseLevels(course).lessons,
    } as Course;
    const quizIdsAt = (level: "beginner" | "advanced" | "expert") =>
      leveled.lessons
        .filter((lesson) => lesson.difficulty === level)
        .flatMap((lesson) =>
          lesson.blocks.flatMap((block) =>
            block.type === "activity" && block.activity.type === "quiz"
              ? [block.activity.id]
              : [],
          ),
        );
    const beginnerIds = quizIdsAt("beginner");
    const advancedIds = quizIdsAt("advanced");
    const expertIds = quizIdsAt("expert");
    expect(beginnerIds.length).toBeGreaterThan(0);
    expect(advancedIds.length).toBeGreaterThan(0);
    expect(expertIds.length).toBeGreaterThan(0);

    const everyLevel = [...beginnerIds, ...advancedIds, ...expertIds].map(
      (id) => attempt(id, 5),
    );
    const advanced = calculateQuizProgress(
      leveled,
      everyLevel,
      studentId,
      "advanced",
    );
    expect(advanced.totalQuizzes).toBe(advancedIds.length);
    expect(advanced.passedQuizzes).toBe(advancedIds.length);
    expect(advanced.completed).toBe(true);

    const withoutAdvanced = calculateQuizProgress(
      leveled,
      [...beginnerIds, ...expertIds].map((id) => attempt(id, 5)),
      studentId,
      "advanced",
    );
    expect(withoutAdvanced.passedQuizzes).toBe(0);
    expect(withoutAdvanced.completed).toBe(false);

    const allLevels = calculateQuizProgress(leveled, everyLevel, studentId);
    expect(allLevels.totalQuizzes).toBe(
      beginnerIds.length + advancedIds.length + expertIds.length,
    );
  });
});
