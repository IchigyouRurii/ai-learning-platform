import type { Course } from "./course";
import type { Submission } from "./platform";

export const QUIZ_PASS_RATIO = 0.6;

export type QuizLessonProgress = {
  lessonId: string;
  lessonTitle: string;
  quizCount: number;
  passedQuizzes: number;
  bestScorePercent: number | null;
  hasQuiz: boolean;
  passed: boolean;
};

export type QuizProgress = {
  lessons: QuizLessonProgress[];
  lessonsWithQuizzes: number;
  passedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  bestScorePercent: number | null;
  averageScorePercent: number | null;
  completed: boolean;
};

export function calculateQuizProgress(
  course: Course,
  submissions: Submission[],
  studentId: string,
): QuizProgress {
  const relevant = submissions.filter(
    (item) =>
      item.courseId === course.id &&
      item.courseVersion === course.version &&
      item.studentId === studentId,
  );

  const allBestScores: number[] = [];
  const lessons = course.lessons.map((lesson): QuizLessonProgress => {
    const quizIds = lesson.blocks.flatMap((block) =>
      block.type === "activity" && block.activity.type === "quiz"
        ? [block.activity.id]
        : [],
    );
    const bestScores = quizIds.map((quizId) => {
      const scores = relevant
        .filter(
          (item) =>
            item.activityId === quizId &&
            item.score != null &&
            item.maxScore != null &&
            item.maxScore > 0,
        )
        .map((item) => (item.score as number) / (item.maxScore as number));
      return scores.length ? Math.max(...scores) : null;
    });
    const numericScores = bestScores.filter(
      (score): score is number => score !== null,
    );
    allBestScores.push(...numericScores);
    const passedQuizzes = numericScores.filter(
      (score) => score >= QUIZ_PASS_RATIO,
    ).length;
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      quizCount: quizIds.length,
      passedQuizzes,
      bestScorePercent: numericScores.length
        ? Math.round(Math.max(...numericScores) * 100)
        : null,
      hasQuiz: quizIds.length > 0,
      passed: quizIds.length > 0 && passedQuizzes === quizIds.length,
    };
  });

  const withQuizzes = lessons.filter((lesson) => lesson.hasQuiz);
  const passedLessons = withQuizzes.filter((lesson) => lesson.passed).length;
  return {
    lessons,
    lessonsWithQuizzes: withQuizzes.length,
    passedLessons,
    totalQuizzes: withQuizzes.reduce(
      (sum, lesson) => sum + lesson.quizCount,
      0,
    ),
    passedQuizzes: withQuizzes.reduce(
      (sum, lesson) => sum + lesson.passedQuizzes,
      0,
    ),
    bestScorePercent: allBestScores.length
      ? Math.round(Math.max(...allBestScores) * 100)
      : null,
    averageScorePercent: allBestScores.length
      ? Math.round(
          (allBestScores.reduce((sum, score) => sum + score, 0) /
            allBestScores.length) *
            100,
        )
      : null,
    completed: withQuizzes.length > 0 && passedLessons === withQuizzes.length,
  };
}
