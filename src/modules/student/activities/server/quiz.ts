import "server-only";
import type {
  Activity,
  QuizAnswer,
  QuizQuestion,
  QuizQuestionResult,
  QuizResult,
} from "@/shared/contracts";

function optionText(question: QuizQuestion, id: string) {
  return question.options.find((option) => option.id === id)?.text ?? id;
}

export function gradeQuiz(
  activity: Activity,
  answers: QuizAnswer[],
): QuizResult {
  if (activity.type !== "quiz" || !activity.questions?.length)
    throw new Error("This activity is not a quiz.");
  const questions = activity.questions;
  const seen = new Set<string>();
  for (const answer of answers) {
    if (seen.has(answer.questionId))
      throw new Error("Each question can only be answered once.");
    seen.add(answer.questionId);
    const question = questions.find((item) => item.id === answer.questionId);
    if (!question) throw new Error("An answer refers to an unknown question.");
    if (
      new Set(answer.selectedOptionIds).size !==
      answer.selectedOptionIds.length
    )
      throw new Error("Each option can only be selected once.");
    if (
      answer.selectedOptionIds.some(
        (id) => !question.options.some((option) => option.id === id),
      )
    )
      throw new Error("An answer refers to an unknown option.");
  }
  if (answers.length !== questions.length)
    throw new Error("Please answer every question before submitting.");

  const results = questions.map((question): QuizQuestionResult => {
    const selected =
      answers.find((answer) => answer.questionId === question.id)
        ?.selectedOptionIds ?? [];
    const correct =
      selected.length === question.correctOptionIds.length &&
      selected.every((id) => question.correctOptionIds.includes(id));
    return {
      questionId: question.id,
      correct,
      correctOptionIds: question.correctOptionIds,
      correctAnswerText: question.correctOptionIds
        .map((id) => optionText(question, id))
        .join("; "),
      explanation: question.explanation,
    };
  });
  const score = results.filter((result) => result.correct).length;
  const maxScore = questions.length;
  const lines = [
    `You scored ${score} out of ${maxScore}.`,
    "",
    ...questions.map((question, index) => {
      const result = results[index];
      const answer = result.correct
        ? "Correct."
        : `Not correct. Correct answer: ${result.correctAnswerText}.`;
      return `Q${index + 1}. ${answer} ${result.explanation}`;
    }),
  ];
  return {
    score,
    maxScore,
    results,
    feedback: lines.join("\n"),
  };
}
